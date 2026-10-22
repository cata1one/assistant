"""Чат пары вне урока, отзывы, преподаватели, биржа учеников, кабинет родителя."""

import dataclasses

import pytest

from tutor_assistant.community import DEMO_REVIEWS, Community
from tutor_assistant.config import Settings
from tutor_assistant.portal import Portal, PortalError
from tutor_assistant.relay import RelayService
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage

TUTOR, STUDENT, PARENT, ADMIN, TEACHER, STRANGER = ("70000111", "70000222", "70000333", "70000999", "70000555",
                                                    "70000444")


@pytest.fixture
def env():
    settings = Settings(llm_mode="off", stt_mode="off", db_path=":memory:", admin_user_ids=(ADMIN,),
                        admin_chat_id="-100", site_url="https://school.example", bot_username="school_bot")
    assistant = TutorAssistant(settings, Storage(":memory:"))
    portal = Portal(assistant)
    sent: list[tuple[str, str]] = []
    portal.telegram_send = lambda chat, text: sent.append((chat, text))
    relay = RelayService(assistant.storage)
    pair = relay.create_pair("Анна", "Миша")
    t, s = relay.invite_payloads(pair)
    relay.bind(t, TUTOR)
    pair, _ = relay.bind(s, STUDENT)
    assistant.subscribe_parent(assistant.create_parent_invite(pair.chat_id, "Миша"), PARENT)
    v = {uid: portal.viewer(portal.issue_token(uid, admin=uid == ADMIN))
         for uid in (TUTOR, STUDENT, PARENT, ADMIN, TEACHER, STRANGER)}
    return {"a": assistant, "portal": portal, "c": Community(portal), "pair": pair, "sent": sent, "v": v}


# -- чат пары ------------------------------------------------------------------------------

def test_chat_between_lessons(env):
    c, v, chat, sent = env["c"], env["v"], env["pair"].chat_id, env["sent"]
    out = c.send(v[STUDENT], chat, {"text": "Здравствуйте! Не понял упражнение 3"})
    assert out["moderation"]["action"] == "allow" and out["delivered_to_telegram"]
    assert sent[-1][0] == TUTOR and sent[-1][1].startswith("Миша: Здравствуйте")
    assert c.chats(v[TUTOR])["chats"][0]["unread"] == 1
    msgs = c.messages(v[TUTOR], chat)["messages"]
    assert msgs[0]["author"] == "Миша" and msgs[0]["role"] == "student"
    assert c.chats(v[TUTOR])["chats"][0]["unread"] == 0  # прочитано
    assert c.messages(v[STUDENT], chat, since=msgs[-1]["id"])["messages"] == []


def test_chat_blocks_contacts_and_split_numbers(env):
    c, v, chat, sent = env["c"], env["v"], env["pair"].chat_id, env["sent"]
    bad = c.send(v[TUTOR], chat, {"text": "напиши мне в телеграм @anna_english"})
    assert bad["moderation"]["action"] == "block" and not bad["delivered_to_telegram"]
    assert "@anna_english" not in c.messages(v[STUDENT], chat)["messages"][-1]["text"]
    assert any(ch == "-100" and "переписка на сайте" in t for ch, t in sent)
    c.send(v[TUTOR], chat, {"text": "8 916"})
    c.send(v[TUTOR], chat, {"text": "555"})
    assert c.send(v[TUTOR], chat, {"text": "12 34"})["moderation"]["action"] == "block"


def test_chat_access(env):
    c, v, chat = env["c"], env["v"], env["pair"].chat_id
    for uid in (PARENT, STRANGER):
        with pytest.raises(PortalError):
            c.messages(v[uid], chat)
    with pytest.raises(PortalError):
        c.send(v[STUDENT], chat, {"text": ""})
    parent_chats = c.chats(v[PARENT])["chats"]
    assert [x["kind"] for x in parent_chats] == ["parent"]  # только своя ветка с преподавателем


def test_parent_writes_to_tutor(env):
    c, v, pair, sent = env["c"], env["v"], env["pair"], env["sent"]
    thread = f"pp:{pair.id}:{PARENT}"
    out = c.send(v[PARENT], thread, {"text": "Добрый день! Как успехи у Миши?"})
    assert out["moderation"]["action"] == "allow" and sent[-1][0] == TUTOR
    tutor_threads = {x["chat_id"]: x for x in c.chats(v[TUTOR])["chats"]}
    assert tutor_threads[thread]["unread"] == 1 and tutor_threads[thread]["title"] == "Родитель"
    c.send(v[TUTOR], thread, {"text": "Отлично, выучил 6 новых слов"})
    assert sent[-1][0] == PARENT
    with pytest.raises(PortalError):
        c.messages(v[STUDENT], thread)  # ученик не читает переписку родителя
    # пара из бота школы — строгий режим: контакты в переписке с родителем тоже блокируются
    assert c.send(v[PARENT], thread, {"text": "мой номер 8 916 555 12 34"})["moderation"]["action"] == "block"


def test_chat_during_lesson_feeds_lesson(env):
    a, c, v, chat = env["a"], env["c"], env["v"], env["pair"].chat_id
    lesson = a.start_lesson(chat_id=chat, tutor_id=TUTOR, student_id=STUDENT)
    c.send(v[TUTOR], chat, {"text": "Новые слова сегодня: kitchen — кухня"})
    assert [w.word for w in a.storage.lesson_words_live(lesson["id"])] == ["kitchen"]


# -- отзывы ----------------------------------------------------------------------------------

def test_reviews_need_approval(env):
    c, v = env["c"], env["v"]
    with pytest.raises(PortalError):
        c.submit_review(v[STRANGER], {"rating": 5, "text": "x" * 30, "author_name": "Кто-то"})
    r = c.submit_review(v[PARENT], {"rating": 5, "text": "Сын занимается с удовольствием, отчёты очень помогают.",
                                    "author_name": "Ольга, мама Миши", "audience": "kid"})
    assert r["status"] == "pending" and c.public_reviews()["reviews"] == []
    c.set_review_status(v[ADMIN], r["id"], "approved")
    pub = c.public_reviews()
    assert pub["count"] == 1 and pub["average"] == 5.0 and pub["reviews"][0]["author_role"] == "parent"
    assert c.submit_review(v[TUTOR], {"rating": 4, "text": "Удобно работать: конспекты готовятся сами.",
                                      "author_name": "Анна"})["status"] == "pending"
    assert c.storage.reviews_by_user(TUTOR)[0]["author_role"] == "teacher"
    with pytest.raises(PortalError):
        c.set_review_status(v[TUTOR], r["id"], "approved")


@pytest.mark.parametrize("body", [
    {"rating": 6, "text": "Отличная школа, всем советую!", "author_name": "Оля"},
    {"rating": 5, "text": "Коротко", "author_name": "Оля"},
    {"rating": 5, "text": "Пишите мне в телеграм @olga_best, расскажу", "author_name": "Оля"},
])
def test_review_validation(env, body):
    with pytest.raises(PortalError):
        env["c"].submit_review(env["v"][STUDENT], body)


def test_demo_reviews_only_when_enabled_and_marked(env):
    c = env["c"]
    assert c.public_reviews()["reviews"] == []
    c.settings = dataclasses.replace(c.settings, demo_reviews=True)
    pub = c.public_reviews()
    assert len(pub["reviews"]) == len(DEMO_REVIEWS) and all(r["demo"] for r in pub["reviews"])
    assert pub["count"] == 0 and pub["average"] is None  # примеры не входят в рейтинг


# -- биржа -------------------------------------------------------------------------------------

def request_body(**kw):
    return {"name": "Ольга Иванова", "contact": "+7 999 000-00-00", "age": 34, "audience": "adult",
            "language": "en", "level": "intermediate", "goals": "Собеседование в международную IT-компанию",
            "teacher_wishes": "опыт в IT", "budget": "1500-2500", "consent": True, **kw}


def test_market_full_flow(env):
    c, v, sent, storage = env["c"], env["v"], env["sent"], env["a"].storage
    created = c.create_request(request_body(), "1.1.1.1")
    rid, key = created["id"], created["key"]
    public = c.public_requests()
    item = public["requests"][0]
    assert item["name"] == "Ольга" and item["level_ru"] == "средний"  # только имя, без фамилии
    assert "contact" not in item and "999" not in str(item)  # контакт видит только школа
    assert any(ch == "-100" and "+7 999" in t for ch, t in sent)

    with pytest.raises(PortalError):  # не преподаватель
        c.propose(v[STRANGER], rid, {"message": "Помогу!", "price": 1500})
    with pytest.raises(PortalError) as e:  # контакты в отклике
        c.propose(v[TUTOR], rid, {"message": "Пишите мне в телеграм @anna_it", "price": 1500})
    assert e.value.status == 422
    c.propose(v[TUTOR], rid, {"message": "Пять лет готовлю к IT-собеседованиям", "price": 1800})

    # преподаватель без пары — только после одобрения анкеты
    c.save_teacher_profile(v[TEACHER], {"name": "Дмитрий", "bio": "IELTS 8.5", "languages": "английский",
                                        "rate": 2000})
    with pytest.raises(PortalError):
        c.propose(v[TEACHER], rid, {"message": "Готов помочь", "price": 2000})
    c.set_teacher_status(v[ADMIN], TEACHER, "approved")
    assert any(ch == TEACHER and "одобрила" in t for ch, t in sent)
    c.propose(v[TEACHER], rid, {"message": "Готов помочь", "price": 2000})

    with pytest.raises(PortalError):
        c.owner_view(rid, "wrong-key")
    own = c.owner_view(rid, key)
    assert [p["teacher"] for p in own["proposals"]] == ["Анна", "Дмитрий"]
    chosen = own["proposals"][1]["id"]
    res = c.choose(rid, key, chosen)
    assert res["links"]["student"].startswith("https://t.me/school_bot?start=s_") and res["links"]["parent"] is None
    r = storage.market_request(rid)
    pair = RelayService(storage).get(r["pair_id"])
    assert r["status"] == "matched" and pair.tutor_user_id == TEACHER and pair.student_alias == "Ольга"
    assert any(ch == TEACHER and "выбрал вас" in t for ch, t in sent)
    assert c.public_requests()["requests"] == []  # закрытые заявки не видны
    with pytest.raises(PortalError):
        c.propose(v[TUTOR], rid, {"message": "ещё", "price": 1000})
    statuses = {p["teacher_id"]: p["status"] for p in storage.proposals(rid)}
    assert statuses == {TUTOR: "declined", TEACHER: "accepted"}
    assert c.owner_view(rid, key)["links"]["student"]  # ссылку можно открыть ещё раз


def test_market_kid_gets_parent_link(env):
    c, v = env["c"], env["v"]
    created = c.create_request(request_body(audience="kid", age=11, name="Петя"), "2.2.2.2")
    c.propose(v[TUTOR], created["id"], {"message": "Занимаюсь с детьми 7 лет", "price": 1200})
    pid = c.owner_view(created["id"], created["key"])["proposals"][0]["id"]
    links = c.choose(created["id"], created["key"], pid)["links"]
    assert links["parent"].startswith("https://t.me/school_bot?start=p_")


@pytest.mark.parametrize("override", [
    {"name": ""}, {"level": "guru"}, {"budget": "1 млн"}, {"age": 2}, {"consent": False},
    {"goals": "звоните мне +7 916 555 12 34"}, {"comment": "мой инстаграм @olga"},
])
def test_market_validation(env, override):
    with pytest.raises(PortalError):
        env["c"].create_request(request_body(**override), "3.3.3.3")


def test_market_spam_limits(env):
    c = env["c"]
    assert c.create_request(request_body(website="spam"), "4.4.4.4") == {"id": None, "key": None}
    for _ in range(3):
        c.create_request(request_body(), "5.5.5.5")
    with pytest.raises(PortalError) as e:
        c.create_request(request_body(), "5.5.5.5")
    assert e.value.status == 429


def test_close_request(env):
    c = env["c"]
    created = c.create_request(request_body(), "6.6.6.6")
    assert c.close_request(created["id"], created["key"])["status"] == "closed"
    assert c.public_requests()["requests"] == []


# -- кабинет родителя ------------------------------------------------------------------------------

def test_parent_overview(env):
    a, c, v, chat = env["a"], env["c"], env["v"], env["pair"].chat_id
    lesson = a.start_lesson(chat_id=chat, tutor_id=TUTOR, student_id=STUDENT, student_name="Миша")
    a.process_message(lesson["id"], TUTOR, "Анна", "Новые слова сегодня: kitchen — кухня, cozy — уютный", role="tutor")
    a.process_message(lesson["id"], TUTOR, "Анна", "Домашнее задание: выучить новые слова", role="tutor")
    a.finish_lesson(lesson["id"], use_llm=False)
    child = c.parent_overview(v[PARENT])["children"][0]
    assert child["name"] == "Миша" and child["lessons"] == 1 and child["words"] == 2
    assert child["last"]["homework"] and child["last"]["lesson_id"] == lesson["id"]
    assert c.parent_overview(v[STUDENT])["children"] == []


def test_http_chat_path_with_encoded_colon(env):
    import json
    import threading
    import urllib.request

    from tutor_assistant.api import make_server

    srv = make_server(env["a"], "127.0.0.1", 0)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        token = env["portal"].issue_token(STUDENT)
        url = f"http://127.0.0.1:{srv.server_address[1]}/site/v1/chats/{env['pair'].chat_id.replace(':', '%3A')}/messages"
        req = urllib.request.Request(url, headers={"X-Access-Token": token})
        assert json.loads(urllib.request.urlopen(req, timeout=10).read())["role"] == "student"
    finally:
        srv.shutdown()
        srv.server_close()
