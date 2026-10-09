"""Telegram-бот: модератор чата урока и помощник преподавателя.

Как подключить:
1. Создайте бота у @BotFather, токен — в TELEGRAM_BOT_TOKEN.
2. В @BotFather: /setprivacy → Disable (иначе бот не видит обычные сообщения группы).
3. Добавьте бота в чат урока и сделайте администратором с правом «Удалять сообщения».
4. Преподаватель пишет /lesson_start, в конце — /lesson_end.

В личных сообщениях боту можно прислать расшифровку урока (текстом или .txt) —
бот вернёт конспект, слова, тест, ДЗ и список нарушений.
"""

from __future__ import annotations

import asyncio
import io
import logging
import time
from typing import Any

from . import render
from .commands import HELP_TEXT, detect_command
from .config import Settings
from .contact_guard import ModerationResult
from .models import Role
from .service import MessageOutcome, TutorAssistant
from .summary import plural

log = logging.getLogger(__name__)

try:
    from telegram import Update
    from telegram.constants import ChatMemberStatus, ChatType
    from telegram.error import TelegramError
    from telegram.ext import (
        Application,
        CommandHandler,
        ContextTypes,
        MessageHandler,
        filters,
    )
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Для бота установите зависимость: pip install python-telegram-bot") from exc

MAX_TRANSCRIPT_BYTES = 2 * 1024 * 1024


class TutorBot:
    def __init__(self, settings: Settings, assistant: TutorAssistant | None = None):
        self.settings = settings
        self.assistant = assistant or TutorAssistant(settings)
        self._warned_no_rights: set[int] = set()

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
                            incident_id: int | None, role: Role) -> None:
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
            f"Исходный текст:\n{result.original_text}"
        )
        try:
            await self._send_long(context, int(self.settings.admin_chat_id), text)
        except (TelegramError, ValueError) as exc:
            log.warning("Не удалось уведомить администратора: %s", exc)

    # -- команды ---------------------------------------------------------------
    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        await update.effective_message.reply_text(HELP_TEXT + "\nКоманды: /lesson_start [тема], /lesson_end, /words, "
                                                  "/words_today, /dictionary, /homework, /test, /answers, /summary, "
                                                  "/report, /check <текст>, /incidents")

    async def cmd_lesson_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        chat, user, msg = update.effective_chat, update.effective_user, update.effective_message
        if chat.type == ChatType.PRIVATE:
            await msg.reply_text("Урок ведётся в групповом чате с учеником. В личке пришлите расшифровку урока — "
                                 "я подготовлю конспект, тест и ДЗ.")
            return
        title = " ".join(context.args) if context.args else None
        existing = self.assistant.storage.active_lesson(str(chat.id))
        if existing:
            await msg.reply_text("Урок уже идёт. Завершить: /lesson_end")
            return
        lesson = self.assistant.start_lesson(chat_id=str(chat.id), tutor_id=str(user.id), tutor_name=self._name(update),
                                             title=title)
        text = (f"▶️ Урок начат{f': {title}' if title else ''}. Преподаватель: {self._name(update)}.\n"
                "Я записываю новые слова («Новые слова сегодня: …») и домашнее задание («ДЗ: …»).\n"
                "Напоминаю: обмен личными контактами и общение вне платформы запрещены.")
        await msg.reply_text(text)
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
        await self._send_long(context, chat.id, render.render_report(report, with_answers=False))
        md = render.render_report_markdown(report).encode("utf-8")
        try:
            await context.bot.send_document(chat.id, document=io.BytesIO(md), filename=f"konspekt_{report.date}.md",
                                            caption="Конспект урока (с ответами к тесту)")
        except TelegramError as exc:
            log.warning("Не удалось отправить файл конспекта: %s", exc)

    async def _answer(self, update: Update, command: str) -> None:
        chat, user = update.effective_chat, update.effective_user
        if chat.type == ChatType.PRIVATE:
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

    # -- сообщения ---------------------------------------------------------------
    async def on_group_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg, chat, user = update.effective_message, update.effective_chat, update.effective_user
        if not msg or not user or user.is_bot:
            return
        text = msg.text or msg.caption or ""
        if not text.strip():
            return
        lesson = self.assistant.storage.active_lesson(str(chat.id))
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
        if deleted:
            text = f"{result.warning}\n\n{name}: {result.redacted_text}"
            await context.bot.send_message(chat.id, text, disable_web_page_preview=True)
        else:
            await msg.reply_text(f"{result.warning}\n(Не удалось удалить сообщение — нужны права администратора.)")

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
        chat_id = update.effective_chat.id
        await self._send_long(context, chat_id, render.render_report(report))
        if violations:
            lines = [f"• {v['speaker']}: {v['summary']} — «{v['original_text'][:200]}»" for v in violations]
            await self._send_long(context, chat_id, "🚨 Нарушения правил общения:\n" + "\n".join(lines))

    async def on_error(self, update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
        log.error("Ошибка при обработке обновления", exc_info=context.error)

    # -- сборка ---------------------------------------------------------------
    def build(self) -> Application:
        if not self.settings.telegram_token:
            raise SystemExit("Не задан TELEGRAM_BOT_TOKEN (см. .env.example)")
        app = Application.builder().token(self.settings.telegram_token).build()
        app.add_handler(CommandHandler(["start", "help"], self.cmd_help))
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
        group = filters.ChatType.GROUPS & (filters.TEXT | filters.CAPTION) & ~filters.COMMAND
        app.add_handler(MessageHandler(group, self.on_group_message))
        app.add_handler(MessageHandler(filters.ChatType.PRIVATE & filters.Document.ALL, self.on_private_document))
        app.add_handler(MessageHandler(filters.ChatType.PRIVATE & filters.TEXT & ~filters.COMMAND
                                       & ~filters.UpdateType.EDITED_MESSAGE, self.on_private_text))
        app.add_error_handler(self.on_error)
        return app


def run_bot(settings: Settings) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    app = TutorBot(settings).build()
    log.info("Бот запущен")
    app.run_polling(allowed_updates=Update.ALL_TYPES)
