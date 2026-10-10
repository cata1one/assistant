"""Анонимный мост: преподаватель и ученик общаются только через бота и не видят аккаунтов друг друга."""

import asyncio
import types
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from tutor_assistant.config import Settings
from tutor_assistant.relay import STUDENT, TUTOR, RelayError, RelayService
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage

TUTOR_ID, STUDENT_ID, ADMIN_ID = 111, 222, 999

# -- логика пар ------------------------------------------------------------------------


@pytest.fixture
def relay():
    return RelayService(Storage(":memory:"))


def test_pair_binding(relay):
    pair = relay.create_pair(" Анна Петровна ", "Миша @misha", created_by="9")
    assert pair.tutor_alias == "Анна Петровна" and pair.student_alias == "Миша misha"  # без @ника в псевдониме
    t, s = relay.invite_payloads(pair)
    p, role = relay.bind(t, "111")
    assert role == TUTOR and p.tutor_user_id == "111" and p.student_user_id is None
    p, role = relay.bind(s, "222")
    assert role == STUDENT and p.other_user(STUDENT) == "111" and p.other_user(TUTOR) == "222"
    assert relay.bind(t, "111")[1] == TUTOR  # повторное открытие своей ссылки — не ошибка


@pytest.mark.parametrize("payload", ["", "garbage", "t_short", "x_" + "a" * 16])
def test_invalid_links(relay, payload):
    with pytest.raises(RelayError):
        relay.bind(payload, "1")


def test_link_cannot_be_reused_or_mixed(relay):
    pair = relay.create_pair("A", "B")
    t, s = relay.invite_payloads(pair)
    relay.bind(t, "111")
    with pytest.raises(RelayError, match="уже использована"):
        relay.bind(t, "333")
    with pytest.raises(RelayError, match="одновременно"):
        relay.bind(s, "111")
    with pytest.raises(RelayError):
        relay.bind("s_" + pair.tutor_code, "444")  # код преподавателя с префиксом ученика
    relay.deactivate(pair.id)
    with pytest.raises(RelayError, match="отключена"):
        relay.bind(s, "222")
    assert relay.pairs_for("111") == []


def test_current_pair_and_switch(relay):
    p1, p2 = relay.create_pair("Анна", "Миша"), relay.create_pair("Анна", "Оля")
    relay.bind(relay.invite_payloads(p1)[0], "111")
    assert relay.current("111")[0].id == p1.id
    relay.bind(relay.invite_payloads(p2)[0], "111")  # последняя открытая ссылка — текущий собеседник
    assert relay.current("111")[0].id == p2.id
    relay.switch("111", p1.id)
    assert relay.current("111")[0].id == p1.id
    with pytest.raises(RelayError):
        relay.switch("111", "nope")


def test_reply_resolution(relay):
    pair = relay.create_pair("A", "B")
    t, s = relay.invite_payloads(pair)
    relay.bind(t, "111")
    relay.bind(s, "222")
    relay.record(pair, "111", 10, "222", 500)  # сообщение 10 преподавателя стало 500 у ученика
    p, role, counterpart = relay.resolve_reply("222", 500)
    assert p.id == pair.id and role == STUDENT and counterpart == 10
    p, role, counterpart = relay.resolve_reply("111", 10)  # ответ на собственное сообщение
    assert role == TUTOR and counterpart == 500
    assert relay.resolve_reply("222", 999) is None
    assert relay.delivered_copies("111", [10]) == [("222", 500)]


# -- бот в режиме моста ------------------------------------------------------------------


class Ctx:
    def __init__(self, args=None):
        self.args = args or []
        counter = iter(range(1000, 10_000))
        self.bot = types.SimpleNamespace(
            id=1, username="school_bot",
            send_message=AsyncMock(side_effect=lambda *a, **k: types.SimpleNamespace(message_id=next(counter))),
            copy_message=AsyncMock(side_effect=lambda *a, **k: types.SimpleNamespace(message_id=next(counter))),
            send_document=AsyncMock(), delete_message=AsyncMock(return_value=True),
        )


def pm(user_id, text=None, message_id=1, name="Иван Иванов", reply_to=None, **media):
    msg = types.SimpleNamespace(
        text=text, caption=media.pop("caption", None), message_id=message_id, chat_id=user_id,
        date=datetime(2026, 1, 1, tzinfo=timezone.utc), reply_text=AsyncMock(),
        reply_to_message=types.SimpleNamespace(message_id=reply_to) if reply_to else None,
        entities=media.pop("entities", ()), caption_entities=(), document=None, photo=(), video=None, audio=None,
        voice=None, video_note=None, animation=None, sticker=None, contact=None, location=None, venue=None, poll=None, dice=None,
        game=None, story=None,
    )
    for k, v in media.items():
        setattr(msg, k, v)
    msg.effective_attachment = next((v for k, v in media.items() if v), None)
    user = types.SimpleNamespace(id=user_id, full_name=name, username="real_username", is_bot=False)
    chat = types.SimpleNamespace(id=user_id, type="private", title=None)
    return types.SimpleNamespace(effective_message=msg, message=msg, effective_user=user, effective_chat=chat)


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def bot():
    from tutor_assistant.telegram_bot import TutorBot

    settings = Settings(llm_mode="off", telegram_token="1:x", admin_chat_id="-500", admin_user_ids=(str(ADMIN_ID),))
    return TutorBot(settings, TutorAssistant(settings, Storage(":memory:")))


def connect(bot):
    ctx = Ctx(["Анна Петровна", "|", "Миша"])
    run(bot.cmd_new_pair(pm(ADMIN_ID, "/new_pair"), ctx))
    pair = bot.relay.list()[0]
    t, s = bot.relay.invite_payloads(pair)
    run(bot.cmd_start(pm(TUTOR_ID, name="Анна Смирнова"), Ctx([t])))
    run(bot.cmd_start(pm(STUDENT_ID, name="Михаил Кузнецов"), Ctx([s])))
    return bot.relay.get(pair.id)


def sent_texts(ctx, chat_id=None):
    return [c.args[1] for c in ctx.bot.send_message.call_args_list if chat_id is None or c.args[0] == chat_id]


def test_only_admin_creates_pairs(bot):
    up = pm(TUTOR_ID, "/new_pair")
    run(bot.cmd_new_pair(up, Ctx(["A"])))
    assert "только администраторы" in up.effective_message.reply_text.call_args[0][0]
    up = pm(ADMIN_ID, "/new_pair")
    run(bot.cmd_new_pair(up, Ctx(["Анна", "|", "Миша"])))
    text = up.effective_message.reply_text.call_args[0][0]
    assert "https://t.me/school_bot?start=t_" in text and "https://t.me/school_bot?start=s_" in text


def test_relay_hides_real_accounts(bot):
    pair = connect(bot)
    ctx = Ctx()
    run(bot.on_private_message(pm(STUDENT_ID, "Здравствуйте! Я сделал упражнение.", message_id=5,
                                  name="Михаил Кузнецов"), ctx))
    call = ctx.bot.send_message.call_args
    assert call.args[0] == TUTOR_ID
    assert call.args[1] == "Миша: Здравствуйте! Я сделал упражнение."
    # Ни имени аккаунта, ни @ника, ни id ученика преподаватель не получает
    assert "Михаил" not in call.args[1] and "real_username" not in call.args[1] and str(STUDENT_ID) not in call.args[1]
    assert bot.relay.resolve_reply(str(TUTOR_ID), 1000)[0].id == pair.id


def test_relay_blocks_contacts_and_notifies_admin(bot):
    connect(bot)
    ctx = Ctx()
    up = pm(TUTOR_ID, "Пиши мне в телеграм @anna_tutor, так удобнее", message_id=7, name="Анна Смирнова")
    run(bot.on_private_message(up, ctx))
    assert "не доставлено" in up.effective_message.reply_text.call_args[0][0]
    assert sent_texts(ctx, STUDENT_ID) == []  # ученику ничего не ушло
    admin = sent_texts(ctx, -500)
    assert admin and "@anna_tutor" in admin[0] and str(TUTOR_ID) in admin[0] and "Анна Смирнова" in admin[0]


def test_relay_blocks_hidden_links_and_mentions(bot):
    connect(bot)
    from telegram import MessageEntity

    link = types.SimpleNamespace(type=MessageEntity.TEXT_LINK, url="https://t.me/anna_tutor", user=None)
    ctx = Ctx()
    up = pm(TUTOR_ID, "нажми сюда", entities=(link,))
    run(bot.on_private_message(up, ctx))
    assert sent_texts(ctx, STUDENT_ID) == []

    mention = types.SimpleNamespace(type=MessageEntity.TEXT_MENTION, url=None, user=types.SimpleNamespace(id=TUTOR_ID))
    ctx = Ctx()
    run(bot.on_private_message(pm(TUTOR_ID, "это я", entities=(mention,)), ctx))
    assert sent_texts(ctx, STUDENT_ID) == []


def test_relay_never_forwards_contact_cards(bot):
    connect(bot)
    ctx = Ctx()
    contact = types.SimpleNamespace(phone_number=None, user_id=None)
    up = pm(TUTOR_ID, contact=contact)
    run(bot.on_private_message(up, ctx))
    ctx.bot.copy_message.assert_not_called()
    assert sent_texts(ctx, STUDENT_ID) == []


def test_relay_split_phone_deletes_delivered_parts(bot):
    connect(bot)
    ctx = Ctx()
    run(bot.on_private_message(pm(STUDENT_ID, "8 916", message_id=21), ctx))
    run(bot.on_private_message(pm(STUDENT_ID, "555", message_id=22), ctx))
    run(bot.on_private_message(pm(STUDENT_ID, "12 34", message_id=23), ctx))
    deleted = [c.args for c in ctx.bot.delete_message.call_args_list]
    assert deleted == [(TUTOR_ID, 1000), (TUTOR_ID, 1001)]
    assert len(sent_texts(ctx, TUTOR_ID)) == 2  # третья часть уже не доставлена


def test_relay_media_and_reply_threading(bot):
    connect(bot)
    ctx = Ctx()
    run(bot.on_private_message(pm(TUTOR_ID, "Посмотри задание", message_id=30), ctx))  # → у ученика 1000
    up = pm(STUDENT_ID, message_id=31, reply_to=1000, caption="Готово", document=object())
    run(bot.on_private_message(up, ctx))
    call = ctx.bot.copy_message.call_args
    assert call.args[0] == TUTOR_ID and call.kwargs["caption"] == "Миша: Готово"
    assert call.kwargs["reply_parameters"].message_id == 30  # ответ привязан к исходному сообщению


def test_relay_media_can_be_disabled(bot):
    connect(bot)
    bot.settings = Settings(llm_mode="off", relay_media=False)
    ctx = Ctx()
    up = pm(STUDENT_ID, message_id=40, photo=[object()])
    run(bot.on_private_message(up, ctx))
    ctx.bot.copy_message.assert_not_called()
    assert "отключена" in up.effective_message.reply_text.call_args[0][0]


def test_relay_lesson_flow(bot):
    connect(bot)
    ctx = Ctx()
    run(bot.cmd_lesson_start(pm(STUDENT_ID, "/lesson_start"), Ctx()))  # ученик урок не начинает
    assert bot.assistant.storage.active_lesson(f"pair:{bot.relay.list()[0].id}") is None

    run(bot.cmd_lesson_start(pm(TUTOR_ID, "/lesson_start"), Ctx(["Еда"])))
    up = pm(TUTOR_ID, "Новые слова сегодня: apple — яблоко, pear — груша", message_id=50)
    run(bot.on_private_message(up, ctx))
    assert "Записал 2 слова" in up.effective_message.reply_text.call_args[0][0]
    assert sent_texts(ctx, STUDENT_ID)[-1].startswith("Анна Петровна: Новые слова сегодня")

    # Запрос ученика отвечает бот, преподавателю он не пересылается
    q = pm(STUDENT_ID, "новые слова сегодня", message_id=51)
    run(bot.on_private_message(q, ctx))
    assert "apple" in q.effective_message.reply_text.call_args[0][0]
    assert not any("новые слова сегодня" == t.split(": ", 1)[-1] for t in sent_texts(ctx, TUTOR_ID))

    end = Ctx()
    run(bot.cmd_lesson_end(pm(TUTOR_ID, "/lesson_end"), end))
    for uid in (TUTOR_ID, STUDENT_ID):
        assert any("Конспект урока" in t for t in sent_texts(end, uid))
    assert end.bot.send_document.await_count == 1  # файл конспекта — ученику
    assert end.bot.send_document.call_args.args[0] == STUDENT_ID
    tutor_text = "\n".join(sent_texts(end, TUTOR_ID))
    assert "Полный отчёт для преподавателя" in tutor_text and "Родители ученика не подключены" in tutor_text


def test_not_connected_user_gets_regular_private_mode(bot):
    up = pm(555, "привет")
    run(bot.on_private_message(up, Ctx()))
    assert "расшифровку" in up.effective_message.reply_text.call_args[0][0]


def test_student_waits_for_tutor(bot):
    pair = bot.relay.create_pair("Анна", "Миша")
    run(bot.cmd_start(pm(STUDENT_ID), Ctx([bot.relay.invite_payloads(pair)[1]])))
    up = pm(STUDENT_ID, "Здравствуйте")
    run(bot.on_private_message(up, Ctx()))
    assert "ещё не подключился" in up.effective_message.reply_text.call_args[0][0]


# -- сайт школы: личный кабинет и класс ProgressMe ------------------------------------------------


def test_cabinet_link_from_bot(bot):
    import dataclasses

    from tutor_assistant.portal import Portal

    connect(bot)
    stranger = pm(555, "/cabinet")
    run(bot.cmd_cabinet(stranger, Ctx()))
    assert "ссылку-приглашение" in stranger.effective_message.reply_text.call_args[0][0]
    no_site = pm(STUDENT_ID, "/cabinet")
    run(bot.cmd_cabinet(no_site, Ctx()))
    assert "TUTOR_SITE_URL" in no_site.effective_message.reply_text.call_args[0][0]

    bot.settings = dataclasses.replace(bot.settings, site_url="https://school.example")
    bot.assistant.settings = bot.settings
    bot.portal = Portal(bot.assistant)
    up = pm(STUDENT_ID, "/cabinet")
    run(bot.cmd_cabinet(up, Ctx()))
    text = up.effective_message.reply_text.call_args[0][0]
    token = text.split("#/cabinet?t=", 1)[1].split()[0]
    viewer = bot.portal.viewer(token)
    assert viewer.user_id == str(STUDENT_ID) and not viewer.admin
    assert up.effective_message.reply_text.call_args.kwargs["reply_markup"] is not None
    admin = pm(ADMIN_ID, "/cabinet")
    run(bot.cmd_cabinet(admin, Ctx()))
    admin_token = admin.effective_message.reply_text.call_args[0][0].split("#/cabinet?t=", 1)[1].split()[0]
    assert bot.portal.viewer(admin_token).admin


def test_classroom_link(bot):
    pair = connect(bot)
    bad = pm(ADMIN_ID, "/classroom")
    run(bot.cmd_classroom(bad, Ctx([pair.id, "https://wa.me/79991234567"])))
    assert "❌" in bad.effective_message.reply_text.call_args[0][0]
    tutor_try = pm(TUTOR_ID, "/classroom")
    run(bot.cmd_classroom(tutor_try, Ctx([pair.id, "https://edu.progressme.ru/room/me"])))
    assert bot.assistant.storage.get_classroom(pair.chat_id) is None  # преподаватель ссылку не задаёт
    ok = pm(ADMIN_ID, "/classroom")
    run(bot.cmd_classroom(ok, Ctx([pair.id, "https://edu.progressme.ru/room/42"])))
    assert bot.assistant.storage.get_classroom(pair.chat_id) == "https://edu.progressme.ru/room/42"

    show = pm(STUDENT_ID, "/classroom")
    run(bot.cmd_classroom(show, Ctx()))
    assert "room/42" in show.effective_message.reply_text.call_args[0][0]

    ctx = Ctx(["Еда"])
    start = pm(TUTOR_ID, "/lesson_start")
    run(bot.cmd_lesson_start(start, ctx))
    tutor_markup = start.effective_message.reply_text.call_args.kwargs["reply_markup"]
    assert tutor_markup.inline_keyboard[0][0].url == "https://edu.progressme.ru/room/42"
    student_call = [c for c in ctx.bot.send_message.call_args_list if c.args[0] == STUDENT_ID][-1]
    assert student_call.kwargs["reply_markup"].inline_keyboard[0][0].url.endswith("room/42")
