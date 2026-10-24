"""Конспект ученику и отчёт родителям по расшифрованной речи урока."""

import asyncio
import json
import threading
import types
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from tutor_assistant import render
from tutor_assistant.api import Api, ApiError
from tutor_assistant.config import Settings
from tutor_assistant.llm import LLMLessonReport
from tutor_assistant.models import ParentReport, Role, Utterance
from tutor_assistant.parent_report import collect_signals, homework_status, parent_note
from tutor_assistant.report import _merge_parent
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage

# Урок «голосом»: фрагменты записи преподавателя и ученика (распознавание подменено)
TUTOR_SPEECH = [
    "Здравствуй, Миша! Сначала проверим домашнее задание. Ты не сделал домашнее задание, это плохо.",
    "Тема урока: погода. Новые слова сегодня: rain - дождь, sunny - солнечный, windy - ветреный.",
    "Запомни: для описания погоды используется конструкция it is, например it is sunny. It is windy today.",
    "Отлично, молодец, ты хорошо используешь новые слова!",
    "Ты путаешь it is и there is, нужно потренировать это дома.",
    "Передайте родителям, что Миша стал увереннее говорить.",
    "Домашнее задание: выучить слова и написать пять предложений о погоде.",
]
STUDENT_SPEECH = ["It is rain today.", "Today it is sunny and windy. I like sunny weather very much."]


def run_spoken_lesson(a: TutorAssistant, chat_id: str = "pair:p1") -> str:
    lesson = a.start_lesson(chat_id=chat_id, tutor_id="t", tutor_name="Анна", student_id="s", student_name="Миша")
    lid = lesson["id"]
    for i, phrase in enumerate(TUTOR_SPEECH):
        a.process_audio(lid, "t", "Анна", phrase.encode(), role="tutor", recording=True)
        if i < len(STUDENT_SPEECH):
            a.process_audio(lid, "s", "Миша", STUDENT_SPEECH[i].encode(), role="student", recording=True)
    return lid


# -- извлечение из речи ------------------------------------------------------------------------


def test_parent_note_prefix():
    assert parent_note("Родителям: Миша стал увереннее") == "Миша стал увереннее"
    assert parent_note("Для родителей — нужно больше читать") == "нужно больше читать"
    assert parent_note("Расскажи о своих родителях") is None


@pytest.mark.parametrize("text, status", [
    ("Ты не сделал домашнее задание", "not_done"),
    ("Домашку сделал отлично, молодец", "done"),
    ("ДЗ выполнено частично", "partial"),
    ("Ты забыл про дз?", "not_done"),
    ("Домашнее задание: выучить слова", "unknown"),  # это новое задание, а не проверка старого
    ("Сегодня поговорим о погоде", "unknown"),
])
def test_homework_status(text, status):
    assert homework_status([Utterance("T", Role.TUTOR, text)]) == status


def test_signals_ignore_grammar_terms_as_praise():
    utts = [Utterance("T", Role.TUTOR, "Present Perfect образуется с have. Future Perfect тоже. Perfect!")]
    assert collect_signals(utts)["praise_count"] == 1


def test_signals_from_speech():
    utts = [Utterance("T", Role.TUTOR, t) for t in TUTOR_SPEECH]
    sig = collect_signals(utts)
    assert sig["homework_status"] == "not_done"
    assert sig["praise_count"] >= 2
    assert any("путаешь" in a for a in sig["attention"])
    assert any("родителям" in r for r in sig["remarks"])
    assert not any("Домашнее задание:" in a for a in sig["attention"])  # выдача ДЗ — не замечание


# -- полный сценарий ---------------------------------------------------------------------------


def test_spoken_lesson_reports(speech_assistant):
    lid = run_spoken_lesson(speech_assistant)
    speech_assistant.add_note(lid, "Миша стал заметно внимательнее", "t", "Анна")
    speech_assistant.process_message(lid, "t", "Анна", "Родителям: стоит больше читать вслух", role="tutor")
    report = speech_assistant.finish_lesson(lid)

    # Для ученика
    assert {v.word for v in report.vocabulary} >= {"rain", "sunny", "windy"}
    assert report.homework_teacher and "пять предложений" in report.homework_teacher[0].text
    assert report.rules and report.review_items
    student = render.render_student_report(report)
    assert "Что повторить" in student and "rain" in student
    assert "читать вслух" not in student and "внимательнее" not in student  # заметки для родителей скрыты
    assert all("Родителям" not in u.text for u in speech_assistant.storage.lesson_utterances(lid))

    # Для родителей
    p = report.parent
    assert p.student_name == "Миша"
    assert p.homework_status == "not_done"
    assert any("Изучено 3 новых слова" in x for x in p.achievements)
    assert any("Похвала преподавателя" in x for x in p.achievements)
    assert any("путаешь" in x for x in p.attention)
    assert any("не было выполнено" in x for x in p.attention)
    assert p.teacher_remarks[:2] == ["Миша стал заметно внимательнее", "стоит больше читать вслух"]
    assert any("родителям" in x for x in p.teacher_remarks)
    assert p.recommendations and p.activity
    parent = render.render_parent_report(report)
    for section in ("Успехи", "На что обратить внимание", "Замечания преподавателя", "Как помочь дома",
                    "Домашнее задание к этому уроку: не выполнено", "Задано к следующему уроку"):
        assert section in parent
    assert "_____" not in parent  # тест и ответы родителям не нужны

    # Преподавателю — всё вместе
    full = render.render_report(report)
    assert "Ответы" in full and "Отчёт об уроке" in full


def test_progress_between_lessons(speech_assistant):
    a = speech_assistant
    l1 = a.start_lesson(chat_id="c", tutor_id="t", student_id="s", student_name="Миша")["id"]
    for text in ("Новые слова: cat - кошка, dog - собака", "Не \"I has\", а \"I have\". Не \"he go\", а \"he goes\"."):
        a.process_message(l1, "t", "Анна", text, role="tutor")
    a.process_message(l1, "s", "Миша", "ok", role="student")
    r1 = a.finish_lesson(l1)
    assert r1.progress.lessons_total == 1 and r1.progress.corrections_prev is None

    l2 = a.start_lesson(chat_id="c", tutor_id="t", student_id="s", student_name="Миша")["id"]
    a.process_message(l2, "t", "Анна", "Новые слова: bird - птица. Домашку сделал отлично!", role="tutor")
    a.process_message(l2, "s", "Миша", "I have a bird and a cat at home, they are friends", role="student")
    r2 = a.finish_lesson(l2)
    assert r2.progress.lessons_total == 2 and r2.progress.words_total == 3
    assert r2.progress.corrections_prev == 2 and r2.progress.corrections_now == 0
    assert any("Ошибок меньше, чем на прошлом уроке: 2 → 0" in x for x in r2.parent.achievements)
    assert r2.parent.homework_status == "done"
    assert "Прогресс: уроков – 2" in render.render_parent_report(r2)


def test_note_with_contacts_is_rejected(speech_assistant):
    lid = speech_assistant.start_lesson(chat_id="c", tutor_id="t")["id"]
    ok, result = speech_assistant.add_note(lid, "Пусть мама позвонит мне: 89001234567", "t", "Анна")
    assert not ok and result.blocked
    assert speech_assistant.lesson_notes(lid) == []
    assert "заметке для родителей" in speech_assistant.storage.incidents(lesson_id=lid)[0]["summary"]
    out = speech_assistant.process_message(lid, "t", "Анна", "Родителям: мой телеграм @anna_t", role="tutor")
    assert out.moderation.blocked and out.parent_note and speech_assistant.lesson_notes(lid) == []


def test_merge_parent_from_llm_keeps_teacher_notes():
    llm = LLMLessonReport.model_construct(
        parent_summary="Хороший урок", parent_achievements=["Выучил слова"], parent_attention=[],
        parent_teacher_remarks=["Стал увереннее"], homework_status="unknown", parent_recommendations=["Читать"])
    offline = ParentReport(student_name="Миша", attention=["Мало говорит"], homework_status="not_done", activity="низкая")
    merged = _merge_parent(llm, offline, ["Заметка преподавателя"])
    assert merged.teacher_remarks == ["Заметка преподавателя", "Стал увереннее"]
    assert merged.homework_status == "not_done"  # Claude не понял — берём найденное в речи
    assert merged.attention == ["Мало говорит"] and merged.summary == "Хороший урок"


# -- API -----------------------------------------------------------------------------------------


def test_api_reports_and_notes(fake_stt):
    received = []

    class Hook(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802
            received.append(json.loads(self.rfile.read(int(self.headers["Content-Length"]))))
            self.send_response(204)
            self.end_headers()

        def log_message(self, *a):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Hook)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        settings = Settings(llm_mode="off", alert_webhook_url=f"http://127.0.0.1:{server.server_address[1]}/")
        api = Api(TutorAssistant(settings, Storage(":memory:"), transcriber=fake_stt))
        call = lambda m, p, body=None, query=None, raw=None: api.dispatch(m, p, query or {}, body or {}, None, raw=raw)  # noqa: E731
        _, lesson = call("POST", "/v1/lessons", {"tutor_id": "t", "student_id": "s", "student_name": "Миша"})
        lid = lesson["id"]
        for phrase in TUTOR_SPEECH:
            call("POST", f"/v1/lessons/{lid}/audio", query={"speaker_id": ["t"], "role": ["tutor"]}, raw=phrase.encode())
        status, out = call("POST", f"/v1/lessons/{lid}/notes", {"text": "Нужно больше читать"})
        assert status == HTTPStatus.CREATED and out["notes"] == ["Нужно больше читать"]
        status, out = call("POST", f"/v1/lessons/{lid}/notes", {"text": "мой номер 89001234567"})
        assert status == HTTPStatus.UNPROCESSABLE_ENTITY and not out["saved"]
        call("POST", f"/v1/lessons/{lid}/finish", {"use_llm": False})

        _, parent = call("GET", f"/v1/lessons/{lid}/report", query={"format": ["parent"]})
        assert "Успехи" in parent["text"] and parent["parent"]["homework_status"] == "not_done"
        _, student = call("GET", f"/v1/lessons/{lid}/report", query={"format": ["student"]})
        assert "Что повторить" in student["text"] and "Нужно больше читать" not in student["text"]
        with pytest.raises(ApiError):
            call("GET", f"/v1/lessons/{lid}/report", query={"format": ["xml"]})

        for _ in range(100):
            if any(r["type"] == "lesson_finished" for r in received):
                break
            threading.Event().wait(0.05)
        event = next(r for r in received if r["type"] == "lesson_finished")
        assert event["lesson_id"] == lid and "Отчёт об уроке" in event["parent_report"]
        assert "Что повторить" in event["student_report"]
    finally:
        server.shutdown()
        server.server_close()


# -- Telegram ---------------------------------------------------------------------------------------


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def bot(fake_stt):
    from tutor_assistant.telegram_bot import TutorBot

    settings = Settings(llm_mode="off", telegram_token="1:x", admin_chat_id="-500", admin_user_ids=("999",))
    return TutorBot(settings, TutorAssistant(settings, Storage(":memory:"), transcriber=fake_stt))


def test_bot_parent_flow(bot):
    from test_relay import Ctx, pm, sent_texts

    ctx = Ctx(["Анна Петровна", "|", "Миша"])
    up = pm(999, "/new_pair")
    run(bot.cmd_new_pair(up, ctx))
    text = up.effective_message.reply_text.call_args[0][0]
    parent_payload = next(w for w in text.split() if "start=p_" in w).split("start=")[1]
    pair = bot.relay.list()[0]
    t, s = bot.relay.invite_payloads(pair)
    run(bot.cmd_start(pm(111), Ctx([t])))
    run(bot.cmd_start(pm(222), Ctx([s])))
    welcome = pm(333, name="Мама Миши")
    run(bot.cmd_start(welcome, Ctx([parent_payload])))
    assert "Вы будете получать отчёт" in welcome.effective_message.reply_text.call_args[0][0]

    # Сообщение родителя не уходит преподавателю
    ctx = Ctx()
    msg = pm(333, "Здравствуйте, как дела у Миши?")
    run(bot.on_private_message(msg, ctx))
    assert sent_texts(ctx, 111) == []

    # Урок: заметка «Родителям:» не доходит до ученика
    run(bot.cmd_lesson_start(pm(111, "/lesson_start"), Ctx(["Погода"])))
    ctx = Ctx()
    note = pm(111, "Родителям: Миша стал увереннее, хвалите его", message_id=70)
    run(bot.on_private_message(note, ctx))
    assert sent_texts(ctx, 222) == []
    assert "Заметка для родителей сохранена" in note.effective_message.reply_text.call_args[0][0]
    run(bot.cmd_note(pm(111, "/note"), Ctx(["Нужно", "больше", "читать"])))
    for i, phrase in enumerate(TUTOR_SPEECH):
        voice = types.SimpleNamespace(file_size=100, file_name=None, get_file=None)
        from unittest.mock import AsyncMock

        file = types.SimpleNamespace(download_as_bytearray=AsyncMock(return_value=bytearray(phrase.encode())))
        voice.get_file = AsyncMock(return_value=file)
        run(bot.on_private_message(pm(111, message_id=80 + i, voice=voice), Ctx()))

    end = Ctx()
    run(bot.cmd_lesson_end(pm(111, "/lesson_end"), end))
    parent_text = "\n".join(sent_texts(end, 333))
    student_text = "\n".join(sent_texts(end, 222))
    tutor_text = "\n".join(sent_texts(end, 111))
    assert "Отчёт об уроке" in parent_text and "Миша стал увереннее, хвалите его" in parent_text
    assert "Нужно больше читать" in parent_text and "не выполнено" in parent_text
    assert "Что повторить" in student_text and "хвалите его" not in student_text
    assert "Отчёт отправлен родителям: 1" in tutor_text

    # Родитель запрашивает последний отчёт
    q = pm(333, "отчёт")
    run(bot.on_private_message(q, Ctx()))
    assert "Отчёт об уроке" in q.effective_message.reply_text.call_args[0][0]


def test_parent_link_limits(bot):
    from test_relay import Ctx, pm

    pair = bot.relay.create_pair("Анна", "Миша")
    ctx = Ctx([pair.id])
    run(bot.cmd_parent_link(pm(999, "/parent_link"), ctx))
    link = ctx.bot.send_message.call_args.args[1]
    code = link.split("start=p_")[1].split()[0]
    for uid in (301, 302):
        assert bot.assistant.subscribe_parent(code, str(uid))
    assert bot.assistant.subscribe_parent(code, "303") is None  # не больше двух родителей по ссылке
    assert bot.assistant.subscribe_parent(code, "301")  # повторное открытие — не ошибка
    up = pm(111, "/parent_link")
    run(bot.cmd_parent_link(up, Ctx([pair.id])))
    assert "администратор" in up.effective_message.reply_text.call_args[0][0]


def test_cli_audience(tmp_path, capsys, monkeypatch, sample_lesson):
    from tutor_assistant.cli import main

    monkeypatch.setenv("TUTOR_LLM", "off")
    monkeypatch.setenv("TUTOR_STT", "off")
    f = tmp_path / "lesson.txt"
    f.write_text(sample_lesson, encoding="utf-8")
    db = ["--db", str(tmp_path / "db.sqlite3")]
    assert main(db + ["analyze", str(f), "--for", "parent", "--parent-md", str(tmp_path / "p.md")]) == 0
    out = capsys.readouterr().out
    assert out.startswith("👨‍👩‍👧 Отчёт об уроке") and "Успехи" in out
    assert (tmp_path / "p.md").read_text(encoding="utf-8").startswith("# 👨‍👩‍👧")
    assert main(db + ["analyze", str(f), "--for", "student"]) == 0
    assert "Что повторить" in capsys.readouterr().out
