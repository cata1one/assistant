"""Аккаунты BetterTeach / BetterStudy: репетитор, ученик, родитель, школа; материалы, ДЗ, карточки."""

from datetime import datetime, timedelta, timezone

import pytest

from tutor_assistant.accounts import Accounts, hash_password, verify_password
from tutor_assistant.community import Community
from tutor_assistant.config import Settings
from tutor_assistant.learning import Learning, sm2, video_embed
from tutor_assistant.portal import Portal, PortalError
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 100


class Headers(dict):
    def get(self, k, d=None):
        return super().get(k, d)


@pytest.fixture
def env(tmp_path):
    settings = Settings(llm_mode="off", stt_mode="off", db_path=":memory:", site_url="https://better.example",
                        bot_username="better_bot")
    a = TutorAssistant(settings, Storage(":memory:"))
    portal = Portal(a)
    sent = []
    portal.telegram_send = lambda chat, text: sent.append((chat, text))
    acc = Accounts(portal)
    return {"a": a, "portal": portal, "acc": acc, "c": Community(portal), "l": Learning(portal, tmp_path),
            "sent": sent}


def reg(env, role, email, name="Анна Петровна", **kw):
    res = env["acc"].register({"role": role, "name": name, "email": email, "password": "secret123", "consent": True,
                               **kw}, "1.1.1.1")
    return env["portal"].viewer(res["token"]), res


def test_password_hashing():
    h = hash_password("пароль-123")
    assert verify_password("пароль-123", h) and not verify_password("другой", h) and not verify_password("x", "bad")


def test_register_and_login(env):
    v, res = reg(env, "tutor", "anna@mail.ru")
    assert res["account"]["brand"] == "teach" and res["account"]["role"] == "tutor"
    assert env["acc"].login({"email": "ANNA@mail.ru", "password": "secret123"}, "2.2.2.2")["account"]["id"] == v.user_id
    with pytest.raises(PortalError) as e:
        env["acc"].login({"email": "anna@mail.ru", "password": "wrong"}, "2.2.2.2")
    assert e.value.status == 401
    with pytest.raises(PortalError) as e:
        reg(env, "student", "anna@mail.ru")
    assert e.value.status == 409
    for bad in ({"role": "god"}, {"role": "tutor", "name": "A", "email": "x", "password": "secret123", "consent": True},
                {"role": "tutor", "name": "A", "email": "a@b.ru", "password": "123", "consent": True},
                {"role": "tutor", "name": "A", "email": "a@b.ru", "password": "secret123"}):
        with pytest.raises(PortalError):
            env["acc"].register(bad, "3.3.3.3")


def test_login_throttled(env):
    reg(env, "tutor", "t@mail.ru")
    for _ in range(10):
        with pytest.raises(PortalError):
            env["acc"].login({"email": "t@mail.ru", "password": "nope"}, "9.9.9.9")
    with pytest.raises(PortalError) as e:
        env["acc"].login({"email": "t@mail.ru", "password": "secret123"}, "9.9.9.9")
    assert e.value.status == 429


def private_pair(env):
    tutor, _ = reg(env, "tutor", "tutor@mail.ru", "Анна Петровна")
    added = env["acc"].add_student(tutor, {"name": "Миша Иванов"})
    student, res = reg(env, "student", "misha@mail.ru", "Миша", invite=added["invite"]["code"])
    parent, _ = reg(env, "parent", "mama@mail.ru", "Ольга", invite=added["parent_invite"]["code"])
    return tutor, student, parent, added


def test_tutor_invites_student_and_parent(env):
    tutor, student, parent, added = private_pair(env)
    info = env["acc"].invite_info(added["invite"]["code"])
    assert info == {"kind": "student", "role": "student", "tutor": "Анна", "student": "Миша", "used": True}
    roles = {a.role for a in env["portal"].accesses(student)}
    assert roles == {"student"} and {a.role for a in env["portal"].accesses(parent)} == {"parent"}
    lst = env["acc"].students(tutor)
    assert lst["students"][0]["joined"] and lst["students"][0]["parents"] == 1 and lst["limit"] is None
    other, _ = reg(env, "student", "other@mail.ru")
    with pytest.raises(PortalError):
        env["acc"].join(other, added["invite"]["code"])  # приглашение одноразовое
    with pytest.raises(PortalError):
        env["acc"].join(parent, added["invite"]["code"])  # не та роль
    with pytest.raises(PortalError):
        env["acc"].add_student(student, {"name": "Петя"})  # ученик не добавляет учеников


def test_trial_payment_and_referral(env):
    from tutor_assistant.portal import Viewer

    acc, storage = env["acc"], env["a"].storage
    tutor, res = reg(env, "tutor", "t@mail.ru")
    b = res["account"]["billing"]
    assert b["state"] == "trial" and b["plan"] == "teacher" and b["days_left"] >= 2
    for i in range(5):  # в пробный период — все функции, без лимита учеников
        acc.add_student(tutor, {"name": f"Ученик{i}"})
    storage.update_account(tutor.user_id, trial_until="2020-01-01T00:00:00+00:00")
    with pytest.raises(PortalError) as e:
        acc.add_student(tutor, {"name": "Шестой"})
    assert e.value.status == 402
    # коллега регистрируется по реферальной ссылке
    code = acc.public(tutor.user_id)["referral"]["code"]
    friend, _ = reg(env, "tutor", "friend@mail.ru", ref=code)
    assert acc.public(tutor.user_id)["referral"]["invited"] == 1
    admin = Viewer("999", True)
    with pytest.raises(PortalError):
        acc.admin_extend(tutor, {"email": "friend@mail.ru", "months": 1})
    acc.admin_extend(admin, {"email": "friend@mail.ru", "months": 1})
    ref = acc.public(tutor.user_id)["referral"]
    assert ref["paid"] == 1 and ref["discounts"] == 1
    out = acc.admin_extend(admin, {"email": "t@mail.ru", "months": 12, "use_discount": True})
    assert out["price"] == 1440 and out["discount_used"]  # 2 880 ₽ за год со скидкой 50%
    assert acc.public(tutor.user_id)["billing"]["state"] == "active"
    assert acc.public(tutor.user_id)["referral"]["discounts"] == 0
    acc.add_student(tutor, {"name": "Шестой"})
    # ученик и родитель не платят
    student, _ = reg(env, "student", "s@mail.ru")
    assert acc.public(student.user_id)["billing"]["state"] == "free"


def test_school_pays_for_its_tutors(env):
    acc, storage = env["acc"], env["a"].storage
    school, _ = reg(env, "school", "o@school.ru", "Ирина", school_name="Lingua")
    tutor, _ = reg(env, "tutor", "k@school.ru", "Катя", invite=acc.school(school)["tutor_invite"]["code"])
    assert acc.public(tutor.user_id)["billing"]["by_school"]
    storage.update_account(school.user_id, trial_until="2020-01-01T00:00:00+00:00")
    with pytest.raises(PortalError) as e:
        acc.add_student(tutor, {"name": "Петя"})
    assert "школа" in e.value.message


def test_feedback_and_prefs(env):
    tutor, _ = reg(env, "tutor", "t@mail.ru")
    assert env["c"].feedback(tutor, {"kind": "idea", "text": "Добавьте ещё стикеров!"})["id"]
    with pytest.raises(PortalError):
        env["c"].feedback(tutor, {"text": "a"})
    student, _ = reg(env, "student", "s@mail.ru", "Миша")
    me = env["acc"].update_prefs(student, {"theme": "space", "avatar": "sx-rocket", "stickers": ["em-happy"], "motto": "Учу испанский"})
    assert me["account"]["prefs"] == {"theme": "space", "avatar": "sx-rocket", "stickers": ["em-happy"], "motto": "Учу испанский"}
    assert env["acc"].update_prefs(student, {"theme": "hack"})["account"]["prefs"]["theme"] == "default"


def test_private_tutor_is_not_filtered(env):
    tutor, student, parent, added = private_pair(env)
    chat = f"pair:{added['pair_id']}"
    assert env["portal"].is_strict(chat) is False
    out = env["c"].send(student, chat, {"text": "мой телеграм @misha_real"})
    assert out["moderation"]["action"] == "allow" and "@misha_real" in out["stored"]
    assert env["a"].storage.incidents() == []


def test_school_controls_its_tutors(env):
    school, res = reg(env, "school", "owner@school.ru", "Ирина", school_name="Lingua")
    info = env["acc"].school(school)
    tutor, _ = reg(env, "tutor", "t@school.ru", "Анна", invite=info["tutor_invite"]["code"])
    added = env["acc"].add_student(tutor, {"name": "Миша"})
    student, _ = reg(env, "student", "s@mail.ru", "Миша", invite=added["invite"]["code"])
    chat = f"pair:{added['pair_id']}"
    assert env["portal"].is_strict(chat) is True
    out = env["c"].send(tutor, chat, {"text": "пиши мне в телеграм @anna_english"})
    assert out["moderation"]["action"] == "block"
    data = env["acc"].school(school)
    assert data["tutors"][0]["students"][0]["name"] == "Миша" and data["signals"][0]["summary"]
    assert env["c"].messages(school, chat)["can_write"] is False  # школа читает, но не пишет
    with pytest.raises(PortalError):
        env["c"].send(school, chat, {"text": "привет"})
    env["acc"].update_school(school, {"filter_contacts": False})
    assert env["portal"].is_strict(chat) is False
    with pytest.raises(PortalError):
        env["acc"].school(tutor)


def test_parent_writes_to_school(env):
    school, _ = reg(env, "school", "owner@school.ru", "Ирина", school_name="Lingua")
    tutor, _ = reg(env, "tutor", "t@school.ru", "Анна", invite=env["acc"].school(school)["tutor_invite"]["code"])
    added = env["acc"].add_student(tutor, {"name": "Миша"})
    parent, _ = reg(env, "parent", "mama@mail.ru", "Ольга Сергеевна", invite=added["parent_invite"]["code"])
    thread = f"ps:{added['pair_id']}:{parent.user_id}"
    mine = {x["chat_id"]: x for x in env["c"].chats(parent)["chats"]}
    assert mine[thread]["title"] == "Школа «Lingua»" and mine[thread]["kind"] == "school"
    env["c"].send(parent, thread, {"text": "Хотим перейти на два урока в неделю, мой номер 8 916 555 12 34"})
    school_threads = {x["chat_id"]: x for x in env["c"].chats(school)["chats"]}
    assert school_threads[thread]["unread"] == 1 and school_threads[thread]["can_write"]
    assert "555" in env["c"].messages(school, thread)["messages"][0]["text"]  # школе контакты передавать можно
    env["c"].send(school, thread, {"text": "Конечно, подберём время"})
    with pytest.raises(PortalError):
        env["c"].messages(tutor, thread)  # преподаватель не читает переписку родителя со школой
    private_tutor, _ = reg(env, "tutor", "p@mail.ru")
    other = env["acc"].add_student(private_tutor, {"name": "Петя"})
    p2, _ = reg(env, "parent", "p2@mail.ru", invite=other["parent_invite"]["code"])
    assert all(x["kind"] != "school" for x in env["c"].chats(p2)["chats"])  # у частного репетитора школы нет


def test_telegram_link(env):
    tutor, _ = reg(env, "tutor", "t@mail.ru")
    link = env["acc"].telegram_link(tutor)
    assert link["link"].startswith("https://t.me/better_bot?start=a_")
    assert env["acc"].link_telegram(link["code"], "555")["tg_user_id"] == "555"
    assert env["acc"].link_telegram(link["code"], "556") is None  # одноразовая
    assert env["portal"].telegram(tutor.user_id, "привет") and env["sent"][-1] == ("555", "привет")
    student, _ = reg(env, "student", "s@mail.ru")
    assert env["portal"].telegram(student.user_id, "x") is False  # без Telegram — только сайт


# -- материалы ---------------------------------------------------------------------------------

@pytest.mark.parametrize("url, embed", [
    ("https://vk.com/video-22822305_456242281", "https://vk.com/video_ext.php?oid=-22822305&id=456242281&hd=2"),
    ("https://vkvideo.ru/video-1_2", "https://vk.com/video_ext.php?oid=-1&id=2&hd=2"),
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"),
    ("https://youtu.be/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"),
    ("https://rutube.ru/video/0123456789abcdef0123456789abcdef/", "https://rutube.ru/play/embed/0123456789abcdef0123456789abcdef"),
    ("https://example.com/video", None),
])
def test_video_embed(url, embed):
    assert video_embed(url) == embed


def test_materials(env):
    tutor, student, *_ = private_pair(env)
    lrn = env["l"]
    up = lrn.upload(tutor, PNG, Headers({"Content-Type": "image/png", "X-File-Name": "%D0%BA%D0%BE%D1%82.png"}))
    assert up["title"] == "кот.png" and up["url"] == f"/site/v1/files/{up['id']}"
    data, mime, disp = lrn.file(up["id"])
    assert data == PNG and mime == "image/png" and disp.startswith("inline")
    vid = lrn.add_link(tutor, {"url": "https://vk.com/video-1_2", "title": "Песня"})
    assert vid["kind"] == "video" and vid["embed"]
    assert {m["id"] for m in lrn.materials(tutor)["materials"]} == {up["id"], vid["id"]}
    for bad, hdr in ((b"<svg/>", {"Content-Type": "image/svg+xml"}), (b"notpng", {"Content-Type": "image/png"}),
                     (b"", {"Content-Type": "image/png"})):
        with pytest.raises(PortalError):
            lrn.upload(tutor, bad, Headers(hdr))
    with pytest.raises(PortalError):
        lrn.upload(student, PNG, Headers({"Content-Type": "image/png"}))  # ученик материалы не добавляет
    lrn.delete_material(tutor, up["id"])
    with pytest.raises(PortalError):
        lrn.file(up["id"])


def test_school_materials_are_shared(env):
    school, _ = reg(env, "school", "o@s.ru", "Ирина", school_name="Lingua")
    tutor, _ = reg(env, "tutor", "t@s.ru", invite=env["acc"].school(school)["tutor_invite"]["code"])
    m = env["l"].add_link(school, {"url": "https://example.com/book.pdf", "title": "Учебник"})
    assert m["shared"] and [x["id"] for x in env["l"].materials(tutor)["materials"]] == [m["id"]]


# -- домашние задания ------------------------------------------------------------------------------

def test_homework_flow(env):
    tutor, student, parent, added = private_pair(env)
    lrn = env["l"]
    chat = f"pair:{added['pair_id']}"
    with pytest.raises(PortalError):
        lrn.assign(student, {"chat_id": chat, "text": "сам себе"})
    hid = lrn.assign(tutor, {"chat_id": chat, "text": "Упражнение 4, выучить слова", "due": "2026-11-01"})["id"]
    assert lrn.homework(student)["homework"][0]["status"] == "open"
    assert lrn.homework(parent)["homework"][0]["text"].startswith("Упражнение")
    lrn.update_homework(student, hid, {"status": "done", "answer": "Сделал!"})
    hw = lrn.homework(tutor)["homework"][0]
    assert hw["status"] == "done" and hw["answer"] == "Сделал!"
    lrn.update_homework(tutor, hid, {"status": "checked"})
    with pytest.raises(PortalError):
        lrn.update_homework(parent, hid, {"status": "done"})


# -- карточки --------------------------------------------------------------------------------------

def test_sm2_intervals():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    c = sm2(None, "good", now)
    assert c["interval_days"] == 1 and c["reps"] == 1
    c = sm2(c, "good", now)
    assert c["interval_days"] == 3
    c = sm2(c, "good", now)
    assert c["interval_days"] == pytest.approx(3 * c["ease"], rel=0.05)
    lapse = sm2(c, "again", now)
    assert lapse["reps"] == 0 and lapse["interval_days"] < 0.01 and lapse["lapses"] == 1
    assert sm2(None, "easy", now)["interval_days"] > sm2(None, "good", now)["interval_days"]


def test_cards_from_lesson_words(env):
    tutor, student, parent, added = private_pair(env)
    a, lrn = env["a"], env["l"]
    chat = f"pair:{added['pair_id']}"
    lesson = a.start_lesson(chat_id=chat, tutor_id=tutor.user_id, student_id=student.user_id)
    a.process_message(lesson["id"], tutor.user_id, "Анна", "Новые слова сегодня: kitchen — кухня, cozy — уютный",
                      role="tutor")
    a.finish_lesson(lesson["id"], use_llm=False)
    cards = lrn.cards(student)
    assert cards["stats"]["new"] == 2 and {c["word"] for c in cards["queue"]} == {"kitchen", "cozy"}
    lrn.review(student, {"key": "kitchen", "grade": "good"})
    later = datetime.now(timezone.utc) + timedelta(hours=1)
    assert [c["word"] for c in lrn.cards(student, now=later)["queue"]] == ["cozy"]  # kitchen — через день
    tomorrow = datetime.now(timezone.utc) + timedelta(days=1, minutes=1)
    assert {c["word"] for c in lrn.cards(student, now=tomorrow)["queue"]} == {"kitchen", "cozy"}
    with pytest.raises(PortalError):
        lrn.review(student, {"key": "nope", "grade": "good"})
    with pytest.raises(PortalError):
        lrn.cards(tutor)  # карточки — для учеников


def test_student_language_drives_report(env):
    acc, a = env["acc"], env["a"]
    tutor, _ = reg(env, "tutor", "t@mail.ru")
    added = acc.add_student(tutor, {"name": "Хуан", "language": "es"})
    assert acc.students(tutor)["students"][0]["language"] == "es"
    with pytest.raises(PortalError):
        acc.set_language(tutor, added["pair_id"], {"language": "klingon"})
    chat = f"pair:{added['pair_id']}"
    lesson = a.start_lesson(chat_id=chat, tutor_id=tutor.user_id)
    a.process_message(lesson["id"], tutor.user_id, "Анна", "Новые слова: la casa — дом, el perro — собака")
    report = a.finish_lesson(lesson["id"], use_llm=False)
    assert report.target_language == "es" and {"la casa", "el perro"} <= {w.word for w in report.vocabulary}
    acc.set_language(tutor, added["pair_id"], {"language": "fr"})
    assert acc.students(tutor)["students"][0]["language"] == "fr"


def test_tutor_comments_homework(env):
    tutor, student, parent, added = private_pair(env)
    lrn = env["l"]
    hw = lrn.assign(tutor, {"chat_id": f"pair:{added['pair_id']}", "text": "Упр. 3"})["id"]
    lrn.update_homework(tutor, hw, {"comment": "Отлично, но повтори Past Simple"})
    assert lrn.homework(student)["homework"][0]["comment"] == "Отлично, но повтори Past Simple"
    assert lrn.homework(parent)["homework"][0]["comment"]
