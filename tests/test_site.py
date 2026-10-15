"""Сайт школы: каталог, заявки, личный кабинет, тест, словарь, доска, класс ProgressMe."""

import json
import threading
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

import pytest

from tutor_assistant import catalog
from tutor_assistant.api import make_server
from tutor_assistant.config import Settings
from tutor_assistant.portal import Portal, PortalError, hash_token, normalize_answer, valid_classroom_url
from tutor_assistant.relay import RelayService
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage
from tutor_assistant.website import Website

TUTOR_ID, STUDENT_ID, PARENT_ID, ADMIN_ID, STRANGER_ID = "70000111", "70000222", "70000333", "70000999", "70000444"

LESSON = [
    ("tutor", "Тема урока: Present Perfect."),
    ("tutor", "Новые слова сегодня:\n1. kitchen — кухня\n2. wardrobe — шкаф для одежды\n3. cozy — уютный\n"
              "4. landlord — арендодатель"),
    ("student", "A cozy kitchen is my favourite place."),
    ("tutor", "Отлично! Домашнее задание: выучить новые слова."),
]


@pytest.fixture
def env():
    settings = Settings(llm_mode="off", stt_mode="off", db_path=":memory:", admin_user_ids=(ADMIN_ID,),
                        site_url="https://school.example", bot_username="school_bot", api_token="secret")
    assistant = TutorAssistant(settings, Storage(":memory:"))
    portal = Portal(assistant)
    relay = RelayService(assistant.storage)
    pair = relay.create_pair("Анна", "Миша")
    t, s = relay.invite_payloads(pair)
    relay.bind(t, TUTOR_ID)
    pair, _ = relay.bind(s, STUDENT_ID)
    code = assistant.create_parent_invite(pair.chat_id, "Миша")
    assistant.subscribe_parent(code, PARENT_ID)
    lesson = assistant.start_lesson(chat_id=pair.chat_id, tutor_id=TUTOR_ID, tutor_name="Анна",
                                    student_id=STUDENT_ID, student_name="Миша", title="Present Perfect")
    for role, text in LESSON:
        uid = TUTOR_ID if role == "tutor" else STUDENT_ID
        assistant.process_message(lesson["id"], uid, role, text, role=role)
    assistant.finish_lesson(lesson["id"], use_llm=False)
    return {"assistant": assistant, "portal": portal, "pair": pair, "lesson_id": lesson["id"], "settings": settings}


def viewer(env, uid):
    portal = env["portal"]
    return portal.viewer(portal.issue_token(uid, admin=uid == ADMIN_ID))


# -- каталог ---------------------------------------------------------------------------

def test_catalog_has_all_directions(env):
    data = catalog.catalog(env["settings"])
    ids = {c["id"] for c in data["courses"]}
    assert {"it-english", "aviation-english", "medical-english", "ielts", "toefl", "duolingo", "cambridge",
            "oet", "chinese-general"} <= ids
    assert {f"hsk-{x}" for x in ("1", "2", "3", "4", "5", "6", "7-9")} <= ids
    cats = {c["id"] for c in data["categories"]}
    assert all(c["category"] in cats for c in data["courses"])
    assert len(ids) == len(data["courses"])  # id уникальны
    assert data["bot_username"] == "school_bot"


# -- заявки ------------------------------------------------------------------------------

def test_application_flow(env):
    portal, got = env["portal"], []
    portal.application_handlers.append(got.append)
    body = {"name": "Ольга", "contact": "+7 999 123-45-67", "course_id": "hsk-4", "goal": "HSK 4", "consent": True}
    res = portal.submit_application(body, "1.2.3.4")
    assert res["ok"] and res["id"]
    assert got and got[0]["course_id"] == "hsk-4"
    admin = viewer(env, ADMIN_ID)
    apps = portal.applications(admin)["applications"]
    assert apps[0]["name"] == "Ольга" and "ip" not in apps[0]
    assert portal.set_application_status(admin, apps[0]["id"], "done")["status"] == "done"
    with pytest.raises(PortalError) as e:
        portal.applications(viewer(env, TUTOR_ID))  # контакты заявок видит только администратор
    assert e.value.status == 403


@pytest.mark.parametrize("body, status", [
    ({"contact": "+79991234567", "consent": True}, 400),
    ({"name": "Оля", "consent": True}, 400),
    ({"name": "Оля", "contact": "+79991234567"}, 400),  # без согласия
    ({"name": "Оля", "contact": "+79991234567", "consent": True, "course_id": "nope"}, 400),
    ({"name": "x" * 81, "contact": "+79991234567", "consent": True}, 400),
    ([1, 2], 400),
])
def test_application_validation(env, body, status):
    with pytest.raises(PortalError) as e:
        env["portal"].submit_application(body, "1.1.1.1")
    assert e.value.status == status


def test_application_spam_protection(env):
    portal = env["portal"]
    assert portal.submit_application({"website": "http://spam", "name": "bot"}, "5.5.5.5") == {"ok": True, "id": None}
    assert not env["assistant"].storage.applications()
    body = {"name": "Оля", "contact": "+79991234567", "consent": True}
    for _ in range(5):
        portal.submit_application(body, "6.6.6.6")
    with pytest.raises(PortalError) as e:
        portal.submit_application(body, "6.6.6.6")
    assert e.value.status == 429
    assert portal.submit_application(body, "7.7.7.7")["ok"]  # другой IP — можно


# -- доступ ---------------------------------------------------------------------------------

def test_tokens(env):
    portal, storage = env["portal"], env["assistant"].storage
    token = portal.issue_token(STUDENT_ID)
    assert storage.get_access_token(token) is None  # в базе только хеш
    assert portal.viewer(token).user_id == STUDENT_ID
    for bad in (None, "", "nope", "x" * 300):
        with pytest.raises(PortalError) as e:
            portal.viewer(bad)
        assert e.value.status == 401
    storage.add_access_token(hash_token("old"), "user", STUDENT_ID, datetime.now(timezone.utc) - timedelta(seconds=1))
    with pytest.raises(PortalError):
        portal.viewer("old")
    # Роль администратора — только если человек действительно в TUTOR_ADMIN_USER_IDS
    fake = portal.issue_token(STUDENT_ID, admin=True)
    assert portal.viewer(fake).admin is False
    portal.logout(portal.viewer(token))
    with pytest.raises(PortalError):
        portal.viewer(token)


def test_cabinet_link(env):
    token = env["portal"].issue_token(STUDENT_ID)
    assert env["portal"].cabinet_link(token) == f"https://school.example/#/cabinet?t={token}"


def test_me_by_role(env):
    portal = env["portal"]
    student = portal.me(viewer(env, STUDENT_ID))
    assert [c["role"] for c in student["chats"]] == ["student"]
    chat = student["chats"][0]
    assert chat["title"] == "Анна" and chat["with"] == "Анна" and chat["chat_url"] == "https://t.me/school_bot"
    assert TUTOR_ID not in json.dumps(student, ensure_ascii=False)  # аккаунт преподавателя не раскрывается
    assert student["lessons"][0]["has_report"] and student["lessons"][0]["words"] == 4
    assert portal.me(viewer(env, TUTOR_ID))["chats"][0]["role"] == "tutor"
    parent = portal.me(viewer(env, PARENT_ID))["chats"][0]
    assert parent["role"] == "parent" and "chat_url" not in parent  # родитель не пишет преподавателю
    stranger = portal.me(viewer(env, STRANGER_ID))
    assert stranger["chats"] == [] and stranger["lessons"] == [] and stranger["admin"] is False
    assert stranger["teacher_status"] is None and stranger["unread"] == 0
    assert portal.me(viewer(env, ADMIN_ID))["admin"] is True


def test_lesson_views(env):
    portal, lid = env["portal"], env["lesson_id"]
    student = portal.lesson(viewer(env, STUDENT_ID), lid)
    report = student["report"]
    assert student["role"] == "student" and report["vocabulary"]
    assert report["test"] and all(set(q) == {"kind", "question", "options"} for q in report["test"])  # без ответов
    assert "parent" not in report and "stats" not in report
    parent = portal.lesson(viewer(env, PARENT_ID), lid)["report"]
    assert "achievements" in parent["parent"] and "test" not in parent and parent["text"]
    tutor = portal.lesson(viewer(env, TUTOR_ID), lid)
    assert tutor["report"]["test"][0]["answer"] and tutor["text"]
    with pytest.raises(PortalError) as e:
        portal.lesson(viewer(env, STRANGER_ID), lid)
    assert e.value.status == 404


def test_check_test(env):
    portal, lid = env["portal"], env["lesson_id"]
    report = env["assistant"].storage.get_report(lid)
    v = viewer(env, STUDENT_ID)
    right = portal.check_test(v, lid, [q.answer for q in report.test])
    assert right["score"] == right["total"] == len(report.test)
    upper = portal.check_test(v, lid, [f"  {q.answer.upper()}! " for q in report.test])
    assert upper["score"] == len(report.test)
    empty = portal.check_test(v, lid, [])
    assert empty["score"] == 0 and empty["results"][0]["answer"] == report.test[0].answer
    for bad in (None, "text", [""] * (len(report.test) + 1)):
        with pytest.raises(PortalError):
            portal.check_test(v, lid, bad)


def test_normalize_answer():
    assert normalize_answer(" Ёлка! ") == "елка"
    assert normalize_answer("there’s") == "there's"


def test_words(env):
    words = env["portal"].words(viewer(env, STUDENT_ID))
    assert {"kitchen", "wardrobe", "cozy", "landlord"} <= {w["word"] for w in words["words"]}
    assert env["portal"].words(viewer(env, STRANGER_ID))["count"] == 0
    with pytest.raises(PortalError):
        env["portal"].words(viewer(env, STRANGER_ID), env["pair"].chat_id)


# -- класс ProgressMe ------------------------------------------------------------------------

@pytest.mark.parametrize("url, ok", [
    ("https://edu.progressme.ru/room/abc", True),
    ("https://progressme.ru/x", True),
    ("http://progressme.ru/x", False),
    ("https://progressme.ru.evil.com/x", False),
    ("https://evilprogressme.ru/x", False),
    ("https://t.me/anna", False),
    ("javascript:alert(1)", False),
])
def test_classroom_url(url, ok):
    assert valid_classroom_url(url, ("progressme.ru",)) is ok


def test_classroom_admin_only(env):
    portal, chat = env["portal"], env["pair"].chat_id
    with pytest.raises(PortalError) as e:
        portal.admin_set_classroom(viewer(env, TUTOR_ID), chat, "https://edu.progressme.ru/room/1")
    assert e.value.status == 403
    portal.admin_set_classroom(viewer(env, ADMIN_ID), chat, "https://edu.progressme.ru/room/1")
    assert portal.me(viewer(env, STUDENT_ID))["chats"][0]["classroom_url"] == "https://edu.progressme.ru/room/1"
    with pytest.raises(PortalError):
        portal.admin_set_classroom(viewer(env, ADMIN_ID), chat, "https://wa.me/79991234567")
    portal.admin_set_classroom(viewer(env, ADMIN_ID), chat, None)
    assert env["assistant"].storage.get_classroom(chat) is None


# -- доска --------------------------------------------------------------------------------------

def stroke():
    return {"kind": "stroke", "data": {"tool": "pen", "color": "#112233", "width": 4, "points": [[10, 10], [50, 60]]}}


def test_board_flow(env):
    portal, chat = env["portal"], env["pair"].chat_id
    tutor, student = viewer(env, TUTOR_ID), viewer(env, STUDENT_ID)
    board = portal.create_board(tutor, chat, "Present Perfect")
    assert portal.boards(student)["boards"][0]["id"] == board["id"]
    first = portal.add_board_item(student, board["id"], stroke())["id"]
    portal.add_board_item(tutor, board["id"], {"kind": "text", "data": {"text": "I have been", "color": "#000000",
                                                                         "at": [100, 100]}})
    items = portal.board_items(tutor, board["id"])
    assert [i["kind"] for i in items["items"]] == ["stroke", "text"]
    assert portal.board_items(tutor, board["id"], since=items["last_id"])["items"] == []
    assert portal.board_items(tutor, board["id"], since=first)["items"][0]["kind"] == "text"
    portal.add_board_item(student, board["id"], {"kind": "erase", "data": {"ids": [first]}})
    with pytest.raises(PortalError) as e:
        portal.add_board_item(student, board["id"], {"kind": "clear"})
    assert e.value.status == 403
    portal.add_board_item(tutor, board["id"], {"kind": "clear"})
    for who in (viewer(env, PARENT_ID), viewer(env, STRANGER_ID)):
        with pytest.raises(PortalError):
            portal.board_items(who, board["id"])


def test_board_text_contacts_blocked(env):
    portal, storage = env["portal"], env["assistant"].storage
    tutor = viewer(env, TUTOR_ID)
    board = portal.create_board(tutor, env["pair"].chat_id, "Урок")
    before = len(storage.incidents())
    for text in ("пиши мне в телеграм @anna_english", "мой номер 8 916 555 12 34", "anna@mail.ru"):
        with pytest.raises(PortalError) as e:
            portal.add_board_item(tutor, board["id"], {"kind": "text", "data": {"text": text, "color": "#000000",
                                                                                 "at": [1, 1]}})
        assert e.value.status == 422
    assert len(storage.incidents()) >= before + 3
    assert portal.board_items(tutor, board["id"])["items"] == []
    with pytest.raises(PortalError):
        portal.create_board(tutor, env["pair"].chat_id, "@anna_english")


@pytest.mark.parametrize("item", [
    {"kind": "nope"},
    {"kind": "stroke", "data": {"color": "red", "points": [[1, 1]]}},
    {"kind": "stroke", "data": {"color": "#000000", "points": []}},
    {"kind": "stroke", "data": {"color": "#000000", "points": [[1, "x"]]}},
    {"kind": "stroke", "data": {"color": "#000000", "points": [[1, 1]] * 5001}},
    {"kind": "shape", "data": {"shape": "star", "color": "#000000", "from": [0, 0], "to": [1, 1]}},
    {"kind": "text", "data": {"text": "", "color": "#000000", "at": [0, 0]}},
    {"kind": "text", "data": {"text": "a" * 501, "color": "#000000", "at": [0, 0]}},
    {"kind": "erase", "data": {"ids": ["1"]}},
    {"kind": "erase", "data": {"ids": [True]}},
])
def test_board_validation(env, item):
    portal = env["portal"]
    tutor = viewer(env, TUTOR_ID)
    board = portal.create_board(tutor, env["pair"].chat_id, "x")
    with pytest.raises(PortalError) as e:
        portal.add_board_item(tutor, board["id"], item)
    assert e.value.status == 400


def test_board_coordinates_clamped(env):
    portal = env["portal"]
    tutor = viewer(env, TUTOR_ID)
    board = portal.create_board(tutor, env["pair"].chat_id, "x")
    portal.add_board_item(tutor, board["id"], {"kind": "shape", "data": {"shape": "rect", "color": "#ABCDEF",
                                                                          "from": [-50, 0], "to": [99999, 5]}})
    data = portal.board_items(tutor, board["id"])["items"][0]["data"]
    assert data["from"] == [0, 0] and data["to"] == [1600, 5] and data["color"] == "#abcdef"


def test_parent_cannot_create_board(env):
    with pytest.raises(PortalError) as e:
        env["portal"].create_board(viewer(env, PARENT_ID), env["pair"].chat_id, "x")
    assert e.value.status == 403


# -- HTTP ------------------------------------------------------------------------------------------

@pytest.fixture
def server(env):
    srv = make_server(env["assistant"], "127.0.0.1", 0)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}"
    srv.shutdown()
    srv.server_close()


def fetch(url, method="GET", body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json",
                                                                         **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def test_http_site(env, server):
    status, headers, body = fetch(server + "/")
    assert status == 200 and b"<!doctype html>" in body and "default-src 'self'" in headers["Content-Security-Policy"]
    for name in ("app.js", "board.js", "app.css", "favicon.svg"):
        assert fetch(server + "/static/" + name)[0] == 200
    for bad in ("/static/../api.py", "/static/%2e%2e/api.py", "/static/nope.js", "/static/"):
        assert fetch(server + bad)[0] == 404
    status, _, body = fetch(server + "/site/v1/catalog")
    assert status == 200 and json.loads(body)["courses"]
    # API платформы по-прежнему закрыт токеном, а сайт — нет
    assert fetch(server + "/v1/incidents")[0] == 401
    status, _, body = fetch(server + "/site/v1/applications", "POST",
                            {"name": "Оля", "contact": "@olga", "course_id": "duolingo", "consent": True})
    assert status == 200 and json.loads(body)["ok"]
    assert fetch(server + "/site/v1/me")[0] == 401
    token = env["portal"].issue_token(STUDENT_ID)
    status, _, body = fetch(server + "/site/v1/me", headers={"X-Access-Token": token})
    assert status == 200 and json.loads(body)["lessons"]
    lid = env["lesson_id"]
    status, _, body = fetch(server + f"/site/v1/lessons/{lid}/test", "POST", {"answers": []},
                            headers={"X-Access-Token": token})
    assert status == 200 and "score" in json.loads(body)
    assert fetch(server + "/site/v1/me", "POST", {}, headers={"X-Access-Token": token})[0] == 405
    assert fetch(server + "/site/v1/nope")[0] == 404
    status, _, body = fetch(server + "/site/v1/applications", "POST", None)
    assert status == 400


def test_website_handles():
    assert Website.handles("/") and Website.handles("/site/v1/me") and Website.handles("/static/app.js")
    assert not Website.handles("/v1/lessons") and not Website.handles("/health")
