"""Онлайн-класс: видеоурок на сайте, запись и расшифровка речи, контроль контактов, отчёты в Telegram."""

import json
import threading
import urllib.request

import pytest
from conftest import FakeTranscriber

from tutor_assistant.api import make_server
from tutor_assistant.classroom import Classroom
from tutor_assistant.config import Settings
from tutor_assistant.portal import Portal, PortalError
from tutor_assistant.relay import RelayService
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage

TUTOR, STUDENT, PARENT, ADMIN, STRANGER = "70000111", "70000222", "70000333", "70000999", "70000444"


@pytest.fixture
def env():
    settings = Settings(llm_mode="off", stt_mode="off", db_path=":memory:", admin_user_ids=(ADMIN,),
                        admin_chat_id="-100", telegram_token="1:x", site_url="https://school.example")
    assistant = TutorAssistant(settings, Storage(":memory:"), transcriber=FakeTranscriber())
    portal = Portal(assistant)
    sent: list[tuple[str, str]] = []
    room = Classroom(portal, telegram_send=lambda chat, text: sent.append((chat, text)))
    relay = RelayService(assistant.storage)
    pair = relay.create_pair("Анна", "Миша")
    t, s = relay.invite_payloads(pair)
    relay.bind(t, TUTOR)
    pair, _ = relay.bind(s, STUDENT)
    assistant.subscribe_parent(assistant.create_parent_invite(pair.chat_id, "Миша"), PARENT)
    viewers = {uid: portal.viewer(portal.issue_token(uid, admin=uid == ADMIN))
               for uid in (TUTOR, STUDENT, PARENT, ADMIN, STRANGER)}
    return {"assistant": assistant, "portal": portal, "room": room, "pair": pair, "sent": sent, "v": viewers}


def start(env, title="Present Perfect"):
    return env["room"].start(env["v"][TUTOR], env["pair"].chat_id, title)["lesson_id"]


def test_only_tutor_starts_and_student_is_notified(env):
    room, v, chat = env["room"], env["v"], env["pair"].chat_id
    for uid in (STUDENT, PARENT, STRANGER):
        with pytest.raises(PortalError):
            room.start(v[uid], chat)
    lid = start(env)
    lesson = env["assistant"].storage.get_lesson(lid)
    assert lesson["status"] == "active" and lesson["student_id"] == STUDENT
    assert env["assistant"].recording_status(lid)["required"]  # без записи урок — нарушение
    assert room.start(v[TUTOR], chat)["lesson_id"] == lid  # повторный старт возвращает тот же урок
    to_student = [t for c, t in env["sent"] if c == STUDENT]
    assert to_student and f"https://school.example/#/room/{lid}" in to_student[0]
    with pytest.raises(PortalError) as e:
        room.start(v[TUTOR], chat.replace("pair:", "pair:x"))
    assert e.value.status == 404


def test_title_with_contacts_rejected(env):
    with pytest.raises(PortalError) as e:
        env["room"].start(env["v"][TUTOR], env["pair"].chat_id, "пиши в телеграм @anna_tutor")
    assert e.value.status == 422


def test_room_access_by_role(env):
    lid = start(env)
    room, v = env["room"], env["v"]
    assert room.state(v[TUTOR], lid)["role"] == "tutor"
    st = room.state(v[STUDENT], lid)
    assert st["role"] == "student" and st["peer"]["name"] == "Анна" and st["board_id"]
    assert TUTOR not in json.dumps(st, ensure_ascii=False)  # аккаунт преподавателя не раскрывается
    for uid in (PARENT, STRANGER):
        with pytest.raises(PortalError):
            room.state(v[uid], lid)
    assert room.state(v[ADMIN], lid)["role"] == "admin"  # администратор может наблюдать
    with pytest.raises(PortalError):
        room.signal(v[ADMIN], lid, {"kind": "hello"})


def test_signaling_and_presence(env):
    lid = start(env)
    room, v = env["room"], env["v"]
    assert room.state(v[TUTOR], lid)["peer"]["online"] is False
    room.state(v[STUDENT], lid)
    assert room.state(v[TUTOR], lid)["peer"]["online"] is True
    room.signal(v[STUDENT], lid, {"kind": "hello"})
    offer = room.signal(v[TUTOR], lid, {"kind": "offer", "data": {"type": "offer", "sdp": "v=0"}})["id"]
    got = room.state(v[STUDENT], lid)["signals"]
    assert [s["kind"] for s in got] == ["offer"] and got[0]["data"]["sdp"] == "v=0"  # свои сигналы не возвращаются
    assert room.state(v[STUDENT], lid, since_signal=offer)["signals"] == []
    assert [s["kind"] for s in room.state(v[TUTOR], lid)["signals"]] == ["hello"]
    for bad in ({"kind": "nope"}, "x", {"kind": "ice", "data": "a" * 70000}):
        with pytest.raises(PortalError):
            room.signal(v[TUTOR], lid, bad)


def test_chat_is_moderated_and_feeds_lesson(env):
    lid = start(env)
    room, v = env["room"], env["v"]
    out = room.chat(v[TUTOR], lid, {"text": "Новые слова сегодня: kitchen — кухня, cozy — уютный"})
    assert out["new_words"] == ["kitchen", "cozy"] and out["moderation"]["action"] == "allow"
    bad = room.chat(v[TUTOR], lid, {"text": "пиши мне в телеграм @anna_english, так дешевле"})
    assert bad["moderation"]["action"] == "block" and "@anna_english" not in bad["stored"]
    msgs = room.state(v[STUDENT], lid)["messages"]
    assert all("@anna_english" not in m["text"] for m in msgs) and msgs[0]["source"] == "text"
    assert any(c == "-100" and "Нарушение" in t for c, t in env["sent"])  # администратору — сразу
    for body in ({"text": ""}, {"text": "a" * 2001}, None):
        with pytest.raises(PortalError):
            room.chat(v[STUDENT], lid, body)


def test_speech_is_transcribed_and_checked(env):
    lid = start(env)
    room, v, storage = env["room"], env["v"], env["assistant"].storage
    ok = room.audio(v[TUTOR], lid, "Сегодня повторим Present Perfect".encode())
    assert ok == {"checked": True, "error": None, "blocked": False, "summary": None}
    bad = room.audio(v[STUDENT], lid, "мой номер восемь девятьсот шестнадцать пятьсот пятьдесят пять "
                                       "двенадцать тридцать четыре".encode())
    assert bad["blocked"] and bad["summary"]
    msgs = storage.messages_since(lid)
    assert [m["source"] for m in msgs] == ["speech", "speech"] and msgs[0]["role"] == "tutor"
    assert "девятьсот" not in msgs[1]["text"]  # в расшифровке урока номер скрыт
    incidents = storage.incidents(lesson_id=lid)
    assert incidents and incidents[0]["user_id"] == STUDENT and "девятьсот" in incidents[0]["original_text"]
    assert any("речь на уроке" in t for c, t in env["sent"] if c == "-100")
    assert env["assistant"].recording_status(lid)["seconds"] > 0
    with pytest.raises(PortalError):
        room.audio(v[TUTOR], lid, b"")


def test_number_split_between_speech_chunks(env):
    lid = start(env)
    room, v = env["room"], env["v"]
    room.audio(v[TUTOR], lid, "запиши мой номер восемь девятьсот шестнадцать".encode())
    out = room.audio(v[TUTOR], lid, "пятьсот пятьдесят пять двенадцать тридцать четыре".encode())
    assert out["blocked"]


def test_unchecked_speech_is_reported(env):
    lid = start(env)
    out = env["room"].audio(env["v"][TUTOR], lid, b"FAIL")
    assert out["checked"] is False and out["error"]


def test_finish_delivers_reports_to_telegram(env):
    lid = start(env)
    room, v, sent = env["room"], env["v"], env["sent"]
    room.chat(v[TUTOR], lid, {"text": "Новые слова сегодня: kitchen — кухня, wardrobe — шкаф, cozy — уютный"})
    room.audio(v[TUTOR], lid, "Домашнее задание: выучить новые слова и упражнение 4".encode())
    room.audio(v[STUDENT], lid, b"A cozy kitchen is my favourite place")
    with pytest.raises(PortalError):
        room.finish(v[STUDENT], lid)
    sent.clear()
    res = room.finish(v[TUTOR], lid)
    assert res["status"] == "finished" and res["delivered"] == {"student": 1, "parents": 1, "tutor": 1}
    by = {}
    for chat, text in sent:
        by.setdefault(chat, []).append(text)
    student = "\n".join(by[STUDENT])
    assert "kitchen" in student and "school.example/#/cabinet" in student and "в файле конспекта" not in student
    assert "Полный отчёт" in "\n".join(by[TUTOR]) and "родителям: 1" in "\n".join(by[TUTOR])
    assert by[PARENT]
    report = env["assistant"].storage.get_report(lid)
    assert {w.word for w in report.vocabulary} >= {"kitchen", "wardrobe", "cozy"}
    assert report.homework_teacher  # ДЗ из речи преподавателя попало в отчёт
    assert [s["kind"] for s in room.state(v[STUDENT], lid)["signals"]][-1] == "bye"
    assert room.finish(v[TUTOR], lid)["delivered"] is None  # повторно не рассылается
    with pytest.raises(PortalError):
        room.chat(v[TUTOR], lid, {"text": "ещё"})


def test_lesson_started_in_bot_gets_board(env):
    a = env["assistant"]
    pair = env["pair"]
    lesson = a.start_lesson(chat_id=pair.chat_id, tutor_id=TUTOR, student_id=STUDENT)
    first = env["room"].state(env["v"][STUDENT], lesson["id"])["board_id"]
    assert first and env["room"].state(env["v"][TUTOR], lesson["id"])["board_id"] == first


def test_ice_servers_setting(env):
    assert env["room"].ice_servers()[0]["urls"]
    import dataclasses
    env["room"].settings = dataclasses.replace(env["room"].settings,
                                               ice_servers='[{"urls":"turn:t.example:3478","username":"u","credential":"p"}]')
    assert env["room"].ice_servers()[0]["urls"] == "turn:t.example:3478"


def test_http_room_audio(env):
    srv = make_server(env["assistant"], "127.0.0.1", 0)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    try:
        token = env["portal"].issue_token(TUTOR)
        req = urllib.request.Request(base + "/site/v1/rooms", method="POST", data=json.dumps(
            {"chat_id": env["pair"].chat_id}).encode(), headers={"X-Access-Token": token, "Content-Type": "application/json"})
        lid = json.loads(urllib.request.urlopen(req, timeout=10).read())["lesson_id"]
        audio = urllib.request.Request(base + f"/site/v1/rooms/{lid}/audio", method="POST",
                                       data="Добрый день".encode(), headers={"X-Access-Token": token,
                                                                             "Content-Type": "audio/webm"})
        assert json.loads(urllib.request.urlopen(audio, timeout=10).read())["checked"] is True
    finally:
        srv.shutdown()
        srv.server_close()
