"""Слова в карточки из ДЗ, фото к ДЗ, правка ДЗ и отчётов, конструктор занятий."""

import json

import pytest

from tutor_assistant.accounts import Accounts
from tutor_assistant.config import Settings
from tutor_assistant.learning import Learning
from tutor_assistant.library import LIBRARY
from tutor_assistant.portal import Portal, PortalError
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage
from tutor_assistant.units import Units, generate_offline, grade, student_view, validate_blocks

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 100


class Headers(dict):
    pass


@pytest.fixture
def env(tmp_path):
    settings = Settings(llm_mode="off", stt_mode="off", db_path=":memory:", site_url="https://better.example")
    a = TutorAssistant(settings, Storage(":memory:"))
    portal = Portal(a)
    portal.telegram_send = lambda chat, text: None
    acc = Accounts(portal)
    lrn = Learning(portal, tmp_path)

    def reg(role, email, name, **kw):
        r = acc.register({"role": role, "name": name, "email": email, "password": "secret123", "consent": True, **kw}, "1")
        return portal.viewer(r["token"])

    tutor = reg("tutor", "t@mail.ru", "Анна")
    added = acc.add_student(tutor, {"name": "Миша"})
    student = reg("student", "s@mail.ru", "Миша", invite=added["invite"]["code"])
    parent = reg("parent", "p@mail.ru", "Ольга", invite=added["parent_invite"]["code"])
    return {"a": a, "portal": portal, "l": lrn, "u": Units(lrn), "tutor": tutor, "student": student, "parent": parent,
            "chat": f"pair:{added['pair_id']}"}


def keys(env, who="student"):
    return {w["word"] for w in env["l"].vocab(env[who], None if who == "student" else env["chat"])["words"]}


def test_homework_words_become_cards(env):
    lrn, chat = env["l"], env["chat"]
    out = lrn.assign(env["tutor"], {"chat_id": chat, "text": "Выучить новые слова: apple — яблоко, table — стол",
                                    "words": "kitchen — кухня\nwardrobe — шкаф"})
    assert out["words_added"] == 4
    assert keys(env) == {"apple", "table", "kitchen", "wardrobe"}
    queue = {c["word"] for c in lrn.cards(env["student"])["queue"]}
    assert queue == {"apple", "table", "kitchen", "wardrobe"}
    # ученик убрал слово — оно пропало и из словаря, и из карточек
    key = next(w["key"] for w in lrn.vocab(env["student"])["words"] if w["word"] == "table")
    lrn.delete_word(env["student"], {"key": key, "word": "table"})
    assert "table" not in keys(env) and "table" not in {c["word"] for c in lrn.cards(env["student"])["queue"]}
    # преподаватель добавил слово вручную — оно вернулось
    lrn.add_words(env["tutor"], {"chat_id": chat, "text": "table — стол"})
    assert "table" in keys(env)
    with pytest.raises(PortalError):
        lrn.add_words(env["parent"], {"chat_id": chat, "text": "dog — собака"})


def test_student_attaches_screenshot(env):
    lrn = env["l"]
    hw = lrn.assign(env["tutor"], {"chat_id": env["chat"], "text": "Упражнение 4"})["id"]
    f = lrn.attach(env["student"], hw, PNG, Headers({"Content-Type": "image/png", "X-File-Name": "screen.png"}))
    item = lrn.homework(env["tutor"])["homework"][0]
    assert item["attachments"][0]["url"] == f["url"] and lrn.file(f["id"])[1] == "image/png"
    assert lrn.homework(env["parent"])["homework"][0]["attachments"]  # родитель тоже видит
    with pytest.raises(PortalError):
        lrn.attach(env["tutor"], hw, PNG, Headers({"Content-Type": "image/png"}))
    with pytest.raises(PortalError):
        lrn.attach(env["student"], hw, b"not an image", Headers({"Content-Type": "image/png"}))
    lrn.update_homework(env["student"], hw, {"remove_attachment": f["id"]})
    assert lrn.homework(env["student"])["homework"][0]["attachments"] == []


def test_tutor_edits_and_deletes_homework(env):
    lrn = env["l"]
    hw = lrn.assign(env["tutor"], {"chat_id": env["chat"], "text": "Упр. 1"})["id"]
    lrn.update_homework(env["tutor"], hw, {"text": "Упр. 1 и 2", "due": "2026-11-01"})
    item = lrn.homework(env["student"])["homework"][0]
    assert item["text"] == "Упр. 1 и 2" and item["due"] == "2026-11-01"
    with pytest.raises(PortalError):
        lrn.update_homework(env["student"], hw, {"text": "ничего"})
    lrn.update_homework(env["tutor"], hw, {"status": "delete"})
    assert lrn.homework(env["tutor"])["homework"] == []


def test_tutor_edits_report(env):
    a, lrn, chat = env["a"], env["l"], env["chat"]
    pair_tutor = env["tutor"].user_id
    lesson = a.start_lesson(chat_id=chat, tutor_id=pair_tutor, student_id=env["student"].user_id)
    a.process_message(lesson["id"], pair_tutor, "Анна", "Новые слова: kitchen — кухня, sofa — диван")
    a.finish_lesson(lesson["id"], use_llm=False)
    assert "sofa" in keys(env)
    res = lrn.edit_report(env["tutor"], lesson["id"], {
        "summary": "Повторили комнаты", "homework": "Упр. 5\nСлова", "vocabulary": "kitchen — кухня\nbalcony — балкон",
        "parent": {"summary": "Миша молодец", "achievements": "Выучил 2 слова"}})
    assert res["report"]["summary"] == "Повторили комнаты" and res["report"]["parent"]["summary"] == "Миша молодец"
    assert keys(env) >= {"kitchen", "balcony"} and "sofa" not in keys(env)
    parent_view = env["portal"].lesson(env["parent"], lesson["id"])["report"]
    assert parent_view["parent"]["achievements"] == ["Выучил 2 слова"]
    with pytest.raises(PortalError):
        lrn.edit_report(env["student"], lesson["id"], {"summary": "я сам"})


def test_gap_match_choice_grading():
    unit = {"id": "u1", "title": "T", "blocks": validate_blocks([
        {"type": "gap", "text": "I [have been|'ve been] to [London].", "bank": True},
        {"type": "match", "pairs": [["cat", "кошка"], ["dog", "собака"]]},
        {"type": "choice", "questions": [{"q": "2+2", "options": ["3", "4"], "answer": "4"}]},
        {"type": "listening", "script": "My name is [Anna].", "questions": []},
        {"type": "write", "prompt": "Напишите"},
        {"type": "gap", "text": "нет скобок"},  # пустой блок отбрасывается
    ])}
    assert len(unit["blocks"]) == 5 and unit["blocks"][2]["questions"][0]["answer"] == 1
    view = json.dumps(student_view(unit), ensure_ascii=False)
    assert "собака" in view and "London" in view  # банк слов и правая колонка видны
    v = student_view(unit)
    assert v["blocks"][0]["parts"] == ["I ", " to ", "."] and "answer" not in json.dumps(v["blocks"][2])
    r = grade(unit, {"0": ["'ve been", "london"], "1": ["кошка", "кошка"], "2": [1], "3": ["anna"], "4": "My text"})
    assert r["blocks"]["0"]["gaps"] == [True, True] and r["blocks"]["1"]["pairs"] == [True, False]
    assert r["score"] == 5 and r["total"] == 6 and r["blocks"]["4"]["text"] == "My text"


def test_offline_generator():
    d = generate_offline("Дом", "kitchen — кухня\nsofa — диван\nbath — ванна\nlamp — лампа",
                         "We cook in the kitchen and sit on the sofa.")
    types = [b["type"] for b in d["blocks"]]
    assert types[:2] == ["words", "match"] and "gap" in types and "choice" in types and "listening" in types
    gap = next(b for b in d["blocks"] if b["type"] == "gap")
    assert "[kitchen]" in gap["text"] and "[sofa]" in gap["text"]
    with pytest.raises(PortalError):
        generate_offline("Пусто", "", "")


def test_units_flow(env):
    u, lrn = env["u"], env["l"]
    lst = u.list(env["tutor"])
    assert lst["units"] == [] and len(lst["library"]) == len(LIBRARY) and lst["ai"] is None
    copied = u.copy_library(env["tutor"], "lib-hsk1-greetings")
    assert copied["source"] == "library" and copied["mine"]
    draft = u.generate(env["tutor"], {"topic": "Еда", "words": "apple — яблоко\nbread — хлеб"})
    assert draft["generated_by"] == "offline"
    saved = u.save(env["tutor"], draft)
    hw = lrn.assign(env["tutor"], {"chat_id": env["chat"], "unit_id": saved["id"]})
    assert hw["words_added"] == 2 and "bread" in keys(env)
    data = u.homework_unit(env["student"], hw["id"])
    assert data["result"] is None and "answer" not in json.dumps(data["unit"]["blocks"])
    match_i = next(i for i, b in enumerate(saved["blocks"]) if b["type"] == "match")
    res = u.submit(env["student"], hw["id"], {"answers": {str(match_i): ["яблоко", "хлеб"]}})
    assert res["blocks"][str(match_i)]["pairs"] == [True, True]
    item = lrn.homework(env["tutor"])["homework"][0]
    assert item["status"] == "done" and item["score"]["score"] == 2 and item["unit"]["title"] == "Еда"
    with pytest.raises(PortalError):
        u.submit(env["tutor"], hw["id"], {"answers": {}})
    with pytest.raises(PortalError):
        u.list(env["student"])  # ученик не видит базу занятий
    other = Accounts(env["portal"]).register({"role": "tutor", "name": "Ира", "email": "o@mail.ru",
                                              "password": "secret123", "consent": True}, "2")
    with pytest.raises(PortalError):
        u.get(env["portal"].viewer(other["token"]), saved["id"])  # чужое занятие недоступно
    u.delete(env["tutor"], saved["id"])
    assert [x["id"] for x in u.list(env["tutor"])["units"]] == [copied["id"]]


def test_ai_generation(env, monkeypatch):
    u = env["u"]
    monkeypatch.setattr(type(u.ai), "provider", property(lambda self: "openai"))
    monkeypatch.setattr(u.ai, "complete", lambda system, user: 'Вот занятие:\n```json\n' + json.dumps({
        "title": "Travel", "level": "B1", "blocks": [
            {"type": "words", "items": [{"word": "luggage", "translation": "багаж"}]},
            {"type": "gap", "text": "Where is my [luggage]?"}, {"type": "unknown"}]}) + "\n```")
    d = u.generate(env["tutor"], {"topic": "Travel"})
    assert d["generated_by"] == "ai" and [b["type"] for b in d["blocks"]] == ["words", "gap"]
    monkeypatch.setattr(u.ai, "complete", lambda system, user: None)
    assert u.generate(env["tutor"], {"topic": "Travel", "words": "bag — сумка\nticket — билет"})["generated_by"] == "offline"
    with pytest.raises(PortalError):
        u.generate(env["tutor"], {"topic": "Travel"})


def test_library_units_are_valid():
    for unit in LIBRARY:
        blocks = validate_blocks(unit["blocks"])
        assert len(blocks) == len(unit["blocks"]), unit["id"]
        student_view({"id": unit["id"], "title": unit["title"], "blocks": blocks})
