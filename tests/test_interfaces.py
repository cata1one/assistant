"""Консоль, распознавание запросов и Telegram-бот (на подменённых объектах Telegram)."""

import asyncio
import json
import types
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from tutor_assistant.cli import main
from tutor_assistant.commands import detect_command
from tutor_assistant.config import Settings, load_dotenv
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage


@pytest.mark.parametrize("text, cmd", [
    ("новые слова сегодня", "words_today"),
    ("Новые слова сегодня?", "words_today"),
    ("какие слова мы сегодня выучили", "words_today"),
    ("слова за сегодня", "words_today"),
    ("новые слова", "words_lesson"),
    ("мой словарь", "words_all"),
    ("ДЗ", "homework"),
    ("какое домашнее задание?", "homework"),
    ("что задали", "homework"),
    ("тест", "test"),
    ("проверь меня", "test"),
    ("ответы", "answers"),
    ("конспект урока", "summary"),
    ("что мы прошли на уроке", "summary"),
    ("помощь", "help"),
    ("бот, дз пожалуйста", "homework"),
])
def test_detect_command(text, cmd):
    assert detect_command(text) == cmd


@pytest.mark.parametrize("text", [
    "Новые слова сегодня: apple — яблоко",  # объявление, а не запрос
    "ДЗ: выучить слова",
    "Сегодня мы выучим новые слова про дом, а потом сделаем тест и разберём домашнее задание",
    "напиши тест на английском",
    "",
])
def test_not_a_command(text):
    assert detect_command(text) is None


def test_dotenv(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text('# comment\nTUTOR_TARGET_LANGUAGE="de"\nexport TUTOR_ALLOWED_HANDLES=@School_Bot, help\n',
                   encoding="utf-8")
    monkeypatch.delenv("TUTOR_TARGET_LANGUAGE", raising=False)
    monkeypatch.delenv("TUTOR_ALLOWED_HANDLES", raising=False)
    load_dotenv(env)
    s = Settings.from_env(dotenv=None)
    assert s.target_language == "de" and s.allowed_handles == ("school_bot", "help")


# -- CLI ----------------------------------------------------------------------------


def test_cli_analyze(tmp_path, capsys, monkeypatch, sample_lesson):
    monkeypatch.setenv("TUTOR_LLM", "off")
    f = tmp_path / "lesson.txt"
    f.write_bytes(sample_lesson.encode("cp1251", errors="ignore"))  # файл из Windows
    md = tmp_path / "out.md"
    assert main(["--db", str(tmp_path / "db.sqlite3"), "analyze", str(f), "--md", str(md)]) == 0
    out = capsys.readouterr().out
    assert "Новые слова урока" in out and "Нарушения правил общения" in out
    assert md.read_text(encoding="utf-8").startswith("# Конспект урока")


def test_cli_analyze_json(tmp_path, capsys, monkeypatch, sample_lesson):
    monkeypatch.setenv("TUTOR_LLM", "off")
    f = tmp_path / "lesson.txt"
    f.write_text(sample_lesson, encoding="utf-8")
    assert main(["--db", str(tmp_path / "db.sqlite3"), "analyze", str(f), "--json", "--save", "--student", "5"]) == 0
    data = json.loads(capsys.readouterr().out)
    assert data["report"]["vocabulary"] and len(data["violations"]) == 3
    assert main(["--db", str(tmp_path / "db.sqlite3"), "words", "--student", "5", "--today"]) == 0
    assert "kitchen" in capsys.readouterr().out
    assert main(["--db", str(tmp_path / "db.sqlite3"), "incidents"]) == 0
    assert "anna_english_tutor" in capsys.readouterr().out


def test_cli_check(tmp_path, capsys, monkeypatch):
    monkeypatch.setenv("TUTOR_LLM", "off")
    db = ["--db", str(tmp_path / "db.sqlite3")]
    assert main(db + ["check", "мой", "номер", "89001234567"]) == 1
    assert "BLOCK" in capsys.readouterr().out
    assert main(db + ["check", "Hello, how are you?"]) == 0


def test_cli_missing_file(tmp_path, capsys, monkeypatch):
    monkeypatch.setenv("TUTOR_LLM", "off")
    assert main(["--db", str(tmp_path / "db.sqlite3"), "analyze", str(tmp_path / "nope.txt")]) == 2


# -- Telegram-бот ------------------------------------------------------------------------


class Ctx:
    def __init__(self, args=None):
        self.args = args or []
        self.bot = types.SimpleNamespace(
            id=999,
            send_message=AsyncMock(),
            send_document=AsyncMock(),
            delete_messages=AsyncMock(return_value=True),
            get_chat_member=AsyncMock(return_value=types.SimpleNamespace(status="administrator",
                                                                         can_delete_messages=True)),
        )
        self.error = None


def make_update(text, user_id=1, name="Анна", chat_id=-100, chat_type="supergroup", message_id=1):
    msg = types.SimpleNamespace(text=text, caption=None, message_id=message_id,
                                date=datetime(2026, 1, 1, tzinfo=timezone.utc),
                                reply_text=AsyncMock(), delete=AsyncMock(return_value=True), document=None)
    user = types.SimpleNamespace(id=user_id, full_name=name, username=None, is_bot=False)
    chat = types.SimpleNamespace(id=chat_id, type=chat_type, title="Урок")
    return types.SimpleNamespace(effective_message=msg, message=msg, effective_user=user, effective_chat=chat)


@pytest.fixture
def bot():
    from tutor_assistant.telegram_bot import TutorBot

    settings = Settings(llm_mode="off", admin_chat_id="-555", telegram_token="1:x")
    return TutorBot(settings, TutorAssistant(settings, Storage(":memory:")))


def run(coro):
    return asyncio.run(coro)


def test_bot_lesson_flow(bot):
    ctx = Ctx(["Еда"])
    up = make_update("/lesson_start Еда")
    run(bot.cmd_lesson_start(up, ctx))
    assert "Урок начат" in up.effective_message.reply_text.call_args[0][0]

    up = make_update("Новые слова сегодня: apple — яблоко, pear — груша", message_id=2)
    run(bot.on_group_message(up, Ctx()))
    assert "Записал 2 слова" in up.effective_message.reply_text.call_args[0][0]

    # Ученик пытается передать номер — сообщение удаляется, в чат уходит скрытая версия, админ уведомлён
    ctx = Ctx()
    up = make_update("мой номер 8 916 555 12 34", user_id=2, name="Миша", message_id=3)
    run(bot.on_group_message(up, ctx))
    up.effective_message.delete.assert_awaited()
    sent = [c.args for c in ctx.bot.send_message.call_args_list]
    assert any("[скрыто]" in a[1] and a[0] == -100 for a in sent)
    admin = [a for a in sent if a[0] == -555]
    assert admin and "8 916 555 12 34" in admin[0][1] and "ученик" in admin[0][1]

    # Запрос по ключевым словам
    up = make_update("новые слова сегодня", user_id=2, name="Миша", message_id=4)
    run(bot.on_group_message(up, Ctx()))
    assert "apple" in up.effective_message.reply_text.call_args[0][0]

    # Ученик не может завершить урок
    up = make_update("/lesson_end", user_id=2, name="Миша")
    ctx = Ctx()
    ctx.bot.get_chat_member = AsyncMock(return_value=types.SimpleNamespace(status="member"))
    run(bot.cmd_lesson_end(up, ctx))
    assert "может преподаватель" in up.effective_message.reply_text.call_args[0][0]

    # Преподаватель завершает — отчёт и файл конспекта
    ctx = Ctx()
    up = make_update("/lesson_end")
    run(bot.cmd_lesson_end(up, ctx))
    report_text = "\n".join(c.args[1] for c in ctx.bot.send_message.call_args_list)
    assert "Конспект урока" in report_text and "apple" in report_text
    ctx.bot.send_document.assert_awaited()


def test_bot_moderates_without_lesson(bot):
    ctx = Ctx()
    up = make_update("пиши мне в телеграм @vasya_99", user_id=5, name="Вася", chat_id=-200)
    run(bot.on_group_message(up, ctx))
    up.effective_message.delete.assert_awaited()
    assert bot.assistant.storage.incidents(chat_id="-200")


def test_bot_warns_when_cannot_delete(bot):
    up = make_update("звони 89001234567", user_id=5)
    up.effective_message.delete = AsyncMock(return_value=False)
    run(bot.on_group_message(up, Ctx()))
    assert "Не удалось удалить" in up.effective_message.reply_text.call_args[0][0]


def test_bot_private_transcript(bot, sample_lesson):
    ctx = Ctx()
    up = make_update(sample_lesson, chat_id=10, chat_type="private")
    run(bot.on_private_text(up, ctx))
    texts = "\n".join(c.args[1] for c in ctx.bot.send_message.call_args_list)
    assert "Новые слова урока" in texts and "Нарушения правил общения" in texts


def test_bot_incidents_admin_only(bot):
    up = make_update("/incidents", user_id=7)
    ctx = Ctx()
    ctx.bot.get_chat_member = AsyncMock(return_value=types.SimpleNamespace(status="member"))
    run(bot.cmd_incidents(up, ctx))
    assert "только администраторам" in up.effective_message.reply_text.call_args[0][0]
