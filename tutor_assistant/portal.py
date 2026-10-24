"""Личный кабинет на сайте школы: материалы уроков, тест, словарь, доска, заявки.

Доступ – по одноразово выданной ботом ссылке (команда /cabinet). В базе хранится
только хеш токена. Каждый видит только свои пары и уроки, причём в своей роли:

* ученик – конспект, слова, тест (ответы проверяет сервер) и ДЗ;
* родитель – отчёт об успехах;
* преподаватель – полный отчёт;
* администратор школы – ещё и заявки с сайта и ссылки на классы ProgressMe.

Контакты участников на сайт не попадают: в кабинете только имена из пары.
"""

from __future__ import annotations

import hashlib
import json
import logging
import queue
import re
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from . import catalog, render
from .mailer import Mailer
from .models import HOMEWORK_STATUS_RU, LessonReport, Role, word_key
from .relay import STUDENT, TUTOR, Pair
from .service import TutorAssistant

log = logging.getLogger(__name__)

PARENT = "parent"
ADMIN = "admin"
ROLE_RU = {TUTOR: "преподаватель", STUDENT: "ученик", PARENT: "родитель", ADMIN: "администратор"}

APPLICATION_STATUSES = ("new", "in_progress", "done", "rejected")
APPLICATIONS_PER_HOUR = 5  # с одного IP
BOARD_ITEM_LIMIT = 50000
BOARD_KINDS = ("stroke", "shape", "text", "erase", "clear", "obj", "del")
# Доска v2: объекты с id, которые можно двигать, менять и удалять (последняя версия объекта побеждает)
OBJ_TYPES = ("stroke", "shape", "text", "note", "sticker", "image", "video", "file", "link")
OID_RE = re.compile(r"^[\w-]{4,32}$")
FILE_SRC_RE = re.compile(r"^/site/v1/files/[0-9a-f]{24}$")
STICKER_RE = re.compile(r"^[\w-]{1,40}$")
SHAPES = ("line", "rect", "ellipse", "arrow")
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
BOARD_W, BOARD_H = 1600, 1000


class PortalError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


@dataclass(frozen=True)
class Viewer:
    user_id: str
    admin: bool


@dataclass(frozen=True)
class Access:
    """Чат (пара или группа), к которому у человека есть доступ, и его роль там."""

    chat_id: str
    role: str
    title: str
    pair: Pair | None = None

    def to_dict(self, classroom: str | None, bot_username: str | None) -> dict[str, Any]:
        data: dict[str, Any] = {"chat_id": self.chat_id, "role": self.role, "role_ru": ROLE_RU[self.role],
                                "title": self.title, "classroom_url": classroom}
        if self.pair:
            data["pair_id"] = self.pair.id
            if self.role in (TUTOR, STUDENT):
                data["me"] = self.pair.alias(self.role)
                data["with"] = self.pair.alias(self.pair.other_role(self.role))
            # Писать собеседнику можно только через бота: прямой ссылки на аккаунт нет ни у кого.
            if bot_username and self.role in (TUTOR, STUDENT):
                data["chat_url"] = f"https://t.me/{bot_username}"
        return data


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def normalize_answer(text: str) -> str:
    t = (text or "").lower().replace("ё", "е").replace("’", "'")
    t = re.sub(r"[\s.,;:!?\"«»()]+", " ", t)
    return t.strip()


def valid_classroom_url(url: str, domains: tuple[str, ...]) -> bool:
    try:
        parsed = urllib.parse.urlparse(url.strip())
    except ValueError:
        return False
    host = (parsed.hostname or "").lower()
    return (parsed.scheme == "https" and bool(host)
            and any(host == d or host.endswith("." + d) for d in domains))


class Portal:
    def __init__(self, assistant: TutorAssistant):
        self.assistant = assistant
        self.storage = assistant.storage
        self.settings = assistant.settings
        self.application_handlers: list[Any] = []
        self.telegram_send: Any = None  # подменяется в тестах; по умолчанию – Bot API через очередь
        self.mailer = Mailer(self.settings)

    def telegram(self, chat_id: str | None, text: str) -> bool:
        """Сообщение в Telegram без запущенного бота. False – некуда или нечем отправить."""
        if not chat_id:
            return False
        if str(chat_id).startswith("a_"):  # аккаунт сайта: в Telegram – только если он привязан
            acc = self.storage.get_account(str(chat_id))
            chat_id = acc.get("tg_user_id") if acc else None
            if not chat_id:
                return False
        if self.telegram_send is not None:
            self.telegram_send(str(chat_id), text)
            return True
        if not self.settings.telegram_token:
            return False
        send_telegram_async(self.settings.telegram_token, str(chat_id), text)
        return True

    def notify_account(self, user_id: str | None, subject: str, text: str) -> None:
        """Уведомление человеку: письмо на почту аккаунта и сообщение в Telegram, если он его привязал."""
        acc = self.storage.get_account(user_id) if user_id and user_id.startswith("a_") else None
        if acc:
            self.mailer.send(acc["email"], subject, text, reply_to=self.settings.support_email)
        self.telegram(user_id, f"{subject}\n\n{text}")

    def notify_admin(self, text: str) -> None:
        self.telegram(self.settings.admin_chat_id or None, text)

    def notify_violation(self, chat_id: str, text: str) -> None:
        """Нарушение в паре: администратору платформы и владельцу школы, если репетитор работает в школе."""
        self.notify_admin(text)
        org = self.org_of(self._pair_of(chat_id))
        if org:
            self.telegram(org["owner_id"], text)

    def org_of(self, pair: Pair | None) -> dict[str, Any] | None:
        """Школа, в которой работает преподаватель пары (None – частный репетитор или пара из бота)."""
        if not pair or not pair.tutor_user_id or not pair.tutor_user_id.startswith("a_"):
            return None
        tutor = self.storage.get_account(pair.tutor_user_id)
        return self.storage.get_org(tutor.get("org_id")) if tutor else None

    # -- доступ -----------------------------------------------------------------
    def issue_token(self, user_id: str, admin: bool = False) -> str:
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(days=max(1, self.settings.access_token_days))
        self.storage.purge_access_tokens()
        self.storage.add_access_token(hash_token(token), ADMIN if admin else "user", str(user_id), expires)
        return token

    def cabinet_link(self, token: str) -> str | None:
        if not self.settings.site_url:
            return None
        return f"{self.settings.site_url}/#/cabinet?t={token}"

    def viewer(self, token: str | None) -> Viewer:
        if not token or len(token) > 200:
            raise PortalError(401, "нужна ссылка в личный кабинет: отправьте боту школы команду /cabinet")
        row = self.storage.get_access_token(hash_token(token.strip()))
        if not row:
            raise PortalError(401, "ссылка устарела – получите новую командой /cabinet в боте школы")
        admin = row["role"] == ADMIN and row["user_id"] in self.settings.admin_user_ids
        return Viewer(row["user_id"], admin)

    def logout(self, viewer: Viewer) -> None:
        self.storage.revoke_access_tokens(viewer.user_id)

    def accesses(self, viewer: Viewer) -> list[Access]:
        out: dict[str, Access] = {}
        for row in self.storage.pairs_for_user(viewer.user_id):
            pair = Pair.from_row(row)
            role = pair.role_of(viewer.user_id)
            if role:
                title = pair.alias(pair.other_role(role))
                out.setdefault(pair.chat_id, Access(pair.chat_id, role, title, pair))
        for chat_id in self.storage.parent_chats(viewer.user_id):
            if chat_id in out:
                continue
            pair = self._pair_of(chat_id)
            if pair and not pair.active:
                continue
            title = pair.student_alias if pair else (self._student_name(chat_id) or "Ученик")
            out[chat_id] = Access(chat_id, PARENT, title, pair)
        acc = self.storage.get_account(viewer.user_id) if viewer.user_id.startswith("a_") else None
        if acc and acc["role"] == "school" and acc.get("org_id"):
            tutors = [t["id"] for t in self.storage.org_accounts(acc["org_id"], "tutor")]
            for row in self.storage.pairs_of_tutors(tutors):
                pair = Pair.from_row(row)
                out.setdefault(pair.chat_id, Access(pair.chat_id, ADMIN, f"{pair.tutor_alias} ↔ {pair.student_alias}",
                                                    pair))
        if viewer.admin:
            for row in self.storage.list_pairs(limit=500):
                pair = Pair.from_row(row)
                out.setdefault(pair.chat_id, Access(pair.chat_id, ADMIN, f"{pair.tutor_alias} ↔ {pair.student_alias}",
                                                    pair))
        return list(out.values())

    def is_strict(self, chat_id: str) -> bool:
        """Фильтровать ли контакты: частный репетитор – нет, репетитор школы – по настройке школы,
        пары школы из Telegram-бота – всегда."""
        pair = self._pair_of(chat_id)
        if not pair or not pair.tutor_user_id:
            return True
        tutor = self.storage.get_account(pair.tutor_user_id) if pair.tutor_user_id.startswith("a_") else None
        if not tutor:
            return True
        org = self.storage.get_org(tutor.get("org_id"))
        return bool(org and org["filter_contacts"])

    def _pair_of(self, chat_id: str) -> Pair | None:
        if not chat_id.startswith("pair:"):
            return None
        row = self.storage.get_pair(chat_id.split(":", 1)[1])
        return Pair.from_row(row) if row else None

    def _student_name(self, chat_id: str) -> str | None:
        last = self.storage.last_lesson(chat_id=chat_id)
        return last.get("student_name") if last else None

    def _access(self, viewer: Viewer, chat_id: str) -> Access:
        for a in self.accesses(viewer):
            if a.chat_id == chat_id:
                return a
        raise PortalError(404, "не найдено")

    # -- кабинет ------------------------------------------------------------------
    def me(self, viewer: Viewer) -> dict[str, Any]:
        accesses = self.accesses(viewer)
        chats = [{**a.to_dict(self.storage.get_classroom(a.chat_id), self.settings.bot_username or None),
                  "language": self.storage.chat_language(a.chat_id) or self.settings.target_language} for a in accesses]
        lessons = self.storage.lessons_for_chats([a.chat_id for a in accesses], limit=200)
        by_chat = {a.chat_id: a for a in accesses}
        items = []
        for lesson in lessons:
            report = self.storage.get_report(lesson["id"]) if lesson["status"] == "finished" else None
            held = report is not None and by_chat[lesson["chat_id"]].role != TUTOR and not self.storage.report_published(lesson["id"])
            if held:  # преподаватель ещё проверяет конспект, ученик и родитель его пока не видят
                report = None
            items.append({
                "id": lesson["id"], "chat_id": lesson["chat_id"], "role": by_chat[lesson["chat_id"]].role,
                "title": lesson.get("title") or (report.topic if report else None) or "Урок",
                "status": lesson["status"], "started_at": lesson["started_at"],
                "has_report": report is not None,
                "words": len(report.vocabulary) if report else 0,
            })
        teacher = self.storage.get_teacher(viewer.user_id)
        is_tutor = any(a.role == TUTOR for a in accesses)
        unread = sum(self.storage.unread_count(a.chat_id, viewer.user_id, a.role) for a in accesses
                     if a.role in (TUTOR, STUDENT))
        return {"admin": viewer.admin, "chats": chats, "lessons": items, "school_name": self.settings.school_name,
                "teacher_status": "approved" if is_tutor or viewer.admin else (teacher["status"] if teacher else None),
                "is_parent": any(a.role == PARENT for a in accesses), "unread": unread}

    def lesson(self, viewer: Viewer, lesson_id: str) -> dict[str, Any]:
        lesson, access = self._lesson_access(viewer, lesson_id)
        report = self.storage.get_report(lesson_id)
        base = {"id": lesson_id, "role": access.role, "status": lesson["status"], "started_at": lesson["started_at"],
                "title": lesson.get("title"), "with": access.title}
        if report is None:
            return {**base, "report": None}
        published = self.storage.report_published(lesson_id)
        if access.role != TUTOR and not published:
            return {**base, "report": None, "on_review": True}
        base["published"] = published
        base["generated_by"] = report.generated_by  # pending – ИИ ещё готовит конспект
        if access.role == STUDENT:
            return {**base, "report": student_view(report)}
        if access.role == PARENT:
            return {**base, "report": parent_view(report)}
        return {**base, "report": report.model_dump(), "text": render.render_report(report)}

    def _lesson_access(self, viewer: Viewer, lesson_id: str) -> tuple[dict[str, Any], Access]:
        lesson = self.storage.get_lesson(lesson_id)
        if not lesson or not lesson.get("chat_id"):
            raise PortalError(404, "урок не найден")
        return lesson, self._access(viewer, lesson["chat_id"])

    def check_test(self, viewer: Viewer, lesson_id: str, answers: Any) -> dict[str, Any]:
        _, access = self._lesson_access(viewer, lesson_id)
        report = self.storage.get_report(lesson_id)
        if report is not None and access.role != TUTOR and not self.storage.report_published(lesson_id):
            report = None
        if report is None or not report.test:
            raise PortalError(404, "тест появится после урока")
        if not isinstance(answers, list) or len(answers) > len(report.test):
            raise PortalError(400, "answers – список ответов по порядку вопросов")
        results = []
        for i, q in enumerate(report.test):
            given = answers[i] if i < len(answers) and isinstance(answers[i], str) else ""
            ok = bool(given.strip()) and _answer_ok(given, q.answer)
            results.append({"index": i, "correct": ok, "answer": q.answer, "explanation": q.explanation})
        score = sum(r["correct"] for r in results)
        return {"score": score, "total": len(results), "results": results}

    def words(self, viewer: Viewer, chat_id: str | None = None) -> dict[str, Any]:
        accesses = [self._access(viewer, chat_id)] if chat_id else self.accesses(viewer)
        owners: list[str] = []
        for a in accesses:
            if a.role == ADMIN and not chat_id:
                continue
            for lesson in self.storage.lessons_for_chats([a.chat_id], limit=500):
                owner = self.assistant.owner_for(lesson)
                if owner not in owners:
                    owners.append(owner)
        seen: set[str] = set()
        words = []
        hidden_lessons: set[str] = set()  # слова непроверенных конспектов ученику пока не показываем
        for a in accesses:
            if a.role in (STUDENT, PARENT):
                hidden_lessons |= {x["id"] for x in self.storage.lessons_for_chats([a.chat_id], limit=500)
                                   if x["status"] == "finished" and not self.storage.report_published(x["id"])
                                   and self.storage.get_report(x["id"]) is not None}
        for owner in owners:
            origin = self.storage.word_lessons(owner) if hidden_lessons else {}
            for w in self.storage.all_words(owner):
                if origin.get(w.key) in hidden_lessons:
                    continue
                if w.key not in seen:
                    seen.add(w.key)
                    words.append(w.model_dump())
        return {"count": len(words), "words": words}

    # -- класс на ProgressMe --------------------------------------------------------
    def set_classroom(self, chat_id: str, url: str | None, updated_by: str | None) -> None:
        if url is not None and not valid_classroom_url(url, self.settings.classroom_domains):
            raise PortalError(400, "ссылка на класс должна вести на " + ", ".join(self.settings.classroom_domains)
                              + " и начинаться с https://")
        self.storage.set_classroom(chat_id, url.strip() if url else None, updated_by)

    def admin_set_classroom(self, viewer: Viewer, chat_id: str, url: str | None) -> dict[str, Any]:
        if not viewer.admin:
            raise PortalError(403, "доступно администраторам школы")
        if not self._pair_of(chat_id):
            raise PortalError(404, "пара не найдена")
        self.set_classroom(chat_id, url, viewer.user_id)
        return {"chat_id": chat_id, "classroom_url": self.storage.get_classroom(chat_id)}

    # -- доска -----------------------------------------------------------------------
    def boards(self, viewer: Viewer) -> dict[str, Any]:
        out = []
        for a in self.accesses(viewer):
            if a.role == PARENT:
                continue
            for b in self.storage.boards_for(a.chat_id):
                out.append({**b, "with": a.title, "role": a.role})
        return {"boards": out, "chats": [{"chat_id": a.chat_id, "title": a.title, "role": a.role}
                                         for a in self.accesses(viewer) if a.role != PARENT]}

    def create_board(self, viewer: Viewer, chat_id: str, title: str | None) -> dict[str, Any]:
        access = self._access(viewer, chat_id)
        if access.role not in (TUTOR, ADMIN):
            raise PortalError(403, "доску создаёт преподаватель")
        from .billing import require_active

        require_active(self.storage, viewer.user_id)
        clean = (title or "").strip()[:80] or "Доска"
        verdict = self.assistant.moderate(clean)
        if verdict.is_violation:
            raise PortalError(422, "в названии не должно быть контактов")
        if len(self.storage.boards_for(chat_id)) >= 50:
            raise PortalError(409, "слишком много досок у этой пары")
        return self.storage.create_board(secrets.token_hex(6), chat_id, clean, viewer.user_id)

    def _board_access(self, viewer: Viewer, board_id: str) -> tuple[dict[str, Any], Access]:
        board = self.storage.get_board(board_id)
        if not board:
            raise PortalError(404, "доска не найдена")
        access = self._access(viewer, board["chat_id"])
        if access.role == PARENT:
            raise PortalError(403, "доска доступна преподавателю и ученику")
        return board, access

    def board_items(self, viewer: Viewer, board_id: str, since: int = 0) -> dict[str, Any]:
        board, access = self._board_access(viewer, board_id)
        items = self.storage.board_items(board_id, since=max(0, since))
        return {"board": board, "role": access.role, "items": items,
                "last_id": items[-1]["id"] if items else max(0, since)}

    def add_board_item(self, viewer: Viewer, board_id: str, body: Any) -> dict[str, Any]:
        board, access = self._board_access(viewer, board_id)
        if not isinstance(body, dict):
            raise PortalError(400, "нужен JSON-объект")
        kind = body.get("kind")
        if kind not in BOARD_KINDS:
            raise PortalError(400, "kind: " + ", ".join(BOARD_KINDS))
        if kind == "clear" and access.role not in (TUTOR, ADMIN):
            raise PortalError(403, "очистить доску может преподаватель")
        if self.storage.board_item_count(board_id) >= BOARD_ITEM_LIMIT:
            raise PortalError(409, "доска заполнена – создайте новую")
        data = _validate_obj(body.get("data") or {}) if kind == "obj" else _validate_item(kind, body.get("data") or {})
        text = data.get("text") if kind == "text" else _obj_text(data) if kind == "obj" else None
        warning = None
        if text and self.is_strict(board["chat_id"]):
            result, _ = self.assistant.moderate_chat_message(
                f"board:{board_id}", viewer.user_id, access.pair.alias(access.role) if access.pair and access.role in
                (TUTOR, STUDENT) else None, text, role=_lesson_role(access.role))
            if result.blocked:
                raise PortalError(422, "на доске нельзя оставлять контакты: " + result.summary
                                  + ". Нарушение передано администратору школы.")
            warning = result.warning
        item_id = self.storage.add_board_item(board_id, access.role, kind, data)
        return {"id": item_id, "warning": warning}

    # -- заявки с сайта -----------------------------------------------------------------
    def submit_application(self, body: Any, ip: str | None) -> dict[str, Any]:
        if not isinstance(body, dict):
            raise PortalError(400, "нужен JSON-объект")
        if body.get("website"):  # скрытое поле-ловушка для ботов
            return {"ok": True, "id": None}
        name = _field(body, "name", 80, required=True)
        contact = _field(body, "contact", 120, required=True)
        if not re.search(r"\d{5,}|@|\w{3,}", contact.replace(" ", "")):
            raise PortalError(400, "укажите телефон, Telegram или почту для связи с менеджером школы")
        course_id = _field(body, "course_id", 60)
        if course_id and course_id not in catalog.course_ids():
            raise PortalError(400, "неизвестное направление")
        if not body.get("consent"):
            raise PortalError(400, "нужно согласие на обработку персональных данных")
        if ip and self.storage.applications_since(ip, datetime.now(timezone.utc) - timedelta(hours=1)) \
                >= APPLICATIONS_PER_HOUR:
            raise PortalError(429, "слишком много заявок – попробуйте позже")
        app_id = self.storage.add_application(name=name, contact=contact, course_id=course_id,
                                              level=_field(body, "level", 40), goal=_field(body, "goal", 300),
                                              comment=_field(body, "comment", 1000), ip=ip)
        application = {"id": app_id, "name": name, "contact": contact, "course_id": course_id,
                       "level": _field(body, "level", 40), "goal": _field(body, "goal", 300),
                       "comment": _field(body, "comment", 1000)}
        self._notify_application(application)
        return {"ok": True, "id": app_id}

    def _notify_application(self, application: dict[str, Any]) -> None:
        course = next((c["title"] for c in catalog.COURSES if c["id"] == application.get("course_id")), "не выбрано")
        text = (f"📝 Заявка с сайта #{application['id']}\nИмя: {application['name']}\n"
                f"Связь: {application['contact']}\nНаправление: {course}"
                + (f"\nУровень: {application['level']}" if application.get("level") else "")
                + (f"\nЦель: {application['goal']}" if application.get("goal") else "")
                + (f"\nКомментарий: {application['comment']}" if application.get("comment") else ""))
        self.notify_admin(text)
        self.assistant._send_webhook({"type": "application", "application": application})
        for handler in list(self.application_handlers):
            try:
                handler(application)
            except Exception:
                log.exception("Ошибка обработчика заявок")

    def applications(self, viewer: Viewer, status: str | None = None) -> dict[str, Any]:
        if not viewer.admin:
            raise PortalError(403, "доступно администраторам школы")
        if status and status not in APPLICATION_STATUSES:
            raise PortalError(400, "status: " + ", ".join(APPLICATION_STATUSES))
        rows = self.storage.applications(status)
        for r in rows:
            r.pop("ip", None)
        return {"applications": rows}

    def set_application_status(self, viewer: Viewer, app_id: int, status: Any) -> dict[str, Any]:
        if not viewer.admin:
            raise PortalError(403, "доступно администраторам школы")
        if status not in APPLICATION_STATUSES:
            raise PortalError(400, "status: " + ", ".join(APPLICATION_STATUSES))
        if not self.storage.set_application_status(app_id, status):
            raise PortalError(404, "заявка не найдена")
        return {"id": app_id, "status": status}


# -- представления отчёта -------------------------------------------------------------
def student_view(report: LessonReport) -> dict[str, Any]:
    """Конспект ученика: всё, кроме ответов к тесту (их проверяет сервер)."""
    data = report.model_dump(include={"lesson_id", "title", "date", "target_language", "topic", "summary",
                                      "key_points", "rules", "vocabulary", "corrections", "homework_teacher",
                                      "homework_generated", "review_items", "progress"})
    data["test"] = [{"kind": q.kind, "question": q.question, "options": q.options} for q in report.test]
    return data


def parent_view(report: LessonReport) -> dict[str, Any]:
    return {
        "date": report.date, "topic": report.topic, "title": report.title,
        "parent": report.parent.model_dump(),
        "homework_status_ru": HOMEWORK_STATUS_RU.get(report.parent.homework_status, ""),
        "homework": [h.text for h in report.homework],
        "words": [w.word for w in report.vocabulary],
        "progress": report.progress.model_dump() if report.progress else None,
        "text": render.render_parent_report(report),
    }


def _answer_ok(given: str, expected: str) -> bool:
    g, e = normalize_answer(given), normalize_answer(expected)
    if not g or not e:
        return False
    if g == e or word_key(g) == word_key(e):
        return True
    # Варианты через «/»: «there is / there's»
    return any(normalize_answer(x) == g for x in re.split(r"\s*/\s*", expected) if x.strip())


def _lesson_role(role: str) -> Role:
    return Role.TUTOR if role == TUTOR else Role.STUDENT if role == STUDENT else Role.UNKNOWN


def _field(body: dict[str, Any], key: str, max_len: int, required: bool = False) -> str | None:
    value = body.get(key)
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise PortalError(400, f"заполните поле «{key}»")
        return None
    if not isinstance(value, str):
        raise PortalError(400, f"поле «{key}» должно быть строкой")
    value = " ".join(value.split()) if key != "comment" else value.strip()
    if len(value) > max_len:
        raise PortalError(400, f"поле «{key}» слишком длинное")
    return value


def _lines(body: dict[str, Any], key: str, max_len: int, required: bool = False) -> str | None:
    """Как _field, но сохраняет переносы строк (задания, списки слов)."""
    value = body.get(key)
    if value is not None and not isinstance(value, str):
        raise PortalError(400, f"поле «{key}» должно быть строкой")
    text = "\n".join(" ".join(ln.split()) for ln in (value or "").strip().splitlines()).strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    if not text:
        if required:
            raise PortalError(400, f"заполните поле «{key}»")
        return None
    if len(text) > max_len:
        raise PortalError(400, f"поле «{key}» слишком длинное")
    return text


def _num(v: Any, lo: float, hi: float) -> float:
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v:  # NaN
        raise PortalError(400, "координаты и размеры – числа")
    return round(min(hi, max(lo, float(v))), 1)


def _point(p: Any) -> list[float]:
    if not isinstance(p, (list, tuple)) or len(p) != 2:
        raise PortalError(400, "точка – пара чисел [x, y]")
    return [_num(p[0], 0, BOARD_W), _num(p[1], 0, BOARD_H)]


def _color(v: Any) -> str:
    if not isinstance(v, str) or not COLOR_RE.match(v):
        raise PortalError(400, "цвет в формате #rrggbb")
    return v.lower()


def _obj_text(data: dict[str, Any]) -> str | None:
    parts = [data.get(k) for k in ("text", "title") if isinstance(data.get(k), str)]
    return " ".join(parts) or None


def _validate_obj(data: Any) -> dict[str, Any]:
    """Объект доски v2. Координаты – в «мировых» единицах бесконечного холста."""
    if not isinstance(data, dict):
        raise PortalError(400, "data должно быть объектом")
    oid, typ = data.get("oid"), data.get("type")
    if not isinstance(oid, str) or not OID_RE.match(oid):
        raise PortalError(400, "oid – 4–32 символа")
    if typ not in OBJ_TYPES:
        raise PortalError(400, "type: " + ", ".join(OBJ_TYPES))
    out: dict[str, Any] = {"oid": oid, "type": typ, "x": _num(data.get("x", 0), -100000, 100000),
                           "y": _num(data.get("y", 0), -100000, 100000), "w": _num(data.get("w", 100), 1, 40000),
                           "h": _num(data.get("h", 100), 1, 40000), "rot": _num(data.get("rot", 0), -360, 360),
                           "z": int(_num(data.get("z", 0), 0, 1e12))}
    if typ in ("stroke", "shape", "text", "note"):
        out["color"] = _color(data.get("color", "#1f2937"))
    if typ == "stroke":
        pts = data.get("points")
        if not isinstance(pts, list) or not 1 <= len(pts) <= 5000:
            raise PortalError(400, "линия: от 1 до 5000 точек")
        out["points"] = [[_num(p[0], -40000, 40000), _num(p[1], -40000, 40000)] if isinstance(p, (list, tuple))
                         and len(p) == 2 else _point(p) for p in pts]
        out["width"] = _num(data.get("width", 3), 1, 80)
        out["marker"] = bool(data.get("marker"))
    elif typ == "shape":
        if data.get("shape") not in SHAPES:
            raise PortalError(400, "shape: " + ", ".join(SHAPES))
        out["shape"] = data["shape"]
        out["width"] = _num(data.get("width", 3), 1, 80)
        out["fill"] = _color(data["fill"]) if data.get("fill") else None
        pts = data.get("points")
        if data["shape"] in ("line", "arrow") and isinstance(pts, list) and len(pts) == 2:
            out["points"] = [[_num(p[0], -40000, 40000), _num(p[1], -40000, 40000)] for p in pts
                             if isinstance(p, (list, tuple)) and len(p) == 2]
    elif typ in ("text", "note"):
        text = data.get("text", "")
        if not isinstance(text, str) or len(text) > 1000:
            raise PortalError(400, "текст: до 1000 символов")
        out["text"] = text
        out["size"] = _num(data.get("size", 24), 8, 240)
    elif typ == "sticker":
        sticker = data.get("sticker")
        if not isinstance(sticker, str) or not (STICKER_RE.match(sticker) or FILE_SRC_RE.match(sticker)):
            raise PortalError(400, "неизвестный стикер")
        out["sticker"] = sticker
    elif typ in ("image", "file"):
        src = data.get("src")
        if not isinstance(src, str) or not FILE_SRC_RE.match(src):
            raise PortalError(400, "картинки и файлы – только из материалов платформы")
        out["src"] = src
        title = data.get("title", "")
        out["title"] = title[:120] if isinstance(title, str) else ""
        crop = data.get("crop")  # обрезка картинки: [x, y, ширина, высота] в долях исходника
        if typ == "image" and crop is not None:
            if not isinstance(crop, list) or len(crop) != 4 or not all(
                    isinstance(c, (int, float)) and not isinstance(c, bool) and c == c for c in crop):
                raise PortalError(400, "обрезка – четыре числа")
            x, y = min(0.98, max(0.0, crop[0])), min(0.98, max(0.0, crop[1]))
            w, h = min(1 - x, max(0.02, crop[2])), min(1 - y, max(0.02, crop[3]))
            out["crop"] = [round(x, 4), round(y, 4), round(w, 4), round(h, 4)]
    elif typ in ("video", "link"):
        from .learning import video_embed

        url = data.get("url")
        if not isinstance(url, str) or not url.startswith(("https://", "http://")) or len(url) > 500:
            raise PortalError(400, "ссылка должна начинаться с https://")
        if typ == "video":
            embed = video_embed(url)
            if not embed:
                raise PortalError(400, "видео: ссылка на VK Видео, YouTube или Rutube")
            out["embed"] = embed
        out["url"] = url
        title = data.get("title", "")
        out["title"] = title[:120] if isinstance(title, str) else ""
    return out


def _validate_item(kind: str, data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise PortalError(400, "data должно быть объектом")
    if kind == "stroke":
        points = data.get("points")
        if not isinstance(points, list) or not 1 <= len(points) <= 5000:
            raise PortalError(400, "линия: от 1 до 5000 точек")
        tool = data.get("tool", "pen")
        if tool not in ("pen", "marker"):
            raise PortalError(400, "tool: pen или marker")
        return {"tool": tool, "color": _color(data.get("color")), "width": _num(data.get("width", 3), 1, 60),
                "points": [_point(p) for p in points]}
    if kind == "shape":
        shape = data.get("shape")
        if shape not in SHAPES:
            raise PortalError(400, "shape: " + ", ".join(SHAPES))
        return {"shape": shape, "color": _color(data.get("color")), "width": _num(data.get("width", 3), 1, 60),
                "from": _point(data.get("from")), "to": _point(data.get("to"))}
    if kind == "text":
        text = data.get("text")
        if not isinstance(text, str) or not text.strip() or len(text) > 500:
            raise PortalError(400, "текст: от 1 до 500 символов")
        return {"text": text.strip(), "color": _color(data.get("color")), "size": _num(data.get("size", 28), 10, 120),
                "at": _point(data.get("at"))}
    if kind == "del":
        if not isinstance(data, dict) or not isinstance(data.get("oid"), str) or not OID_RE.match(data["oid"]):
            raise PortalError(400, "del: нужен oid")
        return {"oid": data["oid"]}
    if kind == "erase":
        ids = data.get("ids")
        if not isinstance(ids, list) or not 1 <= len(ids) <= 1000 or not all(
                isinstance(i, int) and not isinstance(i, bool) and i > 0 for i in ids):
            raise PortalError(400, "erase: список id элементов")
        return {"ids": ids}
    return {}


# -- уведомления в Telegram без запущенного бота ------------------------------------------
_outbox: queue.Queue[tuple[str, str, str]] = queue.Queue()
_outbox_started = threading.Event()
_outbox_lock = threading.Lock()


def _outbox_worker() -> None:
    while True:
        token, chat_id, text = _outbox.get()
        body = json.dumps({"chat_id": chat_id, "text": text[:4096], "disable_web_page_preview": True}).encode()
        req = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=body, method="POST",
                                     headers={"Content-Type": "application/json"})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=20):
                    break
            except urllib.error.HTTPError as exc:  # 400/403 – бот заблокирован или чат не найден: не повторяем
                log.warning("Telegram отклонил сообщение в %s: %s", chat_id, exc)
                break
            except Exception as exc:
                log.warning("Не удалось отправить сообщение в Telegram (попытка %s): %s", attempt + 1, exc)
                time.sleep(2 * (attempt + 1))
        _outbox.task_done()


def send_telegram_async(token: str, chat_id: str, text: str) -> None:
    """Отправить сообщение через Bot API в фоне. Очередь одна, поэтому части длинного отчёта не перемешаются."""
    with _outbox_lock:
        if not _outbox_started.is_set():
            threading.Thread(target=_outbox_worker, name="telegram-outbox", daemon=True).start()
            _outbox_started.set()
    _outbox.put((token, str(chat_id), text))
