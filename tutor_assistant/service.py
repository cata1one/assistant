"""Сервисный слой: единая логика для Telegram-бота, HTTP API и консоли."""

from __future__ import annotations

import dataclasses
import inspect
import json
import logging
import secrets
import threading
import urllib.request
from collections.abc import Callable, Hashable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from . import render
from .commands import HELP_TEXT, detect_command
from .config import Settings
from .contact_guard import REDACTED_MESSAGE, ContactGuard, ConversationGuard, ModerationResult
from .homework import HomeworkCollector
from .llm import LLMClient
from .models import HomeworkTask, LessonReport, Role, Utterance, VocabItem
from .parent_report import parent_note
from .report import build_report
from .speech import AudioInput, Transcriber, Transcription, audio_duration, make_transcriber, segments_to_transcript
from .storage import Storage
from .transcript import parse_transcript
from .vocabulary import VocabularyCollector

log = logging.getLogger(__name__)

SPEECH_TAIL_CHARS = 120  # хвост предыдущего фрагмента речи – номер может разорваться на границе фрагментов


class LessonNotFound(LookupError):
    pass


@dataclass
class AudioOutcome:
    """Результат обработки фрагмента речи (голосовое сообщение или кусок записи урока)."""

    checked: bool  # удалось ли распознать речь и проверить её
    transcription: Transcription | None = None
    outcome: MessageOutcome | None = None
    moderation: ModerationResult | None = None
    incident_id: int | None = None
    error: str | None = None

    @property
    def text(self) -> str:
        return self.transcription.text if self.transcription else ""

    @property
    def blocked(self) -> bool:
        return bool(self.moderation and self.moderation.blocked)

    def to_dict(self) -> dict[str, Any]:
        return {
            "checked": self.checked,
            "transcript": self.text if not self.blocked else (self.moderation.redacted_text if self.moderation else ""),
            "language": self.transcription.language if self.transcription else None,
            "duration": self.transcription.duration if self.transcription else 0.0,
            "moderation": self.moderation.to_dict() if self.moderation else None,
            "incident_id": self.incident_id,
            "new_words": [w.model_dump() for w in self.outcome.new_words] if self.outcome else [],
            "new_homework": [h.model_dump() for h in self.outcome.new_homework] if self.outcome else [],
            "error": self.error,
        }


@dataclass
class MessageOutcome:
    lesson_id: str
    moderation: ModerationResult
    stored_text: str
    incident_id: int | None = None
    new_words: list[VocabItem] = field(default_factory=list)
    new_homework: list[HomeworkTask] = field(default_factory=list)
    parent_note: str | None = None  # реплика была заметкой для родителей (ученику не показывается)

    def to_dict(self) -> dict[str, Any]:
        return {
            "lesson_id": self.lesson_id,
            "parent_note": self.parent_note,
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
    speech_tail: dict[str, str] = field(default_factory=dict)


AlertHandler = Callable[[dict[str, Any]], None]


class TutorAssistant:
    def __init__(self, settings: Settings | None = None, storage: Storage | None = None, llm: LLMClient | None = None,
                 transcriber: Transcriber | None = None):
        self.settings = settings or Settings()
        self.storage = storage or Storage(self.settings.db_path)
        self.llm = llm if llm is not None else LLMClient(self.settings)
        self.transcriber = transcriber if transcriber is not None else make_transcriber(self.settings)
        self.guard = ContactGuard(self.settings)
        self._live: dict[str, _LiveState] = {}
        self._chat_guards: dict[str, ConversationGuard] = {}
        self._lock = threading.RLock()
        self.alert_handlers: list[AlertHandler] = []
        if self.settings.alert_webhook_url:
            self.alert_handlers.append(self._post_webhook)

    # -- нарушения и уведомления ----------------------------------------------
    def _incident(self, **fields: Any) -> int:
        incident_id = self.storage.add_incident(**fields)
        payload = {"id": incident_id, **{k: (v.value if isinstance(v, Role) else v) for k, v in fields.items()},
                   "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
        for handler in list(self.alert_handlers):
            try:
                handler(payload)
            except Exception:  # уведомление не должно ломать урок
                log.exception("Ошибка обработчика уведомлений")
        return incident_id

    def _post_webhook(self, payload: dict[str, Any]) -> None:
        self._send_webhook({"type": "incident", "incident": payload})

    def _send_webhook(self, body: dict[str, Any]) -> None:
        if not self.settings.alert_webhook_url:
            return

        def send() -> None:
            req = urllib.request.Request(self.settings.alert_webhook_url, method="POST",
                                         data=json.dumps(body, ensure_ascii=False, default=str).encode("utf-8"),
                                         headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=10):
                    pass
            except Exception as exc:
                log.warning("Не удалось отправить уведомление на %s: %s", self.settings.alert_webhook_url, exc)

        threading.Thread(target=send, daemon=True).start()

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
            incident_id = self._incident(
                lesson_id=None, chat_id=chat_id, user_id=user_id, user_name=user_name, role=Role.parse(role),
                severity=result.severity.name.lower(), action=result.action, summary=result.summary,
                original_text=text, redacted_text=result.redacted_text, findings=[f.to_dict() for f in result.findings])
        return result, incident_id

    # -- уроки ----------------------------------------------------------------
    def start_lesson(self, chat_id: str | None = None, tutor_id: str | None = None, tutor_name: str | None = None,
                     student_id: str | None = None, student_name: str | None = None,
                     title: str | None = None, require_recording: bool | None = None) -> dict[str, Any]:
        """Начать урок. С ``require_recording`` урок без записи (или с долгим перерывом) – нарушение."""
        if chat_id is not None:
            active = self.storage.active_lesson(chat_id)
            if active:
                return active
        lesson = self.storage.create_lesson(chat_id, tutor_id, tutor_name, student_id, student_name, title)
        required = self.settings.require_recording if require_recording is None else require_recording
        if required:
            self.storage.ensure_recording(lesson["id"], required=True)
        return lesson

    def lesson(self, lesson_id: str) -> dict[str, Any]:
        lesson = self.storage.get_lesson(lesson_id)
        if not lesson:
            raise LessonNotFound(lesson_id)
        return lesson

    def _state(self, lesson_id: str) -> _LiveState:
        with self._lock:
            st = self._live.get(lesson_id)
            if st is None:
                lang = self.lesson_language(self.storage.get_lesson(lesson_id) or {})
                st = _LiveState(ConversationGuard(self.guard), VocabularyCollector(lang),
                                HomeworkCollector())
                # После перезапуска восстанавливаем уже собранные слова и ДЗ, чтобы не было дублей.
                for w in self.storage.lesson_words_live(lesson_id):
                    st.words.add(w)
                st.homework.tasks.extend(self.storage.lesson_homework_live(lesson_id))
                self._live[lesson_id] = st
            return st

    @staticmethod
    def owner_for(lesson: dict[str, Any]) -> str:
        """Чей это словарь: ученика, а если он неизвестен – чата/урока."""
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
                        ts: float | None = None, context_text: str | None = None,
                        source: str = "text", moderate: bool = True) -> MessageOutcome:
        """Реплика урока: проверка, сохранение (без контактов), сбор слов и ДЗ.

        ``context_text`` – предыдущий фрагмент речи того же говорящего: номер,
        продиктованный на стыке двух фрагментов записи, проверяется целиком.
        """
        lesson = self.lesson(lesson_id)
        role_ = self.resolve_role(lesson, speaker_id, role)
        if role_ == Role.STUDENT and not lesson.get("student_id") and speaker_id is not None:
            self.storage.update_lesson(lesson_id, student_id=str(speaker_id), student_name=speaker_name)
        st = self._state(lesson_id)

        if not moderate:  # частный репетитор: переписка с его учеником не фильтруется
            result = self.guard.check("")
        else:
            with self._lock:
                result = st.guard.check(str(speaker_id or speaker_name or role_.value), text, ts=ts, ref=ref)
        if moderate and context_text and not result.blocked and not self.guard.check(context_text).blocked:
            joined = self.guard.check(f"{context_text} {text}")
            if joined.blocked:
                result = joined
                result.original_text = text
                result.redacted_text = REDACTED_MESSAGE
        stored = result.redacted_text if result.blocked else text
        note = parent_note(text) if role_ in (Role.TUTOR, Role.UNKNOWN) else None
        if note is None:  # заметка для родителей – не часть урока и не попадает в конспект ученика
            self.storage.add_message(lesson_id, None if speaker_id is None else str(speaker_id), speaker_name, role_,
                                     stored, source=source)

        incident_id = None
        if result.is_violation:
            incident_id = self._incident(
                lesson_id=lesson_id, chat_id=lesson.get("chat_id"), user_id=None if speaker_id is None else str(speaker_id),
                user_name=speaker_name, role=role_, severity=result.severity.name.lower(), action=result.action,
                summary=result.summary, original_text=text, redacted_text=result.redacted_text,
                findings=[f.to_dict() for f in result.findings],
            )

        if note is not None:
            if not result.blocked:
                self.storage.add_lesson_item(lesson_id, "note", {"text": note, "author": speaker_name})
            return MessageOutcome(lesson_id, result, stored, incident_id, parent_note=note)

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

    def lesson_language(self, lesson: dict[str, Any]) -> str:
        """Изучаемый язык урока: язык ученика из кабинета преподавателя, иначе – из настроек."""
        return self.storage.chat_language(lesson.get("chat_id")) or self.settings.target_language

    def _build_report(self, lesson: dict[str, Any], use_llm: bool) -> LessonReport:
        lesson_id = lesson["id"]
        settings = dataclasses.replace(self.settings, target_language=self.lesson_language(lesson))
        owner = self.owner_for(lesson)
        prev_lesson = self.storage.previous_finished_lesson(lesson)
        return build_report(
            self.storage.lesson_utterances(lesson_id), settings, llm=self.llm if use_llm else None,
            known_words=self.storage.known_words(owner, exclude_lesson=lesson_id), title=lesson.get("title"),
            lesson_id=lesson_id, violations=self.storage.incident_count(lesson_id=lesson_id),
            announced=self.storage.lesson_words_live(lesson_id), assigned=self.storage.lesson_homework_live(lesson_id),
            notes=self.lesson_notes(lesson_id),
            previous=self.storage.get_report(prev_lesson["id"]) if prev_lesson else None,
            lessons_before=self.storage.finished_lessons_count(lesson), student_name=lesson.get("student_name"),
        )

    def improve_report(self, lesson_id: str) -> LessonReport | None:
        """Доработка готового офлайн-отчёта ИИ (для медленных бесплатных моделей – в фоне после урока).

        Если преподаватель уже отредактировал отчёт, его правки не перезаписываются.
        """
        lesson = self.lesson(lesson_id)
        report = self._build_report(lesson, use_llm=True)
        current = self.storage.get_report(lesson_id)
        if current and "отредактировано преподавателем" in current.notes:
            if current.generated_by == "pending":  # правки преподавателя важнее – черновик больше не ждёт ИИ
                current.generated_by = "offline"
                self.storage.save_report(lesson_id, current)
            return None
        if report.generated_by == "offline" and current:  # ИИ не справился – оставляем офлайн-отчёт
            current.generated_by = "offline"
            current.notes = [*current.notes, *report.notes][-10:]
            self.storage.save_report(lesson_id, current)
            return None
        self.storage.add_words(self.owner_for(lesson), lesson_id, report.vocabulary)
        self.storage.save_report(lesson_id, report)
        return report

    def finish_lesson(self, lesson_id: str, use_llm: bool = True, ai_pending: bool = False) -> LessonReport:
        """Завершает урок и строит отчёт. ai_pending – отчёт пока офлайн, ИИ доработает его в фоне."""
        lesson = self.lesson(lesson_id)
        owner = self.owner_for(lesson)
        report = self._build_report(lesson, use_llm=use_llm)
        if ai_pending:
            report.generated_by = "pending"
        self.storage.add_words(owner, lesson_id, report.vocabulary)
        self.storage.save_report(lesson_id, report)
        self.storage.finish_lesson(lesson_id)
        with self._lock:
            self._live.pop(lesson_id, None)
        self._send_webhook({
            "type": "lesson_finished", "lesson_id": lesson_id, "chat_id": lesson.get("chat_id"),
            "student_id": lesson.get("student_id"), "student_report": render.render_student_report(report),
            "student_report_markdown": render.render_report_markdown(report),
            "parent_report": render.render_parent_report(report), "report": report.model_dump(),
        })
        return report

    # -- заметки преподавателя и родители ---------------------------------------
    def add_note(self, lesson_id: str, text: str, author_id: str | None = None,
                 author_name: str | None = None) -> tuple[bool, ModerationResult]:
        """Заметка преподавателя для родителей. С контактами не сохраняется: их нельзя передать и родителям."""
        lesson = self.lesson(lesson_id)
        result = self.guard.check(text)
        if result.is_violation:
            self._incident(lesson_id=lesson_id, chat_id=lesson.get("chat_id"), user_id=author_id, user_name=author_name,
                           role=Role.TUTOR, severity=result.severity.name.lower(), action=result.action,
                           summary=result.summary + " (в заметке для родителей)", original_text=text,
                           redacted_text=result.redacted_text, findings=[f.to_dict() for f in result.findings])
        if result.blocked or not text.strip():
            return False, result
        self.storage.add_lesson_item(lesson_id, "note", {"text": text.strip(), "author": author_name})
        return True, result

    def lesson_notes(self, lesson_id: str) -> list[str]:
        return [n["text"] for n in self.storage.lesson_items(lesson_id, "note")]

    def create_parent_invite(self, chat_id: str, student_name: str | None = None, created_by: str | None = None,
                             max_uses: int = 2) -> str:
        code = secrets.token_urlsafe(12)
        self.storage.create_parent_invite(code, chat_id, student_name, created_by, max_uses)
        return code

    def subscribe_parent(self, code: str, user_id: str) -> dict[str, Any] | None:
        return self.storage.use_parent_invite(code, user_id)

    def parent_report_for(self, user_id: str) -> list[tuple[str, LessonReport]]:
        """Последние отчёты по всем ученикам, на которых подписан родитель."""
        out = []
        for chat_id in self.storage.parent_chats(user_id):
            last = self.storage.last_lesson(chat_id=chat_id)
            report = self.storage.get_report(last["id"]) if last else None
            if report:
                out.append((chat_id, report))
        return out

    # -- речь и запись урока -------------------------------------------------
    @property
    def speech_available(self) -> bool:
        return self.transcriber.available

    def transcribe(self, audio: AudioInput, languages: tuple[str, ...] | None = None) -> tuple[Transcription | None, str | None]:
        if not self.transcriber.available:
            return None, self.transcriber.last_error or "распознавание речи недоступно"
        try:
            if languages and "allowed" in inspect.signature(self.transcriber.transcribe).parameters:
                return self.transcriber.transcribe(audio, allowed=languages), None
            return self.transcriber.transcribe(audio), None
        except Exception as exc:
            log.exception("Ошибка распознавания речи")
            return None, f"не удалось распознать речь: {exc}"

    def process_audio(self, lesson_id: str, speaker_id: str | None, speaker_name: str | None, audio: AudioInput,
                      role: Role | str | None = None, ref: Hashable | None = None, ts: float | None = None,
                      recording: bool = False, moderate: bool = True) -> AudioOutcome:
        """Фрагмент речи урока: распознать → проверить → сохранить в расшифровку урока.

        ``recording=True`` – фрагмент непрерывной записи урока (отмечается для контроля перерывов).
        """
        lesson = self.lesson(lesson_id)
        langs = tuple(dict.fromkeys([self.settings.native_language, self.lesson_language(lesson)]))
        transcription, error = self.transcribe(audio, languages=langs)
        if recording:
            self.storage.touch_recording(lesson_id, transcription.duration if transcription else audio_duration(audio))
        if transcription is None:
            return AudioOutcome(checked=False, error=error)
        if not transcription.text:
            return AudioOutcome(checked=True, transcription=transcription)
        st = self._state(lesson_id)
        tail_key = str(speaker_id or speaker_name or role or "")
        with self._lock:
            tail = st.speech_tail.get(tail_key)
        outcome = self.process_message(lesson_id, speaker_id, speaker_name, transcription.text, role=role, ref=ref,
                                       ts=ts, context_text=tail, source="speech", moderate=moderate)
        with self._lock:
            st.speech_tail[tail_key] = "" if outcome.moderation.blocked else transcription.text[-SPEECH_TAIL_CHARS:]
        return AudioOutcome(checked=True, transcription=transcription, outcome=outcome, moderation=outcome.moderation,
                            incident_id=outcome.incident_id)

    def moderate_chat_audio(self, chat_id: str, user_id: str | None, user_name: str | None, audio: AudioInput,
                            role: Role | str | None = None, ref: Hashable | None = None,
                            ts: float | None = None) -> AudioOutcome:
        """Голосовое сообщение вне урока: распознать и проверить на контакты."""
        transcription, error = self.transcribe(audio)
        if transcription is None:
            return AudioOutcome(checked=False, error=error)
        if not transcription.text:
            return AudioOutcome(checked=True, transcription=transcription)
        result, incident_id = self.moderate_chat_message(chat_id, user_id, user_name, transcription.text, role=role,
                                                         ref=ref, ts=ts)
        return AudioOutcome(checked=True, transcription=transcription, moderation=result, incident_id=incident_id)

    def recording_status(self, lesson_id: str, now: datetime | None = None) -> dict[str, Any]:
        rec = self.storage.get_recording(lesson_id)
        if not rec:
            return {"required": False, "active": False, "chunks": 0, "seconds": 0.0, "last_chunk_at": None}
        now = now or datetime.now(timezone.utc)
        ref = rec["last_chunk_at"] or rec["started_at"]
        idle = (now - datetime.fromisoformat(ref)).total_seconds()
        return {"required": bool(rec["required"]), "active": bool(rec["last_chunk_at"])
                and idle <= self.settings.recording_gap_seconds, "chunks": rec["chunks"],
                "seconds": round(rec["seconds"], 1), "last_chunk_at": rec["last_chunk_at"], "idle_seconds": round(idle)}

    def check_recording_gaps(self, now: datetime | None = None) -> list[dict[str, Any]]:
        """Найти идущие уроки, где запись не включили или она прервалась. Каждый перерыв – одно нарушение."""
        now = now or datetime.now(timezone.utc)
        found = []
        for rec in self.storage.active_recordings():
            if not rec["required"] and not rec["chunks"]:
                continue
            ref = rec["last_chunk_at"] or rec["started_at"]
            gap = (now - datetime.fromisoformat(ref)).total_seconds()
            if gap < self.settings.recording_gap_seconds or not self.storage.claim_gap_alert(rec["lesson_id"], ref, now):
                continue
            never = not rec["chunks"]
            summary = (f"запись урока не включена ({int(gap)} с с начала урока)" if never
                       else f"запись урока прервана: нет звука {int(gap)} с")
            incident_id = self._incident(
                lesson_id=rec["lesson_id"], chat_id=rec["chat_id"], user_id=rec["tutor_id"], user_name=rec["tutor_name"],
                role=Role.TUTOR, severity="medium", action="warn", summary=summary,
                original_text=f"[{summary}]", redacted_text=f"[{summary}]",
                findings=[{"kind": "recording_gap", "severity": "medium", "value": str(int(gap)), "reason": summary,
                           "span": None}])
            found.append({"lesson_id": rec["lesson_id"], "chat_id": rec["chat_id"], "tutor_id": rec["tutor_id"],
                          "student_id": rec["student_id"], "title": rec["title"], "gap_seconds": int(gap),
                          "never_started": never, "summary": summary, "incident_id": incident_id})
        return found

    def analyze_audio(self, audio: AudioInput, title: str | None = None, student_id: str | None = None,
                      use_llm: bool = True, persist: bool = False) -> tuple[LessonReport, list[dict[str, Any]], str]:
        """Запись урока целиком (mp3, m4a, ogg, wav, mp4, webm): расшифровка → проверка → отчёт."""
        transcription, error = self.transcribe(audio)
        if transcription is None:
            raise RuntimeError(error or "распознавание речи недоступно")
        transcript = segments_to_transcript(transcription.segments)
        if not transcript:
            raise RuntimeError("в записи не найдено речи")
        report, violations = self.analyze_transcript(transcript, title=title, student_id=student_id, use_llm=use_llm,
                                                     persist=persist)
        report.notes.append("Отчёт построен по аудиозаписи урока; говорящие в записи не разделяются.")
        return report, violations, transcript

    # -- разбор готовой расшифровки -----------------------------------------
    def analyze_transcript(self, text: str, title: str | None = None, student_id: str | None = None,
                           tutor_names: tuple[str, ...] = (), student_names: tuple[str, ...] = (),
                           use_llm: bool = True, persist: bool = False) -> tuple[LessonReport, list[dict[str, Any]]]:
        """Проверка и отчёт по расшифровке урока целиком.

        Возвращает отчёт и список нарушений (кто, что, исходный и скрытый текст).
        В отчёт и в Claude попадает только текст со скрытыми контактами.
        """
        utterances = parse_transcript(text, tutor_names, student_names)
        guard = ConversationGuard(self.guard, window_seconds=10**9)  # в транскрипте время неизвестно – склеиваем подряд
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
                self._incident(lesson_id=lesson_id, chat_id=None, user_id=None, user_name=v["speaker"],
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
        # Словарь чата может принадлежать ученику прошлого урока и/или текущего – учитываем оба.
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
