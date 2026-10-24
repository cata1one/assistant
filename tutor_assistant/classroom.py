"""Онлайн-класс на сайте школы: видеоурок преподавателя и ученика прямо в браузере.

Как устроено:

* видео и звук идут напрямую между браузерами (WebRTC); сервер только помогает им
  найти друг друга (сигналинг через опрос раз в секунду – стандартной библиотеки хватает);
* каждый участник записывает **свой** микрофон фрагментами по ~15 секунд и отправляет
  на сервер. Поэтому в расшифровке точно известно, кто говорил, – даже без разметки
  дикторов. Фрагменты расшифровываются и проверяются на контакты (как голосовые в Telegram);
* чат урока и текст на доске проверяются так же, как сообщения в Telegram;
* урок без записи или с долгим перерывом в записи – нарушение (``require_recording``);
* по завершении конспект, отчёт родителям и полный отчёт уходят в Telegram через Bot API
  (работает и без запущенного бота) и появляются в личном кабинете.

Ограничение: сказанное вслух собеседник уже услышал – система не может «отозвать» речь,
но фиксирует нарушение в течение ~15–30 секунд и сразу сообщает администратору.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from . import billing, render
from .lesson_pay import LessonPay
from .models import LessonReport, Role
from .portal import ADMIN, PARENT, Access, Portal, PortalError, Viewer, send_telegram_async
from .relay import STUDENT, TUTOR

log = logging.getLogger(__name__)

SIGNAL_KINDS = ("hello", "offer", "answer", "ice", "bye")
MAX_SIGNAL_BYTES = 64 * 1024
MAX_SIGNALS = 400  # хранится на урок; старые выбрасываются
PRESENCE_TIMEOUT = 8.0  # секунд без опроса – участник считается вышедшим
DEFAULT_ICE = [{"urls": ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"]}]
MAX_CHAT_TEXT = 2000
ANSWERS_IN_FILE = "Ответы – в файле конспекта (раздел «Ответы»)."


@dataclass
class _Room:
    signals: list[dict[str, Any]] = field(default_factory=list)
    next_id: int = 1
    seen: dict[str, float] = field(default_factory=dict)  # роль → время последнего опроса


class Classroom:
    def __init__(self, portal: Portal, telegram_send: Callable[[str, str], None] | None = None):
        self.portal = portal
        self.assistant = portal.assistant
        self.storage = portal.storage
        self.settings = portal.settings
        self._rooms: dict[str, _Room] = {}
        self._lock = threading.Lock()
        self.pay = LessonPay(portal)
        if telegram_send is None and self.settings.telegram_token:
            token = self.settings.telegram_token
            telegram_send = lambda chat, text: send_telegram_async(token, chat, text)  # noqa: E731
        self.telegram_send = telegram_send

    def _tg(self, chat_id: str | None, text: str) -> bool:
        """В Telegram: id Telegram как есть, аккаунт сайта – если к нему привязан Telegram."""
        if not chat_id or not self.telegram_send:
            return False
        if str(chat_id).startswith("a_"):
            acc = self.storage.get_account(str(chat_id))
            chat_id = acc.get("tg_user_id") if acc else None
            if not chat_id:
                return False
        self.telegram_send(str(chat_id), text)
        return True

    # -- доступ ---------------------------------------------------------------
    def _room_access(self, viewer: Viewer, lesson_id: str) -> tuple[dict[str, Any], Access, str]:
        lesson = self.storage.get_lesson(lesson_id)
        if not lesson or not lesson.get("chat_id"):
            raise PortalError(404, "урок не найден")
        access = self.portal._access(viewer, lesson["chat_id"])
        if access.role == PARENT or access.pair is None:
            raise PortalError(403, "в онлайн-класс входят преподаватель и ученик пары")
        # Администратор может наблюдать, но в сигналинге участвует только роль пары
        role = access.role if access.role in (TUTOR, STUDENT) else ADMIN
        if role == STUDENT and lesson["status"] == "active":
            self.pay.gate(access.pair)  # преподаватель мог включить предоплату занятий
        return lesson, access, role

    def _name(self, access: Access, role: str) -> str:
        return access.pair.alias(role) if access.pair and role in (TUTOR, STUDENT) else "Администратор"

    def ice_servers(self) -> list[dict[str, Any]]:
        if self.settings.ice_servers:
            try:
                data = json.loads(self.settings.ice_servers)
                if isinstance(data, list):
                    return data
            except ValueError:
                log.warning("TUTOR_ICE_SERVERS: не JSON-список – использую публичные STUN")
        return DEFAULT_ICE

    # -- начало урока ---------------------------------------------------------------
    def start(self, viewer: Viewer, chat_id: str, title: str | None = None) -> dict[str, Any]:
        access = self.portal._access(viewer, chat_id)
        if access.role not in (TUTOR, ADMIN) or access.pair is None:
            raise PortalError(403, "урок в онлайн-классе начинает преподаватель")
        billing.require_active(self.storage, viewer.user_id)
        pair = access.pair
        active = self.storage.active_lesson(chat_id)
        if active:
            return self._lesson_info(active)
        if title:
            title = title.strip()[:120] or None
            if title and self.assistant.moderate(title).is_violation:
                raise PortalError(422, "в теме урока не должно быть контактов")
        lesson = self.assistant.start_lesson(chat_id=chat_id, tutor_id=pair.tutor_user_id, tutor_name=pair.tutor_alias,
                                             student_id=pair.student_user_id, student_name=pair.student_alias,
                                             title=title, require_recording=True)
        self._board_id(lesson, viewer.user_id)
        self.pay.on_start(pair)
        link = f"{self.settings.site_url}/#/room/{lesson['id']}" if self.settings.site_url else None
        if pair.student_user_id:
            self._tg(pair.student_user_id,
                               f"▶️ «{pair.tutor_alias}» начал урок в онлайн-классе"
                               + (f": {title}" if title else "") + "."
                               + (f"\nВойти: {link}" if link else "\nВойдите через личный кабинет на сайте школы.")
                               + "\n\n🔴 Урок записывается и расшифровывается для конспекта и контроля качества.")
        return self._lesson_info(lesson)

    def _lesson_info(self, lesson: dict[str, Any]) -> dict[str, Any]:
        return {"lesson_id": lesson["id"], "status": lesson["status"], "title": lesson.get("title")}

    def _board_id(self, lesson: dict[str, Any], user_id: str) -> str | None:
        """Доска урока; для урока, начатого из Telegram (/lesson_start), создаётся при первом входе."""
        with self._lock:  # два участника входят одновременно – доска создаётся одна
            items = self.storage.lesson_items(lesson["id"], "room")
            if items:
                return items[-1].get("board_id")
            if lesson["status"] != "active":
                return None
            board_id = lesson["id"].replace("-", "")[:12]
            if not self.storage.get_board(board_id):
                self.storage.create_board(board_id, lesson["chat_id"], f"Урок {lesson['started_at'][:10]}", user_id)
            self.storage.add_lesson_item(lesson["id"], "room", {"board_id": board_id})
            return board_id

    # -- состояние комнаты (опрос) ------------------------------------------------------
    def state(self, viewer: Viewer, lesson_id: str, since_signal: int = 0, since_message: int = 0) -> dict[str, Any]:
        lesson, access, role = self._room_access(viewer, lesson_id)
        now = time.monotonic()
        with self._lock:
            room = self._rooms.setdefault(lesson_id, _Room())
            room.seen[role] = now
            signals = [s for s in room.signals if s["id"] > since_signal and s["to"] == role]
            peer_role = STUDENT if role == TUTOR else TUTOR
            peer_online = now - room.seen.get(peer_role, -1e9) < PRESENCE_TIMEOUT
            last_signal = room.next_id - 1
        recording = self.assistant.recording_status(lesson_id) if lesson["status"] == "active" else None
        return {
            "lesson_id": lesson_id, "status": lesson["status"], "title": lesson.get("title"),
            "started_at": lesson["started_at"], "role": role, "me": self._name(access, role),
            "peer": {"role": peer_role, "name": self._name(access, peer_role), "online": peer_online},
            "signals": signals, "last_signal": last_signal,
            "messages": self.storage.messages_since(lesson_id, max(0, since_message)),
            "board_id": self._board_id(lesson, viewer.user_id), "ice_servers": self.ice_servers(),
            "recording": recording, "speech_available": self.assistant.speech_available,
        }

    def signal(self, viewer: Viewer, lesson_id: str, body: Any) -> dict[str, Any]:
        lesson, _, role = self._room_access(viewer, lesson_id)
        if role not in (TUTOR, STUDENT):
            raise PortalError(403, "сигналы видеосвязи отправляют участники урока")
        if lesson["status"] != "active":
            raise PortalError(409, "урок завершён")
        if not isinstance(body, dict) or body.get("kind") not in SIGNAL_KINDS:
            raise PortalError(400, "kind: " + ", ".join(SIGNAL_KINDS))
        data = body.get("data")
        if len(json.dumps(data, ensure_ascii=False)) > MAX_SIGNAL_BYTES:
            raise PortalError(413, "слишком большой сигнал")
        with self._lock:
            room = self._rooms.setdefault(lesson_id, _Room())
            sig = {"id": room.next_id, "from": role, "to": STUDENT if role == TUTOR else TUTOR,
                   "kind": body["kind"], "data": data}
            room.next_id += 1
            room.signals.append(sig)
            del room.signals[:-MAX_SIGNALS]
        return {"id": sig["id"]}

    # -- чат и речь ----------------------------------------------------------------
    def chat(self, viewer: Viewer, lesson_id: str, body: Any) -> dict[str, Any]:
        lesson, access, role = self._room_access(viewer, lesson_id)
        if role not in (TUTOR, STUDENT):
            raise PortalError(403, "писать в чат урока могут участники")
        if lesson["status"] != "active":
            raise PortalError(409, "урок завершён")
        text = body.get("text") if isinstance(body, dict) else None
        if not isinstance(text, str) or not text.strip() or len(text) > MAX_CHAT_TEXT:
            raise PortalError(400, f"текст: от 1 до {MAX_CHAT_TEXT} символов")
        out = self.assistant.process_message(lesson_id, viewer.user_id, self._name(access, role), text.strip(),
                                             role=Role.TUTOR if role == TUTOR else Role.STUDENT,
                                             moderate=self.portal.is_strict(lesson["chat_id"]))
        if out.moderation.is_violation:
            self._alert(access, role, out.moderation.summary, text, "чат онлайн-класса", out.incident_id)
        return {"stored": out.stored_text, "moderation": out.moderation.to_dict(),
                "new_words": [w.word for w in out.new_words], "parent_note": out.parent_note}

    def audio(self, viewer: Viewer, lesson_id: str, raw: bytes | None) -> dict[str, Any]:
        lesson, access, role = self._room_access(viewer, lesson_id)
        if role not in (TUTOR, STUDENT):
            raise PortalError(403, "запись отправляют участники урока")
        if lesson["status"] != "active":
            raise PortalError(409, "урок завершён")
        if not raw:
            raise PortalError(400, "тело запроса – аудиофрагмент")
        out = self.assistant.process_audio(lesson_id, viewer.user_id, self._name(access, role), raw,
                                           role=Role.TUTOR if role == TUTOR else Role.STUDENT, recording=True,
                                           moderate=self.portal.is_strict(lesson["chat_id"]))
        if out.moderation is not None and out.moderation.is_violation:
            self._alert(access, role, out.moderation.summary, out.text, "речь на уроке", out.incident_id)
        return {"checked": out.checked, "error": out.error,
                "blocked": bool(out.moderation and out.moderation.blocked),
                "summary": out.moderation.summary if out.moderation and out.moderation.is_violation else None}

    def _alert(self, access: Access, role: str, summary: str, text: str, where: str, incident_id: int | None) -> None:
        pair = access.pair
        who = f"{'преподаватель' if role == TUTOR else 'ученик'} «{pair.alias(role)}»" if pair else role
        message = (f"🚨 Нарушение #{incident_id or '—'} ({where}): {summary}\n"
                   f"Пара {pair.id if pair else '—'}, {who}\nТекст:\n{text[:1500]}")
        if self.telegram_send and self.settings.admin_chat_id:
            self.telegram_send(self.settings.admin_chat_id, message)
        tutor = self.storage.get_account(pair.tutor_user_id) if pair and pair.tutor_user_id else None
        org = self.storage.get_org(tutor.get("org_id")) if tutor else None
        if org:  # владельцу школы – тоже
            self._tg(org["owner_id"], message)

    # -- завершение ------------------------------------------------------------------
    def finish(self, viewer: Viewer, lesson_id: str) -> dict[str, Any]:
        lesson, access, role = self._room_access(viewer, lesson_id)
        if role not in (TUTOR, ADMIN):
            raise PortalError(403, "завершает урок преподаватель")
        if lesson["status"] != "active":
            report = self.storage.get_report(lesson_id)
            return {"status": lesson["status"], "delivered": None, "has_report": report is not None}
        self.pay.on_finish(access.pair, lesson.get("started_at"))  # списать занятие, напомнить об оплате
        slow_ai = self.assistant.llm.slow  # бесплатная модель думает минутами – не держим преподавателя
        report = self.assistant.finish_lesson(lesson_id, use_llm=not slow_ai, ai_pending=slow_ai)
        review = self._review_first(access)
        if review:  # конспект уйдёт ученику после проверки преподавателем
            self.storage.set_report_published(lesson_id, False)
        with self._lock:
            room = self._rooms.setdefault(lesson_id, _Room())  # ученику – сигнал о завершении
            room.signals.append({"id": room.next_id, "from": TUTOR, "to": STUDENT, "kind": "bye",
                                 "data": {"finished": True}})
            room.next_id += 1
        if slow_ai:
            threading.Thread(target=self._improve_and_deliver, args=(access, lesson_id), daemon=True).start()
            return {"status": "finished", "delivered": None, "has_report": True, "ai_pending": True, "on_review": review,
                    "violations": report.stats.violations}
        if review:
            return {"status": "finished", "delivered": None, "has_report": True, "on_review": True,
                    "violations": report.stats.violations}
        delivered = self.deliver(access, report)
        return {"status": "finished", "delivered": delivered, "has_report": True,
                "violations": report.stats.violations}

    def _review_first(self, access: Access) -> bool:
        """Преподаватель (или его школа) выбрал сначала проверить конспект, а потом отправлять."""
        pair = access.pair
        tutor = self.storage.get_account(pair.tutor_user_id) if pair and pair.tutor_user_id else None
        if not tutor:
            return False
        owners = [tutor]
        org = self.storage.get_org(tutor.get("org_id"))
        if org and org["owner_id"] != tutor["id"]:
            owners.append(self.storage.get_account(org["owner_id"]) or {})
        for acc in owners:
            try:
                if json.loads(acc.get("prefs") or "{}").get("review_reports"):
                    return True
            except ValueError:
                continue
        return False

    def publish(self, viewer: Viewer, lesson_id: str) -> dict[str, Any]:
        """Преподаватель проверил конспект: открываем его ученику и родителям и отправляем."""
        lesson = self.storage.get_lesson(lesson_id)
        if not lesson or not lesson.get("chat_id"):
            raise PortalError(404, "урок не найден")
        access = self.portal._access(viewer, lesson["chat_id"])
        if access.role != TUTOR:
            raise PortalError(403, "конспект отправляет преподаватель")
        report = self.storage.get_report(lesson_id)
        if report is None:
            raise PortalError(404, "конспекта ещё нет")
        if report.generated_by == "pending":
            raise PortalError(409, "ИИ ещё готовит конспект: подождите несколько минут")
        if self.storage.report_published(lesson_id):
            return {"published": True, "delivered": None}
        self.storage.set_report_published(lesson_id, True)
        return {"published": True, "delivered": self.deliver(access, report)}

    def _improve_and_deliver(self, access: Access, lesson_id: str) -> None:
        """Фон: ИИ делает конспект по расшифровке, затем отчёты уходят ученику, родителям и преподавателю."""
        try:
            self.assistant.improve_report(lesson_id)
        except Exception:  # ИИ упал – остаётся офлайн-отчёт
            log.exception("ИИ не доработал отчёт урока %s", lesson_id)
            current = self.storage.get_report(lesson_id)
            if current and current.generated_by == "pending":
                current.generated_by = "offline"
                self.storage.save_report(lesson_id, current)
        report = self.storage.get_report(lesson_id)
        if report and self.storage.report_published(lesson_id):
            self.deliver(access, report)
        elif report and access.pair:  # ждёт проверки: сообщаем преподавателю, что конспект готов
            self.portal.notify_account(access.pair.tutor_user_id, "Конспект урока готов к проверке",
                                       f"Урок с {access.pair.student_alias}: проверьте конспект и отправьте ученику "
                                       f"на странице урока: {self.settings.site_url}/#/lesson/{lesson_id}")

    def deliver(self, access: Access, report: LessonReport) -> dict[str, int]:
        """Отчёты в Telegram: ученику – конспект, родителям – отчёт об успехах, преподавателю – полный."""
        sent = {"student": 0, "parents": 0, "tutor": 0}
        pair = access.pair
        if not pair:
            return sent
        cabinet = f"\n\nКонспект, слова и тест – в личном кабинете: {self.settings.site_url}/#/cabinet" \
            if self.settings.site_url else ""
        if pair.student_user_id:
            text = render.render_student_report(report)
            if self.settings.site_url:  # файл с ответами не отправляем: тест проверяется в кабинете
                text = text.replace(ANSWERS_IN_FILE, "Пройти тест с проверкой ответов – в личном кабинете.")
            self._send_long(pair.student_user_id, text + cabinet)
            sent["student"] = 1
            self._email_report(pair.student_user_id, report, text + cabinet)
        parents = self.storage.parents_for(pair.chat_id)
        for p in parents:
            parent_text = render.render_parent_report(report)
            self._send_long(p, parent_text)
            sent["parents"] += 1
            self._email_report(p, report, parent_text)
        if pair.tutor_user_id:
            status = (f"📨 Отчёт отправлен родителям: {len(parents)}." if parents else
                      "ℹ️ Родители ученика не подключены – отправьте им ссылку-приглашение из раздела «Ученики».")
            self._send_long(pair.tutor_user_id, "📋 Полный отчёт для преподавателя\n\n"
                            + render.render_report(report, with_answers=True) + "\n\n" + status)
            sent["tutor"] = 1
            tutor = self.storage.get_account(pair.tutor_user_id)
            org = self.storage.get_org(tutor.get("org_id")) if tutor else None
            if org:  # школа видит полный отчёт на сайте; в Telegram – короткое уведомление
                link = f"\n{self.settings.site_url}/#/lesson/{report.lesson_id}" if self.settings.site_url else ""
                self._tg(org["owner_id"], f"📋 Урок завершён: {pair.tutor_alias} ↔ {pair.student_alias}"
                                          f"{' – ' + report.topic if report.topic else ''}.{link}")
                sent["school"] = 1
        return sent

    def _email_report(self, user_id: str, report: LessonReport, text: str) -> None:
        acc = self.storage.get_account(user_id) if user_id and user_id.startswith("a_") else None
        if acc:
            self.portal.mailer.send(acc["email"], f"{self.settings.school_name}: конспект урока"
                                    + (f" «{report.topic}»" if report.topic else ""), text[:6000],
                                    reply_to=self.settings.support_email)

    def _send_long(self, chat_id: str, text: str) -> bool:
        parts = render.split_message(text)
        return all(self._tg(chat_id, part) for part in parts) if parts else False
