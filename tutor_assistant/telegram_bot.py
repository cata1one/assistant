"""Telegram-бот: модератор чата урока и помощник преподавателя.

Как подключить:
1. Создайте бота у @BotFather, токен — в TELEGRAM_BOT_TOKEN.
2. В @BotFather: /setprivacy → Disable (иначе бот не видит обычные сообщения группы).
3. Добавьте бота в чат урока и сделайте администратором с правом «Удалять сообщения».
4. Преподаватель пишет /lesson_start, в конце — /lesson_end.

В личных сообщениях боту можно прислать расшифровку урока (текстом или .txt) —
бот вернёт конспект, слова, тест, ДЗ и список нарушений.

Режим анонимного моста (рекомендуется): преподаватель и ученик не состоят в общем
чате и не видят аккаунтов друг друга. Администратор создаёт пару командой
/new_pair, участники открывают свои ссылки-приглашения и пишут боту в личку —
бот пересылает сообщения от своего имени под псевдонимами (см. relay.py).
"""

from __future__ import annotations

import asyncio
import io
import logging
import re
import threading
import time
from typing import Any

from . import render
from .commands import HELP_TEXT, detect_command
from .config import Settings
from .contact_guard import ModerationResult, Severity
from .models import Role
from .parent_report import parent_note
from .portal import Portal, PortalError
from .relay import TUTOR, Pair, RelayError, RelayService
from .service import AudioOutcome, MessageOutcome, TutorAssistant
from .summary import plural

log = logging.getLogger(__name__)

try:
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup, MessageEntity, ReplyParameters, Update
    from telegram.constants import ChatMemberStatus, ChatType
    from telegram.error import TelegramError
    from telegram.ext import (
        Application,
        CallbackQueryHandler,
        CommandHandler,
        ContextTypes,
        MessageHandler,
        filters,
    )
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Для бота установите зависимость: pip install python-telegram-bot") from exc

MAX_TRANSCRIPT_BYTES = 2 * 1024 * 1024
MAX_BOT_DOWNLOAD = 20 * 1024 * 1024  # ограничение Bot API на скачивание файлов
WATCHDOG_INTERVAL = 20.0
RECORDING_NOTICE = ("🔴 Урок записывается: голосовые сообщения и запись занятия расшифровываются и проверяются "
                    "автоматически. Продолжая урок, участники соглашаются с записью по правилам школы.")
CAPTION_LIMIT = 1024
REDACTED_SPEECH = "[голосовое сообщение скрыто: не удалось проверить речь]"
UNCHECKED_SPEECH_WARNING = ("⚠️ Голосовые сообщения, которые не удалось проверить автоматически, не публикуются. "
                            "Напишите, пожалуйста, текстом.")
ROLE_RU = {TUTOR: "преподаватель", "student": "ученик"}

RELAY_HELP = """🔒 Вы общаетесь через бот школы. Собеседник видит только ваш псевдоним — не ваш аккаунт Telegram.
Просто пишите сюда: сообщения, фото и файлы будут переданы собеседнику. Чтобы ответить на конкретное
сообщение, используйте «Ответить» (reply).

Личные контакты (телефон, почта, ники, ссылки на мессенджеры) не передаются — такие сообщения
блокируются, а администратор школы получает уведомление.

/chats — выбрать собеседника (если их несколько)
/lesson_start [тема], /lesson_end — начать и завершить урок (преподаватель)
«новые слова сегодня», «дз», «тест», «конспект» — материалы урока"""


class TutorBot:
    def __init__(self, settings: Settings, assistant: TutorAssistant | None = None):
        self.settings = settings
        self.assistant = assistant or TutorAssistant(settings)
        self._warned_no_rights: set[int] = set()
        self.relay = RelayService(self.assistant.storage)
        self.portal = Portal(self.assistant)

    # -- утилиты -------------------------------------------------------------
    @staticmethod
    def _name(update: Update) -> str:
        user = update.effective_user
        if not user:
            return "Участник"
        return user.full_name or (f"@{user.username}" if user.username else str(user.id))

    async def _is_admin(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
        user = update.effective_user
        chat = update.effective_chat
        if not user:
            return False
        if str(user.id) in self.settings.admin_user_ids:
            return True
        if chat and chat.type != ChatType.PRIVATE:
            try:
                member = await context.bot.get_chat_member(chat.id, user.id)
                return member.status in (ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.OWNER)
            except TelegramError:
                return False
        return False

    async def _send_long(self, context: ContextTypes.DEFAULT_TYPE, chat_id: int, text: str) -> None:
        for part in render.split_message(text):
            await context.bot.send_message(chat_id, part, disable_web_page_preview=True)

    async def _notify_admin(self, context: ContextTypes.DEFAULT_TYPE, update: Update, result: ModerationResult,
                            incident_id: int | None, role: Role, transcript: str | None = None) -> None:
        if not self.settings.admin_chat_id:
            return
        chat = update.effective_chat
        user = update.effective_user
        role_ru = {Role.TUTOR: "преподаватель", Role.STUDENT: "ученик", Role.UNKNOWN: "участник"}[role]
        text = (
            f"🚨 Нарушение #{incident_id or '—'}: {result.summary}\n"
            f"Чат: {chat.title if chat and chat.title else chat.id if chat else '—'}\n"
            f"Кто: {self._name(update)} ({role_ru}, id {user.id if user else '—'})\n"
            f"Действие: {'сообщение скрыто' if result.blocked else 'предупреждение'}\n"
            + (f"Расшифровка голосового:\n{transcript}" if transcript else f"Исходный текст:\n{result.original_text}")
        )
        try:
            await self._send_long(context, int(self.settings.admin_chat_id), text)
        except (TelegramError, ValueError) as exc:
            log.warning("Не удалось уведомить администратора: %s", exc)

    # -- команды ---------------------------------------------------------------
    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        await update.effective_message.reply_text(HELP_TEXT + "\nКоманды: /lesson_start [тема], /lesson_end, /words, "
                                                  "/words_today, /dictionary, /homework, /test, /answers, /summary, "
                                                  "/report, /check <текст>, /chats, /recording, /note <текст>, /cabinet — личный кабинет на сайте, "
                                                  "/classroom — класс ProgressMe\n"
                                                  "Администраторам: /new_pair Преподаватель | Ученик, /pairs, "
                                                  "/unpair <id>, /parent_link, /incidents, /classroom <id пары> <ссылка>")

    async def cmd_lesson_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        chat, user, msg = update.effective_chat, update.effective_user, update.effective_message
        title = " ".join(context.args) if context.args else None
        if chat.type == ChatType.PRIVATE:
            await self._relay_lesson_start(update, context, title)
            return
        existing = self.assistant.storage.active_lesson(str(chat.id))
        if existing:
            await msg.reply_text("Урок уже идёт. Завершить: /lesson_end")
            return
        lesson = self.assistant.start_lesson(chat_id=str(chat.id), tutor_id=str(user.id), tutor_name=self._name(update),
                                             title=title, require_recording=self.settings.require_recording)
        text = (f"▶️ Урок начат{f': {title}' if title else ''}. Преподаватель: {self._name(update)}.\n"
                "Я записываю новые слова («Новые слова сегодня: …») и домашнее задание («ДЗ: …»).\n"
                "Напоминаю: обмен личными контактами и общение вне платформы запрещены.\n\n"
                + self._recording_notice(lesson["id"]))
        await msg.reply_text(text, reply_markup=self._classroom_markup(str(chat.id)))
        await self._check_rights(context, chat.id)
        log.info("Урок %s начат в чате %s", lesson["id"], chat.id)

    async def _check_rights(self, context: ContextTypes.DEFAULT_TYPE, chat_id: int) -> None:
        try:
            me = await context.bot.get_chat_member(chat_id, context.bot.id)
            can_delete = getattr(me, "can_delete_messages", False) or me.status == ChatMemberStatus.OWNER
        except TelegramError:
            can_delete = False
        if not can_delete and chat_id not in self._warned_no_rights:
            self._warned_no_rights.add(chat_id)
            await context.bot.send_message(chat_id, "⚠️ У меня нет права удалять сообщения. Сделайте меня "
                                                    "администратором с правом «Удалять сообщения», иначе я смогу только "
                                                    "предупреждать о нарушениях.")

    async def cmd_lesson_end(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        chat, user, msg = update.effective_chat, update.effective_user, update.effective_message
        if chat.type == ChatType.PRIVATE:
            await self._relay_lesson_end(update, context)
            return
        lesson = self.assistant.storage.active_lesson(str(chat.id))
        if not lesson:
            await msg.reply_text("Сейчас нет активного урока. Начать: /lesson_start")
            return
        if str(user.id) != str(lesson.get("tutor_id")) and not await self._is_admin(update, context):
            await msg.reply_text("Завершить урок может преподаватель или администратор.")
            return
        await msg.reply_text("⏳ Готовлю конспект, словарь, тест и домашнее задание…")
        try:
            report = await asyncio.to_thread(self.assistant.finish_lesson, lesson["id"])
        except Exception:
            log.exception("Ошибка при завершении урока %s", lesson["id"])
            await msg.reply_text("Не удалось подготовить отчёт. Урок сохранён — попробуйте /lesson_end ещё раз.")
            return
        await self._deliver_reports(context, report, chat_key=str(chat.id), student_targets=[chat.id],
                                    tutor_target=int(lesson["tutor_id"]) if str(lesson.get("tutor_id") or "").lstrip("-").isdigit()
                                    else None)

    async def _deliver_reports(self, context: ContextTypes.DEFAULT_TYPE, report: Any, chat_key: str,
                               student_targets: list[int], tutor_target: int | None) -> None:
        """Ученику — конспект, преподавателю — полный отчёт с ответами, родителям — отчёт об успехах."""
        md = io.BytesIO(render.render_report_markdown(report).encode("utf-8"))
        for target in student_targets:
            try:
                await self._send_long(context, target, render.render_student_report(report))
                md.seek(0)
                await context.bot.send_document(target, document=md, filename=f"konspekt_{report.date}.md",
                                                caption="Конспект урока (ответы к тесту — в конце файла)")
            except TelegramError as exc:
                log.warning("Не удалось отправить конспект в %s: %s", target, exc)
        parents = self.assistant.storage.parents_for(chat_key)
        delivered = 0
        for parent in parents:
            try:
                await self._send_long(context, int(parent), render.render_parent_report(report))
                delivered += 1
            except (TelegramError, ValueError) as exc:
                log.warning("Не удалось отправить отчёт родителю %s: %s", parent, exc)
        if tutor_target is not None:
            status = (f"📨 Отчёт отправлен родителям: {delivered}." if parents else
                      "ℹ️ Родители ученика не подключены — ссылку для них выдаёт администратор школы (/parent_link).")
            try:
                await self._send_long(context, tutor_target, "📋 Полный отчёт для преподавателя\n\n"
                                      + render.render_report(report, with_answers=True) + "\n\n" + status)
            except TelegramError as exc:
                log.warning("Не удалось отправить отчёт преподавателю: %s", exc)

    async def cmd_note(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """/note текст — замечание преподавателя для родителей (ученик его не видит)."""
        msg, chat, user = update.effective_message, update.effective_chat, update.effective_user
        text = " ".join(context.args or []).strip()
        if chat.type == ChatType.PRIVATE:
            current = self.relay.current(str(user.id))
            if not current or current[1] != TUTOR:
                await msg.reply_text("Заметки для родителей пишет преподаватель во время урока.")
                return
            chat_key = current[0].chat_id
        else:
            chat_key = str(chat.id)
            try:
                await msg.delete()  # ученик в группе не должен видеть заметку
            except TelegramError:
                pass
        lesson = self.assistant.storage.active_lesson(chat_key)
        reply = msg.reply_text if chat.type == ChatType.PRIVATE else (
            lambda t: context.bot.send_message(user.id, t))
        if not lesson or (str(user.id) != str(lesson.get("tutor_id")) and not self._is_school_admin(update)):
            await self._safe(reply, "Заметки для родителей добавляет преподаватель во время урока (после /lesson_start).")
            return
        if not text:
            await self._safe(reply, "Использование: /note Миша стал увереннее говорить, но нужно повторить времена")
            return
        ok, result = self.assistant.add_note(lesson["id"], text, str(user.id), self._name(update))
        await self._safe(reply, "📝 Заметка для родителей сохранена — она войдёт в отчёт после урока." if ok else
                         f"🚫 Заметка не сохранена: {result.summary}. Личные контакты передавать нельзя.")

    @staticmethod
    async def _safe(send: Any, text: str) -> None:
        try:
            await send(text)
        except TelegramError as exc:
            log.warning("Не удалось отправить сообщение: %s", exc)

    async def cmd_parent_link(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Ссылка для родителей: /parent_link <id пары> в личке или /parent_link в чате урока (только администратор)."""
        msg, chat, user = update.effective_message, update.effective_chat, update.effective_user
        is_admin = self._is_school_admin(update) or (chat.type != ChatType.PRIVATE and await self._is_admin(update, context))
        if not is_admin:
            await msg.reply_text("Ссылки для родителей выдаёт администратор школы.")
            return
        if chat.type == ChatType.PRIVATE:
            pair = self.relay.get(context.args[0]) if context.args else None
            if not pair:
                await msg.reply_text("Использование: /parent_link <id пары> (список пар: /pairs)")
                return
            chat_key, student = pair.chat_id, pair.student_alias
        else:
            chat_key, student = str(chat.id), None
        code = self.assistant.create_parent_invite(chat_key, student, created_by=str(user.id))
        text = ("Ссылка для родителей" + (f" ученика «{student}»" if student else "") + " (до 2 человек):\n"
                + self._link(context, f"p_{code}") + "\nРодители будут получать отчёт после каждого урока. "
                "Писать преподавателю через неё нельзя.")
        try:
            await context.bot.send_message(user.id, text, disable_web_page_preview=True)
            if chat.type != ChatType.PRIVATE:
                await msg.reply_text("Ссылка для родителей отправлена администратору в личные сообщения.")
        except TelegramError:
            await msg.reply_text("Не могу написать вам в личку — откройте диалог с ботом (/start) и повторите.")

    # -- сайт школы: личный кабинет и класс ProgressMe ---------------------------------
    def _classroom_markup(self, chat_key: str) -> InlineKeyboardMarkup | None:
        url = self.assistant.storage.get_classroom(chat_key)
        if not url:
            return None
        return InlineKeyboardMarkup([[InlineKeyboardButton("🎥 Войти в класс ProgressMe", url=url)]])

    async def cmd_cabinet(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg, user = update.effective_message, update.effective_user
        if update.effective_chat.type != ChatType.PRIVATE:
            await msg.reply_text("Ссылку в личный кабинет я пришлю только в личном чате: напишите мне /cabinet.")
            return
        uid = str(user.id)
        admin = self._is_school_admin(update)
        if not admin and not self.relay.pairs_for(uid) and not self.assistant.storage.parent_chats(uid):
            await msg.reply_text("Личный кабинет откроется после подключения к школе: откройте ссылку-приглашение "
                                 "от администратора.")
            return
        if not self.settings.site_url:
            await msg.reply_text("Сайт школы ещё не подключён (администратору: задайте TUTOR_SITE_URL).")
            return
        token = self.portal.issue_token(uid, admin=admin)
        link = self.portal.cabinet_link(token)
        markup = (InlineKeyboardMarkup([[InlineKeyboardButton("Открыть личный кабинет", url=link)]])
                  if link and link.startswith("https://") else None)
        await msg.reply_text(f"🔑 Ваш личный кабинет: конспекты, словарь, тесты и доска.\n{link}\n\n"
                             f"Ссылка действует {self.settings.access_token_days} дн. Никому её не пересылайте — "
                             "по ней открывается ваш кабинет. Выйти на всех устройствах — кнопка «Выйти» в кабинете.",
                             reply_markup=markup, disable_web_page_preview=True)

    async def cmd_classroom(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Ссылка на класс ProgressMe. Задаёт администратор школы: /classroom <id пары> <ссылка|->."""
        msg, chat = update.effective_message, update.effective_chat
        args = context.args or []
        admin = self._is_school_admin(update)
        if chat.type != ChatType.PRIVATE:
            chat_key = str(chat.id)
            url = args[0] if args else None
        elif len(args) >= 1 and admin:
            pair = self.relay.get(args[0])
            if not pair:
                await msg.reply_text("Пара не найдена. Список пар: /pairs")
                return
            chat_key, url = pair.chat_id, (args[1] if len(args) > 1 else None)
        else:
            current = self.relay.current(str(update.effective_user.id))
            if not current:
                await msg.reply_text("Вы пока не подключены к собеседнику.")
                return
            chat_key, url = current[0].chat_id, None
        if url is None:
            link = self.assistant.storage.get_classroom(chat_key)
            await msg.reply_text(f"🎥 Класс ProgressMe: {link}" if link else
                                 "Ссылка на класс ProgressMe ещё не добавлена школой.",
                                 reply_markup=self._classroom_markup(chat_key), disable_web_page_preview=True)
            return
        if not admin:
            await msg.reply_text("Ссылку на класс задаёт администратор школы.")
            return
        try:
            self.portal.set_classroom(chat_key, None if url == "-" else url, str(update.effective_user.id))
        except PortalError as exc:
            await msg.reply_text(f"❌ {exc.message}")
            return
        await msg.reply_text("✅ Ссылка на класс сохранена." if url != "-" else "Ссылка на класс удалена.",
                             reply_markup=self._classroom_markup(chat_key))

    @staticmethod
    def _link(context: ContextTypes.DEFAULT_TYPE, payload: str) -> str:
        username = context.bot.username
        return f"https://t.me/{username}?start={payload}" if username else f"/start {payload}"

    async def _parent_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE, code: str) -> None:
        msg, user = update.effective_message, update.effective_user
        invite = self.assistant.subscribe_parent(code, str(user.id))
        if not invite:
            await msg.reply_text("❌ Ссылка недействительна или уже использована. Обратитесь к администратору школы.")
            return
        who = f" ученика «{invite['student_name']}»" if invite.get("student_name") else ""
        await msg.reply_text(f"✅ Готово! Вы будете получать отчёт после каждого урока{who}: успехи, на что обратить "
                             "внимание, замечания преподавателя и домашнее задание.\nПоследний отчёт: напишите «отчёт».")
        await self._notify_admin_text(context, f"👨‍👩‍👧 Подключился родитель{who} (id {user.id}, {self._name(update)})")

    async def _parent_message(self, update: Update) -> None:
        msg, user = update.effective_message, update.effective_user
        text = (msg.text or "").strip().lower()
        if re.search(r"отч[её]т|успех|прогресс|как\s+дела|report", text):
            reports = self.assistant.parent_report_for(str(user.id))
            if not reports:
                await msg.reply_text("Отчётов пока нет — он придёт после ближайшего урока.")
                return
            for _, report in reports:
                for part in render.split_message(render.render_parent_report(report)):
                    await msg.reply_text(part)
            return
        await msg.reply_text("Здесь приходят отчёты об уроках. Последний отчёт — напишите «отчёт». "
                             "С вопросами обращайтесь в поддержку школы.")

    async def _answer(self, update: Update, command: str) -> None:
        chat, user = update.effective_chat, update.effective_user
        if chat.type == ChatType.PRIVATE:
            current = self.relay.current(str(user.id))
            if current:
                text = self.assistant.answer_command(command, chat_id=current[0].chat_id)
            else:
                text = self.assistant.answer_command(command, owner=f"student:{user.id}")
        else:
            text = self.assistant.answer_command(command, chat_id=str(chat.id))
        for part in render.split_message(text):
            await update.effective_message.reply_text(part, disable_web_page_preview=True)

    def _command(self, name: str):
        async def handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
            await self._answer(update, name)
        return handler

    async def cmd_check(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        text = " ".join(context.args) if context.args else ""
        if not text:
            await update.effective_message.reply_text("Использование: /check <текст сообщения>")
            return
        r = self.assistant.moderate(text)
        verdict = {"block": "🚫 будет скрыто", "warn": "⚠️ предупреждение", "allow": "✅ нарушений нет"}[r.action]
        await update.effective_message.reply_text(f"{verdict}" + (f"\nНайдено: {r.summary}" if r.summary else ""))

    async def cmd_incidents(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not await self._is_admin(update, context):
            await update.effective_message.reply_text("Журнал нарушений доступен только администраторам школы.")
            return
        chat = update.effective_chat
        rows = self.assistant.storage.incidents(chat_id=None if chat.type == ChatType.PRIVATE else str(chat.id), limit=20)
        if not rows:
            await update.effective_message.reply_text("Нарушений не зафиксировано.")
            return
        lines = [f"#{r['id']} {r['created_at'][:16].replace('T', ' ')} — {r['user_name'] or r['user_id']} ({r['role']}): "
                 f"{r['summary']} [{r['action']}]" for r in rows]
        await self._send_long(context, chat.id, "🚨 Последние нарушения:\n" + "\n".join(lines))

    # -- речь и запись урока ------------------------------------------------------
    def _recording_notice(self, lesson_id: str) -> str:
        notice = RECORDING_NOTICE
        if not self.assistant.speech_available and not self.settings.relay_unchecked_audio:
            notice += "\n🎤 Проверка речи на сервере сейчас недоступна — голосовые сообщения не передаются, пишите текстом."
        if self.settings.require_recording:
            notice += (f"\n🎙 Включите запись занятия на компьютере:\n"
                       f"python -m tutor_assistant record --lesson {lesson_id}\n"
                       "Если записи не будет, администратор школы получит уведомление.")
        return notice

    @staticmethod
    def _speech_attachment(msg: Any) -> Any | None:
        """Голосовое, «кружочек», аудио или видео — всё, где может звучать речь."""
        return msg.voice or msg.video_note or msg.audio or msg.video or None

    async def _download(self, attachment: Any) -> bytes | None:
        if attachment.file_size and attachment.file_size > MAX_BOT_DOWNLOAD:
            return None
        file = await attachment.get_file()
        return bytes(await file.download_as_bytearray())

    async def _check_speech(self, update: Update, attachment: Any, lesson: dict[str, Any] | None, chat_id: str,
                            speaker: str, role: str | None) -> AudioOutcome:
        """Скачать и проверить речь. Возвращает AudioOutcome; checked=False — проверить не удалось."""
        msg, user = update.effective_message, update.effective_user
        if not self.assistant.speech_available:
            return AudioOutcome(checked=False, error=self.assistant.transcriber.last_error)
        try:
            data = await self._download(attachment)
        except TelegramError as exc:
            return AudioOutcome(checked=False, error=f"не удалось скачать файл: {exc}")
        if data is None:
            return AudioOutcome(checked=False, error="файл больше 20 МБ — бот не может его проверить")
        ts = msg.date.timestamp() if msg.date else time.time()
        if lesson:
            return await asyncio.to_thread(self.assistant.process_audio, lesson["id"], str(user.id), speaker, data,
                                           role, msg.message_id, ts)
        return await asyncio.to_thread(self.assistant.moderate_chat_audio, chat_id, str(user.id), speaker, data, role,
                                       msg.message_id, ts)

    async def cmd_recording(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        chat, user = update.effective_chat, update.effective_user
        chat_key = str(chat.id)
        if chat.type == ChatType.PRIVATE:
            current = self.relay.current(str(user.id))
            chat_key = current[0].chat_id if current else chat_key
        lesson = self.assistant.storage.active_lesson(chat_key)
        if not lesson:
            await update.effective_message.reply_text("Сейчас нет активного урока.")
            return
        st = self.assistant.recording_status(lesson["id"])
        speech = "✅ работает" if self.assistant.speech_available else "❌ недоступна"
        state = "🔴 идёт" if st["active"] else ("⏸ нет звука" if st["chunks"] else "⚪️ не включена")
        await update.effective_message.reply_text(
            f"Урок {lesson['id']}\nЗапись: {state} (фрагментов: {st['chunks']}, {int(st['seconds'])} с)\n"
            f"Проверка речи: {speech}\nВключить запись: python -m tutor_assistant record --lesson {lesson['id']}")

    async def _watchdog(self, app: Application) -> None:
        """Каждые 20 секунд: на идущих уроках запись не должна пропадать."""
        while True:
            await asyncio.sleep(WATCHDOG_INTERVAL)
            try:
                gaps = await asyncio.to_thread(self.assistant.check_recording_gaps)
            except Exception:
                log.exception("Ошибка проверки записи уроков")
                continue
            for gap in gaps:
                await self._alert_gap(app.bot, gap)

    async def _alert_gap(self, bot: Any, gap: dict[str, Any]) -> None:
        text = f"⚠️ Урок {gap['lesson_id']}: {gap['summary']}."
        chat = str(gap.get("chat_id") or "")
        targets: list[int] = []
        if chat.startswith("pair:"):
            pair = self.relay.get(chat.split(":", 1)[1])
            if pair and pair.tutor_user_id:
                targets.append(int(pair.tutor_user_id))
        elif chat.lstrip("-").isdigit():
            targets.append(int(chat))
        for target in targets:
            try:
                await bot.send_message(target, text + " Включите запись занятия.")
            except TelegramError as exc:
                log.warning("Не удалось отправить напоминание о записи: %s", exc)
        if self.settings.admin_chat_id:
            try:
                await bot.send_message(int(self.settings.admin_chat_id),
                                       f"🚨 Нарушение #{gap['incident_id']}: {text} Преподаватель id {gap['tutor_id']}.")
            except (TelegramError, ValueError) as exc:
                log.warning("Не удалось уведомить администратора: %s", exc)

    # -- сообщения ---------------------------------------------------------------
    async def on_group_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg, chat, user = update.effective_message, update.effective_chat, update.effective_user
        if not msg or not user or user.is_bot:
            return
        text = msg.text or msg.caption or ""
        lesson = self.assistant.storage.active_lesson(str(chat.id))
        attachment = self._speech_attachment(msg)
        if attachment is not None and update.message is not None:
            role_name = self.assistant.resolve_role(lesson, str(user.id), None).value if lesson else None
            audio = await self._check_speech(update, attachment, lesson, str(chat.id), self._name(update), role_name)
            if audio.blocked or (not audio.checked and not self.settings.relay_unchecked_audio):
                if audio.blocked:
                    result = audio.moderation
                else:
                    result = ModerationResult(audio.error or "", REDACTED_SPEECH, Severity.HIGH, "block")
                await self._hide(update, context, result)
                if audio.blocked:
                    await self._notify_admin(context, update, result, audio.incident_id,
                                             Role(role_name) if role_name else Role.UNKNOWN, transcript=audio.text)
                return
        if not text.strip():
            return
        ts = msg.date.timestamp() if msg.date else time.time()
        outcome: MessageOutcome | None = None
        if lesson:
            outcome = self.assistant.process_message(lesson["id"], str(user.id), self._name(update), text,
                                                     ref=msg.message_id, ts=ts)
            result, incident_id = outcome.moderation, outcome.incident_id
            role = self.assistant.resolve_role(lesson, str(user.id), None)
        else:
            result, incident_id = self.assistant.moderate_chat_message(str(chat.id), str(user.id), self._name(update),
                                                                       text, ref=msg.message_id, ts=ts)
            role = Role.UNKNOWN

        if result.blocked:
            await self._hide(update, context, result)
            await self._notify_admin(context, update, result, incident_id, role)
            return
        if result.action == "warn":
            await msg.reply_text(result.warning or "")
            await self._notify_admin(context, update, result, incident_id, role)
        if outcome and outcome.parent_note is not None:
            try:
                await msg.delete()
            except TelegramError:
                pass
            await self._safe(lambda t: context.bot.send_message(user.id, t),
                             "📝 Заметка для родителей сохранена. В групповом чате удобнее писать /note текст.")
            return

        if outcome and (outcome.new_words or outcome.new_homework):
            parts = []
            if outcome.new_words:
                count = plural(len(outcome.new_words), "слово", "слова", "слов")
                parts.append(f"📚 Записал {count}: " + ", ".join(w.word for w in outcome.new_words))
            if outcome.new_homework:
                parts.append(f"📝 Записал домашнее задание ({len(outcome.new_homework)} п.)")
            await msg.reply_text("\n".join(parts))
            return

        command = detect_command(text)
        if command and update.message is not None:  # на правки сообщений не отвечаем повторно
            await self._answer(update, command)

    async def _hide(self, update: Update, context: ContextTypes.DEFAULT_TYPE, result: ModerationResult) -> None:
        msg, chat = update.effective_message, update.effective_chat
        deleted = False
        ids = [msg.message_id] + [r for r in result.related_refs if isinstance(r, int)]
        try:
            if len(ids) > 1:
                deleted = await context.bot.delete_messages(chat.id, ids)
            else:
                deleted = await msg.delete()
        except TelegramError as exc:
            log.warning("Не удалось удалить сообщение %s: %s", msg.message_id, exc)
        name = self._name(update)
        warning = result.warning if result.findings else UNCHECKED_SPEECH_WARNING
        if deleted:
            text = f"{warning}\n\n{name}: {result.redacted_text}"
            await context.bot.send_message(chat.id, text, disable_web_page_preview=True)
        else:
            await msg.reply_text(f"{warning}\n(Не удалось удалить сообщение — нужны права администратора.)")

    async def on_private_text(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg = update.effective_message
        text = msg.text or ""
        command = detect_command(text)
        if command:
            await self._answer(update, command)
            return
        if len(text) >= 200 and text.count("\n") >= 2:
            await self._analyze(update, context, text)
            return
        r = self.assistant.moderate(text)
        if r.is_violation:
            await msg.reply_text(f"Проверка: {r.summary or 'нарушение'} — в чате урока такое сообщение было бы "
                                 f"{'скрыто' if r.blocked else 'помечено'}.")
            return
        await msg.reply_text("Пришлите расшифровку урока (текстом или файлом .txt) — подготовлю конспект, словарь, "
                             "тест и ДЗ. Или спросите: «новые слова сегодня», «дз», «мой словарь». /help — справка.")

    async def on_private_document(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        doc = update.effective_message.document
        if not doc:
            return
        if doc.file_size and doc.file_size > MAX_TRANSCRIPT_BYTES:
            await update.effective_message.reply_text("Файл слишком большой (максимум 2 МБ).")
            return
        file = await doc.get_file()
        data = bytes(await file.download_as_bytearray())
        for enc in ("utf-8-sig", "cp1251"):
            try:
                text = data.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            await update.effective_message.reply_text("Не удалось прочитать файл: нужен текст в UTF-8 или Windows-1251.")
            return
        await self._analyze(update, context, text, title=doc.file_name)

    async def _analyze_recording(self, update: Update, context: ContextTypes.DEFAULT_TYPE, attachment: Any) -> None:
        msg = update.effective_message
        if not self.assistant.speech_available:
            await msg.reply_text("Распознавание речи на сервере не установлено — пришлите расшифровку текстом.")
            return
        if attachment.file_size and attachment.file_size > MAX_BOT_DOWNLOAD:
            await msg.reply_text("Telegram позволяет боту скачивать файлы до 20 МБ. Длинную запись загрузите командой\n"
                                 "python -m tutor_assistant analyze запись.mp3")
            return
        await msg.reply_text("⏳ Расшифровываю запись урока… Это может занять несколько минут.")
        try:
            data = await self._download(attachment)
            report, violations, _ = await asyncio.to_thread(self.assistant.analyze_audio, data,
                                                            getattr(attachment, "file_name", None))
        except Exception as exc:
            log.exception("Ошибка анализа записи")
            await msg.reply_text(f"Не удалось обработать запись: {exc}")
            return
        await self._send_report_with_violations(context, update.effective_chat.id, report, violations)

    async def _send_report_with_violations(self, context: ContextTypes.DEFAULT_TYPE, chat_id: int, report: Any,
                                           violations: list[dict[str, Any]]) -> None:
        await self._send_long(context, chat_id, render.render_report(report))
        if violations:
            lines = [f"• {v['speaker']}: {v['summary']} — «{v['original_text'][:200]}»" for v in violations]
            await self._send_long(context, chat_id, "🚨 Нарушения правил общения:\n" + "\n".join(lines))

    async def _analyze(self, update: Update, context: ContextTypes.DEFAULT_TYPE, text: str,
                       title: str | None = None) -> None:
        user = update.effective_user
        await update.effective_message.reply_text("⏳ Анализирую урок…")
        try:
            report, violations = await asyncio.to_thread(self.assistant.analyze_transcript, text, title,
                                                         str(user.id) if user else None)
        except Exception:
            log.exception("Ошибка анализа расшифровки")
            await update.effective_message.reply_text("Не удалось обработать расшифровку. Проверьте формат: "
                                                      "«Имя: реплика» на каждой строке.")
            return
        await self._send_report_with_violations(context, update.effective_chat.id, report, violations)

    # -- анонимный мост ------------------------------------------------------------
    def _is_school_admin(self, update: Update) -> bool:
        user = update.effective_user
        return bool(user) and str(user.id) in self.settings.admin_user_ids

    async def _notify_admin_text(self, context: ContextTypes.DEFAULT_TYPE, text: str) -> None:
        if not self.settings.admin_chat_id:
            return
        try:
            await self._send_long(context, int(self.settings.admin_chat_id), text)
        except (TelegramError, ValueError) as exc:
            log.warning("Не удалось уведомить администратора: %s", exc)

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg, user, chat = update.effective_message, update.effective_user, update.effective_chat
        if not context.args or chat.type != ChatType.PRIVATE:
            if chat.type == ChatType.PRIVATE and self.relay.pairs_for(str(user.id)):
                await msg.reply_text(RELAY_HELP)
            else:
                await self.cmd_help(update, context)
            return
        if context.args[0].startswith("p_"):
            await self._parent_start(update, context, context.args[0][2:])
            return
        try:
            pair, role = self.relay.bind(context.args[0], str(user.id))
        except RelayError as exc:
            await msg.reply_text(f"❌ {exc}")
            return
        other_role = pair.other_role(role)
        await msg.reply_text(f"✅ Вы подключены как {ROLE_RU[role]} «{pair.alias(role)}». "
                             f"Ваш собеседник: {ROLE_RU[other_role]} «{pair.alias(other_role)}».\n\n{RELAY_HELP}")
        other = pair.other_user(role)
        if other:
            try:
                await context.bot.send_message(int(other), f"🔔 {ROLE_RU[role].capitalize()} «{pair.alias(role)}» "
                                                           "подключился. Можно писать.")
            except TelegramError as exc:
                log.warning("Не удалось уведомить собеседника: %s", exc)
        await self._notify_admin_text(context, f"🔗 Пара {pair.id}: подключился {ROLE_RU[role]} «{pair.alias(role)}» "
                                               f"(id {user.id}, {self._name(update)})")

    async def cmd_new_pair(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg = update.effective_message
        if update.effective_chat.type != ChatType.PRIVATE:
            await msg.reply_text("Создавайте пары в личном чате с ботом, чтобы ссылки не увидели посторонние.")
            return
        if not self._is_school_admin(update):
            await msg.reply_text("Создавать пары могут только администраторы школы (TUTOR_ADMIN_USER_IDS).")
            return
        raw = " ".join(context.args or [])
        tutor_alias, _, student_alias = raw.partition("|")
        pair = self.relay.create_pair(tutor_alias, student_alias, created_by=str(update.effective_user.id))
        t_payload, s_payload = self.relay.invite_payloads(pair)
        parent_code = self.assistant.create_parent_invite(pair.chat_id, pair.student_alias,
                                                          created_by=str(update.effective_user.id))
        link = lambda p: self._link(context, p)  # noqa: E731
        await msg.reply_text(
            f"✅ Пара {pair.id} создана: «{pair.tutor_alias}» ↔ «{pair.student_alias}».\n\n"
            f"Ссылка для преподавателя:\n{link(t_payload)}\n\nСсылка для ученика:\n{link(s_payload)}\n\n"
            f"Ссылка для родителей (отчёты после уроков, до 2 человек):\n{link('p_' + parent_code)}\n\n"
            "Ссылки преподавателя и ученика срабатывают для одного человека. Отправьте их участникам по каналам школы. "
            "Отключить пару: /unpair " + pair.id,
            disable_web_page_preview=True)

    async def cmd_pairs(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self._is_school_admin(update) or update.effective_chat.type != ChatType.PRIVATE:
            await update.effective_message.reply_text("Список пар доступен администраторам школы в личном чате с ботом.")
            return
        pairs = self.relay.list()
        if not pairs:
            await update.effective_message.reply_text("Пар пока нет. Создать: /new_pair Имя преподавателя | Имя ученика")
            return
        mark = lambda uid: "✅" if uid else "⏳"  # noqa: E731
        lines = [f"{p.id}: {mark(p.tutor_user_id)} «{p.tutor_alias}» (id {p.tutor_user_id or '—'}) ↔ "
                 f"{mark(p.student_user_id)} «{p.student_alias}» (id {p.student_user_id or '—'})" for p in pairs]
        await self._send_long(context, update.effective_chat.id, "Активные пары:\n" + "\n".join(lines))

    async def cmd_unpair(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg = update.effective_message
        if not self._is_school_admin(update):
            await msg.reply_text("Отключать пары могут только администраторы школы.")
            return
        if not context.args:
            await msg.reply_text("Использование: /unpair <id пары>")
            return
        pair = self.relay.get(context.args[0])
        if not pair or not self.relay.deactivate(pair.id):
            await msg.reply_text("Активная пара с таким id не найдена.")
            return
        await msg.reply_text(f"Пара {pair.id} отключена.")
        for uid in (pair.tutor_user_id, pair.student_user_id):
            if uid:
                try:
                    await context.bot.send_message(int(uid), "ℹ️ Общение с собеседником через бот завершено школой.")
                except TelegramError:
                    pass

    async def cmd_chats(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        uid = str(update.effective_user.id)
        pairs = self.relay.pairs_for(uid)
        if not pairs:
            await update.effective_message.reply_text("Вы пока не подключены ни к одному собеседнику. "
                                                      "Откройте ссылку-приглашение от школы.")
            return
        current = self.relay.current(uid)
        buttons = [[InlineKeyboardButton(
            ("▶️ " if current and current[0].id == p.id else "") + p.alias(p.other_role(role)),
            callback_data=f"relay_sw:{p.id}")] for p, role in pairs]
        await update.effective_message.reply_text("С кем переписываться?", reply_markup=InlineKeyboardMarkup(buttons))

    async def on_switch_chat(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        query = update.callback_query
        pair_id = (query.data or "").split(":", 1)[-1]
        try:
            pair, role = self.relay.switch(str(query.from_user.id), pair_id)
        except RelayError as exc:
            await query.answer(str(exc), show_alert=True)
            return
        await query.answer()
        await query.edit_message_text(f"Теперь ваши сообщения уходят: «{pair.alias(pair.other_role(role))}».")

    async def _relay_lesson_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE, title: str | None) -> None:
        msg, uid = update.effective_message, str(update.effective_user.id)
        current = self.relay.current(uid)
        if not current:
            await msg.reply_text("Урок ведётся с учеником через бот. Сначала подключитесь по ссылке от школы "
                                 "или выберите собеседника: /chats. А расшифровку урока можно прислать сюда файлом.")
            return
        pair, role = current
        if role != TUTOR:
            await msg.reply_text("Урок начинает преподаватель.")
            return
        if self.assistant.storage.active_lesson(pair.chat_id):
            await msg.reply_text("Урок уже идёт. Завершить: /lesson_end")
            return
        lesson = self.assistant.start_lesson(chat_id=pair.chat_id, tutor_id=uid, tutor_name=pair.tutor_alias,
                                             student_id=pair.student_user_id, student_name=pair.student_alias,
                                             title=title, require_recording=self.settings.require_recording)
        text = (f"▶️ Урок начат{f': {title}' if title else ''}. Я записываю новые слова и домашнее задание.\n"
                "Напоминаю: обмен личными контактами и общение вне платформы запрещены.\n\n"
                + self._recording_notice(lesson["id"]))
        markup = self._classroom_markup(pair.chat_id)
        await msg.reply_text(text, reply_markup=markup)
        if pair.student_user_id:
            await context.bot.send_message(int(pair.student_user_id), f"▶️ «{pair.tutor_alias}» начал урок"
                                                                       f"{f': {title}' if title else ''}.\n\n"
                                                                       + RECORDING_NOTICE, reply_markup=markup)

    async def _relay_lesson_end(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg, uid = update.effective_message, str(update.effective_user.id)
        current = self.relay.current(uid)
        if not current:
            await msg.reply_text("Сейчас нет активного урока.")
            return
        pair, role = current
        lesson = self.assistant.storage.active_lesson(pair.chat_id)
        if not lesson:
            await msg.reply_text("Сейчас нет активного урока. Начать: /lesson_start")
            return
        if role != TUTOR and not self._is_school_admin(update):
            await msg.reply_text("Завершить урок может преподаватель.")
            return
        await msg.reply_text("⏳ Готовлю конспект, словарь, тест и домашнее задание…")
        try:
            report = await asyncio.to_thread(self.assistant.finish_lesson, lesson["id"])
        except Exception:
            log.exception("Ошибка при завершении урока %s", lesson["id"])
            await msg.reply_text("Не удалось подготовить отчёт. Урок сохранён — попробуйте /lesson_end ещё раз.")
            return
        await self._deliver_reports(context, report, chat_key=pair.chat_id,
                                    student_targets=[int(pair.student_user_id)] if pair.student_user_id else [],
                                    tutor_target=int(pair.tutor_user_id) if pair.tutor_user_id else None)

    @staticmethod
    def _hidden_parts(msg: Any) -> tuple[list[str], list[str]]:
        """Скрытые ссылки и упоминания аккаунтов в разметке сообщения: (для проверки, для показа)."""
        check, show = [], []
        for ent in list(msg.entities or ()) + list(msg.caption_entities or ()):
            if ent.type == MessageEntity.TEXT_LINK and ent.url:
                check.append(ent.url)
                show.append(ent.url)
            elif ent.type == MessageEntity.TEXT_MENTION and ent.user:
                check.append(f"tg://user?id={ent.user.id}")  # ссылка на аккаунт — всегда нарушение
        if getattr(msg, "contact", None):
            check.append(f"мой номер телефона {msg.contact.phone_number or ''} контакт {msg.contact.user_id or ''}")
        return check, show

    async def on_private_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg, user = update.effective_message, update.effective_user
        if not msg or not user or user.is_bot:
            return
        uid = str(user.id)
        target: tuple[Pair, str, int | None] | None = None
        if msg.reply_to_message:
            target = self.relay.resolve_reply(uid, msg.reply_to_message.message_id)
        if target is None:
            current = self.relay.current(uid)
            if current:
                target = (current[0], current[1], None)
            elif self.relay.pairs_for(uid):
                await msg.reply_text("У вас несколько собеседников — выберите, кому писать: /chats")
                return
        if target is None and self.assistant.storage.parent_chats(uid):
            await self._parent_message(update)
            return
        if target is None:
            recording = self._speech_attachment(msg) or (
                msg.document if msg.document and (msg.document.mime_type or "").startswith(("audio/", "video/")) else None)
            if recording is not None:
                await self._analyze_recording(update, context, recording)
            elif msg.document:
                await self.on_private_document(update, context)
            elif msg.text:
                await self.on_private_text(update, context)
            return
        await self._relay(update, context, *target)

    async def _relay(self, update: Update, context: ContextTypes.DEFAULT_TYPE, pair: Pair, role: str,
                     reply_to: int | None) -> None:
        msg, user = update.effective_message, update.effective_user
        uid = str(user.id)
        alias = pair.alias(role)
        if msg.location or msg.venue or msg.poll or msg.dice or msg.game or msg.story:
            await msg.reply_text("Этот тип сообщений через бот не передаётся.")
            return
        if msg.text and detect_command(msg.text):
            await self._answer(update, detect_command(msg.text) or "help")
            return
        if role == TUTOR and msg.text and parent_note(msg.text) is not None \
                and not self.assistant.storage.active_lesson(pair.chat_id):
            await msg.reply_text("Заметки для родителей сохраняются во время урока (после /lesson_start). "
                                 "Ученику сообщение не отправлено.")
            return

        speech = self._speech_attachment(msg)
        if (msg.audio or msg.video) and not self.settings.relay_media:
            await msg.reply_text("Пересылка аудио- и видеофайлов отключена школой.")
            return
        audio: AudioOutcome | None = None
        if speech is not None:
            lesson = self.assistant.storage.active_lesson(pair.chat_id)
            audio = await self._check_speech(update, speech, lesson, pair.chat_id, alias, role)
            if not audio.checked and not self.settings.relay_unchecked_audio:
                await msg.reply_text("🎤 Сообщение не доставлено: не удалось проверить речь "
                                     f"({audio.error or 'ошибка распознавания'}). Напишите, пожалуйста, текстом.")
                return
            if audio.blocked:
                await self._notify_admin_text(context, (
                    f"🚨 Нарушение #{audio.incident_id or '—'} (анонимный мост, пара {pair.id}, голосовое): "
                    f"{audio.moderation.summary}\nКто: {ROLE_RU[role]} «{alias}» — аккаунт {self._name(update)}, "
                    f"id {uid}\nРасшифровка:\n{audio.text}"))
                await msg.reply_text(f"🚫 Голосовое сообщение не доставлено.\n{audio.moderation.warning}")
                return

        text = msg.text or msg.caption or ""
        hidden_check, hidden_show = self._hidden_parts(msg)
        check_text = "\n".join([text, *hidden_check]).strip()
        ts = msg.date.timestamp() if msg.date else time.time()
        outcome: MessageOutcome | None = audio.outcome if audio else None
        result: ModerationResult | None = None
        incident_id = None
        if check_text:
            lesson = self.assistant.storage.active_lesson(pair.chat_id)
            if lesson:
                outcome = self.assistant.process_message(lesson["id"], uid, alias, check_text, role=role,
                                                         ref=msg.message_id, ts=ts)
                result, incident_id = outcome.moderation, outcome.incident_id
            else:
                result, incident_id = self.assistant.moderate_chat_message(pair.chat_id, uid, alias, check_text,
                                                                           role=role, ref=msg.message_id, ts=ts)

        if result is not None and result.is_violation:
            await self._notify_admin_text(context, (
                f"🚨 Нарушение #{incident_id or '—'} (анонимный мост, пара {pair.id}): {result.summary}\n"
                f"Кто: {ROLE_RU[role]} «{alias}» — аккаунт {self._name(update)}, id {uid}\n"
                f"Действие: {'не доставлено' if result.blocked else 'доставлено с предупреждением'}\n"
                f"Исходный текст:\n{result.original_text}"))
        if msg.contact and (result is None or not result.blocked):
            # Карточка контакта раскрывает аккаунт даже без номера — не пересылается никогда.
            await msg.reply_text("🚫 Контакты через бот не передаются.")
            return
        if result is not None and result.blocked:
            await msg.reply_text(f"🚫 Сообщение не доставлено.\n{result.warning}")
            # Части номера, отправленные раньше, уже у собеседника — удаляем их копии.
            refs = [r for r in result.related_refs if isinstance(r, int)]
            for chat_id, message_id in self.relay.delivered_copies(uid, refs):
                try:
                    await context.bot.delete_message(int(chat_id), message_id)
                except TelegramError as exc:
                    log.warning("Не удалось удалить копию %s: %s", message_id, exc)
            return
        if result is not None and result.action == "warn":
            await msg.reply_text(result.warning or "")
        if outcome is not None and outcome.parent_note is not None:
            await msg.reply_text("📝 Заметка для родителей сохранена — ученику она не отправлена.")
            return

        other = pair.other_user(role)
        if not other:
            await msg.reply_text(f"⏳ {ROLE_RU[pair.other_role(role)].capitalize()} ещё не подключился к боту — "
                                 "сообщение не доставлено. Попробуйте позже.")
            return
        is_media = not msg.text and msg.effective_attachment is not None
        if is_media and speech is None and not self.settings.relay_media:
            await msg.reply_text("Пересылка фото, файлов и голосовых сообщений отключена школой.")
            return

        reply = ReplyParameters(message_id=reply_to, allow_sending_without_reply=True) if reply_to else None
        links = "".join(f"\n🔗 {u}" for u in hidden_show)
        try:
            if msg.text:
                # Текст отправляется без исходной разметки: скрытые ссылки и упоминания аккаунтов не передаются.
                sent = await context.bot.send_message(int(other), f"{alias}: {msg.text}{links}",
                                                      reply_parameters=reply, disable_web_page_preview=True)
            elif msg.photo or msg.video or msg.document or msg.audio or msg.voice or msg.animation:
                caption = f"{alias}: {msg.caption}{links}" if msg.caption else f"{alias}"
                sent = await context.bot.copy_message(int(other), from_chat_id=msg.chat_id, message_id=msg.message_id,
                                                      caption=caption[:CAPTION_LIMIT], reply_parameters=reply)
            else:  # стикеры, кружочки — без подписи
                await context.bot.send_message(int(other), f"{alias}:", reply_parameters=reply)
                sent = await context.bot.copy_message(int(other), from_chat_id=msg.chat_id, message_id=msg.message_id)
        except TelegramError as exc:
            log.warning("Не удалось доставить сообщение в паре %s: %s", pair.id, exc)
            await msg.reply_text("Не удалось доставить сообщение (возможно, собеседник остановил бота).")
            return
        self.relay.record(pair, uid, msg.message_id, other, sent.message_id)

        if outcome and (outcome.new_words or outcome.new_homework):
            parts = []
            if outcome.new_words:
                count = plural(len(outcome.new_words), "слово", "слова", "слов")
                parts.append(f"📚 Записал {count}: " + ", ".join(w.word for w in outcome.new_words))
            if outcome.new_homework:
                parts.append(f"📝 Записал домашнее задание ({len(outcome.new_homework)} п.)")
            await msg.reply_text("\n".join(parts))

    async def on_error(self, update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
        log.error("Ошибка при обработке обновления", exc_info=context.error)

    # -- сборка ---------------------------------------------------------------
    async def _post_init(self, app: Application) -> None:
        if not self.assistant.speech_available:
            log.warning("Распознавание речи недоступно: %s", self.assistant.transcriber.last_error)
        app.create_task(self._watchdog(app))

    def build(self) -> Application:
        if not self.settings.telegram_token:
            raise SystemExit("Не задан TELEGRAM_BOT_TOKEN (см. .env.example)")
        app = Application.builder().token(self.settings.telegram_token).post_init(self._post_init).build()
        app.add_handler(CommandHandler("start", self.cmd_start))
        app.add_handler(CommandHandler("help", self.cmd_help))
        app.add_handler(CommandHandler("new_pair", self.cmd_new_pair))
        app.add_handler(CommandHandler("pairs", self.cmd_pairs))
        app.add_handler(CommandHandler("unpair", self.cmd_unpair))
        app.add_handler(CommandHandler("chats", self.cmd_chats))
        app.add_handler(CallbackQueryHandler(self.on_switch_chat, pattern=r"^relay_sw:"))
        app.add_handler(CommandHandler("lesson_start", self.cmd_lesson_start))
        app.add_handler(CommandHandler("lesson_end", self.cmd_lesson_end))
        commands: dict[str, Any] = {
            "words": "words_lesson", "words_today": "words_today", "dictionary": "words_all", "homework": "homework",
            "test": "test", "answers": "answers", "summary": "summary", "report": "report",
        }
        for cmd, name in commands.items():
            app.add_handler(CommandHandler(cmd, self._command(name)))
        app.add_handler(CommandHandler("check", self.cmd_check))
        app.add_handler(CommandHandler("incidents", self.cmd_incidents))
        app.add_handler(CommandHandler("recording", self.cmd_recording))
        app.add_handler(CommandHandler("note", self.cmd_note))
        app.add_handler(CommandHandler("parent_link", self.cmd_parent_link))
        app.add_handler(CommandHandler("cabinet", self.cmd_cabinet))
        app.add_handler(CommandHandler("classroom", self.cmd_classroom))
        speech = filters.VOICE | filters.VIDEO_NOTE | filters.AUDIO | filters.VIDEO
        group = filters.ChatType.GROUPS & (filters.TEXT | filters.CAPTION | speech) & ~filters.COMMAND
        app.add_handler(MessageHandler(group, self.on_group_message))
        # Правки сообщений в личке не пересылаются и не обрабатываются: собеседник видит только исходную версию.
        app.add_handler(MessageHandler(filters.ChatType.PRIVATE & ~filters.COMMAND & ~filters.UpdateType.EDITED_MESSAGE,
                                       self.on_private_message))
        app.add_error_handler(self.on_error)
        return app


def run_bot(settings: Settings, with_site: bool = False, host: str | None = None, port: int | None = None) -> None:
    """Запустить бота. С ``with_site`` в том же процессе работают сайт школы и HTTP API."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    bot = TutorBot(settings)
    app = bot.build()
    server = None
    if with_site:
        from .api import make_server

        host, port = host or settings.api_host, port or settings.api_port
        server = make_server(bot.assistant, host, port)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        log.info("Сайт и HTTP API: http://%s:%s", host, port)
    log.info("Бот запущен")
    try:
        app.run_polling(allowed_updates=Update.ALL_TYPES)
    finally:
        if server:
            server.shutdown()
            server.server_close()
