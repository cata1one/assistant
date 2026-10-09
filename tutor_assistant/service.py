"""Сервисный слой: единая логика для Telegram-бота, HTTP API и консоли."""

from __future__ import annotations

import logging
import threading
from collections.abc import Hashable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from . import render
from .commands import HELP_TEXT, detect_command
from .config import Settings
from .contact_guard import ContactGuard, ConversationGuard, ModerationResult
from .homework import HomeworkCollector
from .llm import LLMClient
from .models import HomeworkTask, LessonReport, Role, Utterance, VocabItem
from .report import build_report
from .storage import Storage
from .transcript import parse_transcript
from .vocabulary import VocabularyCollector

log = logging.getLogger(__name__)


class LessonNotFound(LookupError):
    pass


@dataclass
class MessageOutcome:
    lesson_id: str
    moderation: ModerationResult
    stored_text: str
    incident_id: int | None = None
    new_words: list[VocabItem] = field(default_factory=list)
    new_homework: list[HomeworkTask] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "lesson_id": self.lesson_id,
            "moderation": self.moderation.to_dict(),
            "stored_text": self.stored_text,
            "incident_id": self.incident_id,
            "new_words": [w.model_dump() for w in self.new_words],
            "new_homework": [h.model_dump() for h in self.new_homework],
        }


@dataclass
class _LiveState:
    guard: ConversationGuard
    words: VocabularyCollector
    homework: HomeworkCollector


class TutorAssistant:
    def __init__(self, settings: Settings | None = None, storage: Storage | None = None, llm: LLMClient | None = None):
        self.settings = settings or Settings()
        self.storage = storage or Storage(self.settings.db_path)
        self.llm = llm if llm is not None else LLMClient(self.settings)
        self.guard = ContactGuard(self.settings)
        self._live: dict[str, _LiveState] = {}
        self._chat_guards: dict[str, ConversationGuard] = {}
        self._lock = threading.RLock()

    # -- модерация ------------------------------------------------------------
    def moderate(self, text: str) -> ModerationResult:
        """Проверка одного сообщения без привязки к уроку."""
        return self.guard.check(text)

    def moderate_chat_message(self, chat_id: str, user_id: str | None, user_name: str | None, text: str,
                              role: Role | str | None = None, ref: Hashable | None = None,
                              ts: float | None = None) -> tuple[ModerationResult, int | None]:
        """Модерация вне урока: контакты запрещены в чате всегда, а не только во время занятия."""
        with self._lock:
            guard = self._chat_guards.setdefault(chat_id, ConversationGuard(self.guard))
            result = guard.check(str(user_id or user_name), text, ts=ts, ref=ref)
        incident_id = None
        if result.is_violation:
            incident_id = self.storage.add_incident(
                lesson_id=None, chat_id=chat_id, user_id=user_id, user_name=user_name, role=Role.parse(role),
                severity=result.severity.name.lower(), action=result.action, summary=result.summary,
                original_text=text, redacted_text=result.redacted_text, findings=[f.to_dict() for f in result.findings])
        return result, incident_id

    # -- уроки ----------------------------------------------------------------
    def start_lesson(self, chat_id: str | None = None, tutor_id: str | None = None, tutor_name: str | None = None,
                     student_id: str | None = None, student_name: str | None = None,
                     title: str | None = None) -> dict[str, Any]:
        if chat_id is not None:
            active = self.storage.active_lesson(chat_id)
            if active:
                return active
        return self.storage.create_lesson(chat_id, tutor_id, tutor_name, student_id, student_name, title)

    def lesson(self, lesson_id: str) -> dict[str, Any]:
        lesson = self.storage.get_lesson(lesson_id)
        if not lesson:
            raise LessonNotFound(lesson_id)
        return lesson

    def _state(self, lesson_id: str) -> _LiveState:
        with self._lock:
            st = self._live.get(lesson_id)
            if st is None:
                st = _LiveState(ConversationGuard(self.guard), VocabularyCollector(self.settings.target_language),
                                HomeworkCollector())
                # После перезапуска восстанавливаем уже собранные слова и ДЗ, чтобы не было дублей.
                for w in self.storage.lesson_words_live(lesson_id):
                    st.words.add(w)
                st.homework.tasks.extend(self.storage.lesson_homework_live(lesson_id))
                self._live[lesson_id] = st
            return st

    @staticmethod
    def owner_for(lesson: dict[str, Any]) -> str:
        """Чей это словарь: ученика, а если он неизвестен — чата/урока."""
        if lesson.get("student_id"):
            return f"student:{lesson['student_id']}"
        if lesson.get("chat_id"):
            return f"chat:{lesson['chat_id']}"
        return f"lesson:{lesson['id']}"

    def resolve_role(self, lesson: dict[str, Any], speaker_id: str | None, role: Role | str | None) -> Role:
        r = Role.parse(role)
        if r != Role.UNKNOWN:
            return r
        if speaker_id is not None and str(speaker_id) == str(lesson.get("tutor_id")):
            return Role.TUTOR
        return Role.STUDENT if lesson.get("tutor_id") else Role.UNKNOWN

    def process_message(self, lesson_id: str, speaker_id: str | None, speaker_name: str | None, text: str,
                        role: Role | str | None = None, ref: Hashable | None = None,
                        ts: float | None = None) -> MessageOutcome:
        lesson = self.lesson(lesson_id)
        role_ = self.resolve_role(lesson, speaker_id, role)
        if role_ == Role.STUDENT and not lesson.get("student_id") and speaker_id is not None:
            self.storage.update_lesson(lesson_id, student_id=str(speaker_id), student_name=speaker_name)
        st = self._state(lesson_id)

        with self._lock:
            result = st.guard.check(str(speaker_id or speaker_name or role_.value), text, ts=ts, ref=ref)
        stored = result.redacted_text if result.blocked else text
        self.storage.add_message(lesson_id, None if speaker_id is None else str(speaker_id), speaker_name, role_, stored)

        incident_id = None
        if result.is_violation:
            incident_id = self.storage.add_incident(
                lesson_id=lesson_id, chat_id=lesson.get("chat_id"), user_id=None if speaker_id is None else str(speaker_id),
                user_name=speaker_name, role=role_, severity=result.severity.name.lower(), action=result.action,
                summary=result.summary, original_text=text, redacted_text=result.redacted_text,
                findings=[f.to_dict() for f in result.findings],
            )

        new_words: list[VocabItem] = []
        new_hw: list[HomeworkTask] = []
        with self._lock:
            if role_ in (Role.TUTOR, Role.UNKNOWN) and not result.blocked:
                new_words = st.words.feed_tutor_message(text)
                new_hw = st.homework.feed_tutor_message(text)
            else:
                st.words.stop_awaiting()
        for w in new_words:
            self.storage.add_lesson_item(lesson_id, "word", w.model_dump())
        for h in new_hw:
            self.storage.add_lesson_item(lesson_id, "homework", h.model_dump())
        return MessageOutcome(lesson_id, result, stored, incident_id, new_words, new_hw)

    def finish_lesson(self, lesson_id: str, use_llm: bool = True) -> LessonReport:
        lesson = self.lesson(lesson_id)
        utterances = self.storage.lesson_utterances(lesson_id)
        owner = self.owner_for(lesson)
        known = self.storage.known_words(owner, exclude_lesson=lesson_id)
        report = build_report(
            utterances, self.settings, llm=self.llm if use_llm else None, known_words=known, title=lesson.get("title"),
            lesson_id=lesson_id, violations=self.storage.incident_count(lesson_id=lesson_id),
            announced=self.storage.lesson_words_live(lesson_id), assigned=self.storage.lesson_homework_live(lesson_id),
        )
        self.storage.add_words(owner, lesson_id, report.vocabulary)
        self.storage.save_report(lesson_id, report)
        self.storage.finish_lesson(lesson_id)
        with self._lock:
            self._live.pop(lesson_id, None)
        return report

    # -- разбор готовой расшифровки -----------------------------------------
    def analyze_transcript(self, text: str, title: str | None = None, student_id: str | None = None,
                           tutor_names: tuple[str, ...] = (), student_names: tuple[str, ...] = (),
                           use_llm: bool = True, persist: bool = False) -> tuple[LessonReport, list[dict[str, Any]]]:
        """Проверка и отчёт по расшифровке урока целиком.

        Возвращает отчёт и список нарушений (кто, что, исходный и скрытый текст).
        В отчёт и в Claude попадает только текст со скрытыми контактами.
        """
        utterances = parse_transcript(text, tutor_names, student_names)
        guard = ConversationGuard(self.guard, window_seconds=10**9)  # в транскрипте время неизвестно — склеиваем подряд
        clean: list[Utterance] = []
        violations: list[dict[str, Any]] = []
        for i, u in enumerate(utterances):
            res = guard.check(u.speaker, u.text, ts=float(i), ref=i)
            if res.is_violation:
                violations.append({"index": i, "speaker": u.speaker, "role": u.role.value, **res.to_dict(),
                                   "original_text": u.text, "related_indexes": list(res.related_refs)})
            for ref in res.related_refs:
                if isinstance(ref, int) and 0 <= ref < len(clean):
                    clean[ref].text = "[сообщение скрыто: обнаружены контактные данные]"
            clean.append(Utterance(u.speaker, u.role, res.redacted_text if res.blocked else u.text, u.timestamp))

        owner = f"student:{student_id}" if student_id else None
        known = self.storage.known_words(owner) if owner else []
        lesson_id = None
        if persist:
            lesson = self.storage.create_lesson(student_id=student_id, title=title)
            lesson_id = lesson["id"]
            for u in clean:
                self.storage.add_message(lesson_id, None, u.speaker, u.role, u.text)
            for v in violations:
                self.storage.add_incident(lesson_id=lesson_id, chat_id=None, user_id=None, user_name=v["speaker"],
                                          role=Role(v["role"]), severity=v["severity"], action=v["action"],
                                          summary=v["summary"], original_text=v["original_text"],
                                          redacted_text=v["redacted_text"], findings=v["findings"])
        report = build_report(clean, self.settings, llm=self.llm if use_llm else None, known_words=known, title=title,
                              lesson_id=lesson_id, violations=len(violations))
        if persist and lesson_id:
            self.storage.add_words(owner or f"lesson:{lesson_id}", lesson_id, report.vocabulary)
            self.storage.save_report(lesson_id, report)
            self.storage.finish_lesson(lesson_id)
        return report, violations

    # -- запросы ----------------------------------------------------------------
    def words_today(self, owner: str) -> list[VocabItem]:
        today = datetime.now(self.settings.tz).date()
        return self.storage.words_on_day(owner, today, self.settings.tz)

    def answer_command(self, command: str, chat_id: str | None = None, owner: str | None = None) -> str:
        """Ответ на запрос по ключевым словам («новые слова сегодня», «дз», …)."""
        if command == "help":
            return HELP_TEXT
        active = self.storage.active_lesson(chat_id) if chat_id is not None else None
        if chat_id is not None:
            last = self.storage.last_lesson(chat_id=chat_id)
        elif owner and owner.startswith("student:"):  # личный чат ученика с ботом
            last = self.storage.last_lesson(student_id=owner.split(":", 1)[1])
        else:
            last = None
        # Словарь чата может принадлежать ученику прошлого урока и/или текущего — учитываем оба.
        owners = [owner] if owner else list(dict.fromkeys(self.owner_for(x) for x in (active, last) if x))

        if command == "words_today":
            if not owners:
                return "Пока нет ни одного урока."
            words = _merge_words(*(self.words_today(o) for o in owners))
            if active:  # слова идущего урока ещё не перенесены в словарь
                words = _merge_words(words, self.storage.lesson_words_live(active["id"]))
            return render.render_words(words, "Новые слова сегодня")
        if command == "words_all":
            if not owners:
                return "Словарь пока пуст."
            return render.render_words(_merge_words(*(self.storage.all_words(o) for o in owners)), "Ваш словарь")
        if command == "words_lesson":
            live = self.storage.lesson_words_live(active["id"]) if active else []
            if live:
                return render.render_words(live, "Новые слова (идёт урок)")
            if last:
                return render.render_words(self.storage.words_for_lesson(self.owner_for(last), last["id"]),
                                           "Новые слова прошлого урока")
            return render.render_words([], "Новые слова") if active else "Пока нет ни одного урока."

        report = self.storage.get_report(last["id"]) if last else None
        if command == "homework":
            if active:
                live = self.storage.lesson_homework_live(active["id"])
                if live:
                    return render.render_homework(live, [])
            if report:
                return render.render_homework(report.homework_teacher, report.homework_generated)
            return "Домашнее задание пока не задано."
        if report is None:
            return "Отчёт появится после завершения урока (/lesson_end)."
        if command == "test":
            return render.render_test(report.test, with_answers=False) + "\n\nНапишите «ответы», чтобы проверить себя."
        if command == "answers":
            return render.render_test(report.test, with_answers=True)
        if command == "summary":
            return render.render_summary(report)
        if command == "report":
            return render.render_report(report)
        return HELP_TEXT

    def handle_text_query(self, text: str, chat_id: str | None = None, owner: str | None = None) -> str | None:
        cmd = detect_command(text)
        return self.answer_command(cmd, chat_id=chat_id, owner=owner) if cmd else None


def _merge_words(*groups: list[VocabItem]) -> list[VocabItem]:
    seen: set[str] = set()
    out: list[VocabItem] = []
    for group in groups:
        for w in group:
            if w.key not in seen:
                seen.add(w.key)
                out.append(w)
    return out
