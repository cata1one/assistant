import pytest

from tutor_assistant.config import Settings
from tutor_assistant.contact_guard import (
    REDACTED,
    REDACTED_MESSAGE,
    ContactGuard,
    ConversationGuard,
    Kind,
    Severity,
    luhn_valid,
)

guard = ContactGuard(Settings())


@pytest.mark.parametrize("text", [
    # телефоны
    "Мой телефон +7 (900) 123-45-67",
    "звони 89001234567",
    "8-916-555-12-34",
    "+44 20 7946 0958",
    "номер 555-12-34, звони вечером",
    "8 9OO 123 45 67",
    "восемь девятьсот шестнадцать пятьсот сорок два тридцать один ноль семь, это мой номер",
    "плюс семь девятьсот шестнадцать пятьсот сорок два тридцать один ноль семь",
    # почта
    "пиши мне на почту ivan.petrov@gmail.com",
    "ivan собака гмейл точка ком",
    "ivan [at] yandex (dot) ru",
    "i.petrov at mail . ru",
    "мой ящик petrov собака mail точка ру",
    # мессенджеры и ники
    "мой тг @ivan_petrov",
    "@anna_english_tutor",
    "телеграм: ivan_petrov88",
    "ник в телеге ivan_petrov",
    "t.me/ivanpetrov",
    "https://wa.me/79001234567",
    "vk.com/id12345",
    "instagram.com/anna.teacher",
    "напиши мне в вотсап",
    "пиши мне в личку",
    "мой тeлeгрaм",  # латинские буквы вместо кириллицы
    "мой т е л е г р а м",  # разрядка
    "найди меня в инсте",
    "добавь меня в телеграме",
    "скинь свой номер в ватсап",
    # обход школы и оплата
    "давай заниматься напрямую, без школы, будет дешевле",
    "можем заниматься со мной лично без платформы",
    "плати мне на карту, так дешевле",
    "переведи деньги на сбер по номеру телефона",
    "карта 4111 1111 1111 1111",
    "школа забирает половину денег, давай без неё",
    "только не говори школе",
    "у меня частные уроки дешевле, чем у школы",
])
def test_blocks_contacts_and_circumvention(text):
    r = guard.check(text)
    assert r.action == "block", (text, r.summary, [f.reason for f in r.findings])
    assert r.severity == Severity.HIGH
    assert r.is_violation and r.warning


@pytest.mark.parametrize("text", [
    "Напиши мне три предложения с этими словами",
    "Откройте страницы 12 13 14 15 16",
    "Let's count: one two three four five six seven eight nine ten",
    "Посмотри на карту Лондона",
    "Не переводи напрямую, это идиома",
    "In 1999 there were 120 students in 2001",
    "Хорошо, до завтра!",
    "Сделай упражнение 5 на странице 23",
    "Remember: we use the Present Perfect for experience",
    "Прочитай текст про Telegram в учебнике",  # просто упоминание, без просьбы
    "The meeting is at 10:30, room 204",
    "Запиши новые слова в тетрадь",
    "I was born on 12.05.2010",
    "Сколько будет 1234 + 5678?",
    "Позвонить — to call, написать — to write",
    "напиши мне ответ на вопрос номер три",
    "",
])
def test_allows_normal_lesson_messages(text):
    r = guard.check(text)
    assert r.action == "allow", (text, r.summary, [f.reason for f in r.findings])
    assert r.redacted_text == text


@pytest.mark.parametrize("text", [
    "What's your phone number? My phone number is ...",
    "Can you give me your email address? — This is a role play.",
    "look at google.com for the picture",
])
def test_english_lesson_phrases_are_not_blocked(text):
    r = guard.check(text)
    assert r.action == "allow"
    assert r.severity <= Severity.LOW


def test_medium_warns_without_hiding():
    r = guard.check("как с тобой можно связаться?")
    assert r.action == "warn"
    assert r.severity == Severity.MEDIUM
    assert r.redacted_text == "как с тобой можно связаться?"
    assert r.warning


def test_masks_only_contact_spans():
    r = guard.check("Мой телефон +7 (900) 123-45-67, звони после урока")
    assert r.redacted_text == f"Мой телефон {REDACTED}, звони после урока"
    phones = [f for f in r.findings if f.kind == Kind.PHONE]
    assert phones and phones[0].value == "+7 (900) 123-45-67"


def test_obfuscated_contact_hides_whole_message():
    r = guard.check("ivan собака gmail точка com")
    assert r.redacted_text == REDACTED_MESSAGE
    assert any(f.kind == Kind.EMAIL and f.value == "ivan@gmail.com" for f in r.findings)


def test_whitelist_of_school_contacts():
    g = ContactGuard(Settings(allowed_emails=("support@school.ru",), allowed_handles=("school_bot",),
                              allowed_domains=("school.ru",), allowed_phones=("88005553535",)))
    for text in ("Пишите в поддержку support@school.ru", "наш бот @school_bot", "материалы на https://school.ru/lesson/5",
                 "горячая линия 8 800 555-35-35"):
        r = g.check(text)
        assert r.action == "allow", (text, r.summary)


def test_block_disabled_only_warns():
    g = ContactGuard(Settings(block_contacts=False))
    r = g.check("мой номер 89001234567")
    assert r.action == "warn" and r.severity == Severity.HIGH
    assert r.redacted_text == "мой номер 89001234567"


def test_luhn():
    assert luhn_valid("4111111111111111")
    assert not luhn_valid("4111111111111112")


def test_phone_split_across_messages():
    cg = ConversationGuard(guard, window_seconds=120)
    assert cg.check("u1", "8 916", ts=0, ref=10).action == "allow"
    assert cg.check("u1", "555", ts=5, ref=11).action == "allow"
    r = cg.check("u1", "12 34", ts=9, ref=12)
    assert r.blocked
    assert r.related_refs == [10, 11]
    assert "по частям" in " ".join(f.reason for f in r.findings)


def test_split_email_across_messages():
    cg = ConversationGuard(guard)
    cg.check("u", "ivan.p", ts=0, ref=1)
    cg.check("u", "собака", ts=1, ref=2)
    r = cg.check("u", "gmail.com", ts=2, ref=3)
    assert r.blocked and r.related_refs == [1, 2]


def test_split_detection_respects_window_and_speaker():
    cg = ConversationGuard(guard, window_seconds=60)
    cg.check("u1", "8 916", ts=0)
    cg.check("u2", "555", ts=1)  # другой участник
    assert not cg.check("u1", "555 12 34", ts=500).blocked  # окно истекло


def test_short_numeric_answers_are_not_a_phone():
    cg = ConversationGuard(guard)
    for i, t in enumerate(["1990", "1812", "2001", "15", "16"]):
        assert cg.check("student", t, ts=i).action == "allow"


def test_to_dict_is_serializable():
    import json

    r = guard.check("мой номер 89001234567")
    data = r.to_dict()
    json.dumps(data, ensure_ascii=False)
    assert data["action"] == "block" and data["findings"]
