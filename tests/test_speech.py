"""Речь и запись урока: расшифровка голоса, проверка контактов в речи, контроль перерывов записи."""

import asyncio
import json
import threading
import types
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import AsyncMock

import pytest
from conftest import FakeTranscriber

from tutor_assistant import recorder
from tutor_assistant.api import Api, ApiError, make_handler
from tutor_assistant.config import Settings
from tutor_assistant.contact_guard import ContactGuard
from tutor_assistant.service import TutorAssistant
from tutor_assistant.speech import Segment, UnavailableTranscriber, make_transcriber, segments_to_transcript
from tutor_assistant.storage import Storage

guard = ContactGuard()


# -- контакты, произнесённые вслух ---------------------------------------------------------


@pytest.mark.parametrize("speech", [
    "запиши мою почту иван точка петров собака джимейл точка ком",
    "пиши на anna собака яндекс точка ру",
    "мой ник анна нижнее подчёркивание тьютор, найди меня в телеграме",
    "Восемь девятьсот шестнадцать, пятьсот пятьдесят пять, двенадцать, тридцать четыре.",
    "+7 916 555-12-34, звони вечером",
    "давайте лучше заниматься напрямую, без платформы",
])
def test_spoken_contacts_are_blocked(speech):
    assert guard.check(speech).blocked, speech


@pytest.mark.parametrize("speech", [
    "Сегодня собака сидит дома. The dog is at home.",
    "Present Perfect: подчёркиваем результат, а не время.",
    "Откройте учебник на странице двадцать три, упражнение пять.",
])
def test_lesson_speech_is_allowed(speech):
    assert guard.check(speech).action == "allow", speech


def test_segments_are_grouped_into_blocks():
    segs = [Segment(0, 4, "Мой номер восемь"), Segment(4, 8, "девятьсот шестнадцать"), Segment(40, 45, "Hello")]
    text = segments_to_transcript(segs, speaker="Урок")
    assert text.split("\n") == ["[00:00:00] Урок: Мой номер восемь девятьсот шестнадцать", "[00:00:40] Урок: Hello"]


def test_make_transcriber_off():
    t = make_transcriber(Settings(stt_mode="off"))
    assert isinstance(t, UnavailableTranscriber) and not t.available


# -- сервис: фрагменты речи урока ------------------------------------------------------------


def _lesson(a: TutorAssistant, **kw):
    return a.start_lesson(chat_id="c", tutor_id="t", tutor_name="Анна", **kw)["id"]


def test_process_audio_clean_and_vocabulary(speech_assistant):
    lid = _lesson(speech_assistant)
    out = speech_assistant.process_audio(lid, "t", "Анна", "Новые слова сегодня: rain - дождь".encode(), role="tutor",
                                         recording=True)
    assert out.checked and not out.blocked
    assert [w.word for w in out.outcome.new_words] == ["rain"]
    assert speech_assistant.recording_status(lid)["chunks"] == 1
    report = speech_assistant.finish_lesson(lid)
    assert [v.word for v in report.vocabulary] == ["rain"]


def test_process_audio_blocks_phone_and_stores_redacted(speech_assistant):
    lid = _lesson(speech_assistant)
    out = speech_assistant.process_audio(lid, "t", "Анна", "запиши мой номер 8 916 555 12 34".encode(), role="tutor")
    assert out.blocked and out.incident_id
    stored = speech_assistant.storage.lesson_utterances(lid)
    assert "555" not in stored[0].text
    incident = speech_assistant.storage.incidents(lesson_id=lid)[0]
    assert "8 916 555 12 34" in incident["original_text"] and incident["role"] == "tutor"
    assert "555" not in out.to_dict()["transcript"]  # расшифровка в ответе — без номера


def test_number_split_between_recording_chunks(speech_assistant):
    lid = _lesson(speech_assistant)
    first = speech_assistant.process_audio(lid, "t", "Анна", "Если что, мой номер восемь девятьсот шестнадцать".encode(),
                                           role="tutor", recording=True)
    assert not first.blocked
    second = speech_assistant.process_audio(lid, "t", "Анна", "пятьсот пятьдесят пять двенадцать тридцать четыре".encode(),
                                            role="tutor", recording=True)
    assert second.blocked
    # другой говорящий не склеивается с хвостом преподавателя
    other = speech_assistant.process_audio(lid, "s", "Миша", "двенадцать тридцать четыре".encode(), role="student")
    assert not other.blocked


def test_unavailable_speech(settings, storage):
    a = TutorAssistant(settings, storage, transcriber=FakeTranscriber(available=False))
    lid = _lesson(a)
    out = a.process_audio(lid, "t", "Анна", b"hello", recording=True)
    assert not out.checked and out.error
    assert a.recording_status(lid)["chunks"] == 1  # запись всё равно отмечена — перерыва нет


def test_broken_audio(speech_assistant):
    lid = _lesson(speech_assistant)
    out = speech_assistant.process_audio(lid, "t", "Анна", b"FAIL")
    assert not out.checked and "не удалось" in out.error


def test_chat_audio_outside_lesson(speech_assistant):
    out = speech_assistant.moderate_chat_audio("chat9", "u", "Вася", "мой телеграм @vasya_99".encode())
    assert out.blocked and speech_assistant.storage.incidents(chat_id="chat9")


def test_analyze_audio(speech_assistant):
    audio = ("Учитель говорит: тема урока погода | Новые слова сегодня: rain - дождь, sunny - солнечный"
             " | Мой телеграм @anna_tutor | ДЗ: выучить слова").encode()
    report, violations, transcript = speech_assistant.analyze_audio(audio, title="Запись")
    assert {v.word for v in report.vocabulary} >= {"rain", "sunny"}
    assert report.homework_teacher
    assert len(violations) == 1 and "@anna_tutor" in violations[0]["original_text"]
    assert "anna_tutor" not in report.model_dump_json()
    assert transcript.startswith("[00:00:00] Урок:")


# -- контроль записи ---------------------------------------------------------------------------


def test_recording_gap_detection(settings, storage, fake_stt):
    a = TutorAssistant(Settings(**{**settings.__dict__, "recording_gap_seconds": 60}), storage, transcriber=fake_stt)
    lid = _lesson(a, require_recording=True)
    start = datetime.fromisoformat(storage.get_recording(lid)["started_at"])
    assert a.check_recording_gaps(now=start + timedelta(seconds=30)) == []
    gaps = a.check_recording_gaps(now=start + timedelta(seconds=90))
    assert len(gaps) == 1 and gaps[0]["never_started"] and "не включена" in gaps[0]["summary"]
    assert a.check_recording_gaps(now=start + timedelta(seconds=120)) == []  # о том же перерыве — один раз

    storage.touch_recording(lid, 15, at=start + timedelta(seconds=200))
    assert a.recording_status(lid, now=start + timedelta(seconds=210))["active"]
    gaps = a.check_recording_gaps(now=start + timedelta(seconds=300))
    assert len(gaps) == 1 and "прервана" in gaps[0]["summary"] and not gaps[0]["never_started"]
    incidents = storage.incidents(lesson_id=lid)
    assert len(incidents) == 2 and incidents[0]["role"] == "tutor"

    a.finish_lesson(lid)
    assert a.check_recording_gaps(now=start + timedelta(hours=5)) == []  # урок завершён


def test_no_gap_alerts_when_recording_not_required(speech_assistant):
    lid = _lesson(speech_assistant)
    assert speech_assistant.check_recording_gaps(now=datetime.now(timezone.utc) + timedelta(hours=1)) == []
    assert speech_assistant.recording_status(lid)["required"] is False


def test_alert_handlers_and_webhook(settings, storage):
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
        url = f"http://127.0.0.1:{server.server_address[1]}/hook"
        a = TutorAssistant(Settings(**{**settings.__dict__, "alert_webhook_url": url}), storage)
        local = []
        a.alert_handlers.append(local.append)
        a.alert_handlers.append(lambda p: 1 / 0)  # сломанный обработчик не мешает
        result, incident_id = a.moderate_chat_message("c", "u", "Вася", "звони 89001234567")
        assert result.blocked and local[0]["id"] == incident_id and local[0]["role"] == "unknown"
        for _ in range(100):
            if received:
                break
            threading.Event().wait(0.05)
        assert received and received[0]["type"] == "incident" and received[0]["incident"]["id"] == incident_id
    finally:
        server.shutdown()
        server.server_close()


# -- HTTP API ------------------------------------------------------------------------------------


@pytest.fixture
def api(fake_stt):
    settings = Settings(llm_mode="off", api_token="secret")
    return Api(TutorAssistant(settings, Storage(":memory:"), transcriber=fake_stt))


def call(api, method, path, body=None, query=None, raw=None):
    return api.dispatch(method, path, query or {}, body or {}, "Bearer secret", raw=raw)


def test_api_lesson_audio(api):
    status, lesson = call(api, "POST", "/v1/lessons", {"tutor_id": "t", "require_recording": True})
    assert status == HTTPStatus.CREATED
    assert lesson["recording"]["required"] and lesson["recording"]["upload_url"].endswith("/audio")
    lid = lesson["id"]
    status, out = call(api, "POST", f"/v1/lessons/{lid}/audio", query={"speaker_id": ["t"], "role": ["tutor"]},
                       raw="Новые слова сегодня: cat - кошка".encode())
    assert status == HTTPStatus.OK and out["checked"] and out["new_words"][0]["word"] == "cat"
    assert out["recording"]["chunks"] == 1
    _, out = call(api, "POST", f"/v1/lessons/{lid}/audio", query={"speaker_id": ["t"]},
                  raw="пиши мне на почту anna собака gmail точка com".encode())
    assert out["moderation"]["action"] == "block" and "gmail" not in out["transcript"]
    with pytest.raises(ApiError):
        call(api, "POST", f"/v1/lessons/{lid}/audio", raw=b"")
    assert call(api, "GET", "/health")[1]["speech"] is True


def test_api_audio_unavailable(fake_stt):
    a = Api(TutorAssistant(Settings(llm_mode="off"), Storage(":memory:"), transcriber=FakeTranscriber(False)))
    _, lesson = a.dispatch("POST", "/v1/lessons", {}, {}, None)
    status, out = a.dispatch("POST", f"/v1/lessons/{lesson['id']}/audio", {}, {}, None, raw=b"x")
    assert status == HTTPStatus.OK and out["checked"] is False  # фрагмент учтён в записи
    with pytest.raises(ApiError) as e:
        a.dispatch("POST", "/v1/analyze/audio", {}, {}, None, raw=b"x")
    assert e.value.status == HTTPStatus.SERVICE_UNAVAILABLE


def test_api_analyze_audio(api):
    raw = "Новые слова сегодня: rain - дождь | мой номер 89001234567".encode()
    _, data = call(api, "POST", "/v1/analyze/audio", query={"use_llm": ["false"]}, raw=raw)
    assert data["report"]["vocabulary"][0]["word"] == "rain"
    assert len(data["violations"]) == 1 and "89001234567" not in data["transcript"]


def test_api_audio_over_real_http(api):
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(api))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        _, lesson = call(api, "POST", "/v1/lessons", {"tutor_id": "t"})
        upload = recorder.ApiUploader(base, lesson["id"], recorder.Speaker("t", "Анна", "tutor"), token="secret")
        out = upload("мой телеграм @anna_tutor".encode())
        assert out["moderation"]["action"] == "block"
        bad = recorder.ApiUploader(base, lesson["id"], recorder.Speaker(), token="wrong")
        with pytest.raises(recorder.PermanentUploadError):
            bad(b"hello")
    finally:
        server.shutdown()
        server.server_close()


# -- программа записи ----------------------------------------------------------------------------


def test_run_recording_reports_and_retries():
    lines = []
    attempts = {"n": 0}

    def upload(wav):
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise urllib.error.URLError("нет сети")
        text = wav.decode()
        action = "block" if "номер" in text else "allow"
        return {"checked": True, "moderation": {"action": action, "summary": "номер телефона"}, "new_words": []}

    violations = recorder.run_recording(iter([b"hello", b"my number", "мой номер".encode()]), upload, lines.append,
                                        retry_delays=(0,))
    assert violations == 1
    assert any("контактные данные" in s for s in lines) and sum("ок" in s for s in lines) == 2


def test_run_recording_stops_on_permanent_error():
    lines = []

    def upload(_):
        raise recorder.PermanentUploadError("урок уже завершён")

    assert recorder.run_recording(iter([b"a", b"b"]), upload, lines.append) == 0
    assert lines == ["⛔ Запись остановлена: урок уже завершён"]


def test_run_recording_keeps_chunks_while_offline():
    lines = []

    def upload(_):
        raise urllib.error.URLError("нет сети")

    recorder.run_recording(iter([b"a", b"b"]), upload, lines.append, retry_delays=())
    assert any("фрагментов в очереди: 2" in s for s in lines)
    assert "последние фрагменты записи: 2" in lines[-1]


def test_local_uploader(speech_assistant):
    lid = _lesson(speech_assistant)
    up = recorder.LocalUploader(speech_assistant, lid, recorder.Speaker("t", "Анна", "tutor"))
    assert up("мой номер 89001234567".encode())["moderation"]["action"] == "block"
    assert speech_assistant.recording_status(lid)["chunks"] == 1


def test_wav_and_file_chunks(tmp_path):
    import wave

    wav = recorder.pcm16_to_wav(b"\x00\x00" * 16000)
    path = tmp_path / "a.wav"
    path.write_bytes(wav)
    with wave.open(str(path)) as w:
        assert w.getframerate() == 16000 and w.getnframes() == 16000
    pytest.importorskip("faster_whisper")
    long = tmp_path / "long.wav"
    long.write_bytes(recorder.pcm16_to_wav(b"\x01\x00" * 16000 * 5))
    chunks = list(recorder.iter_file_chunks(str(long), 2))
    assert len(chunks) == 3


# -- Telegram-бот ----------------------------------------------------------------------------------


def _voice(text, file_size=1000):
    data = text.encode()
    file = types.SimpleNamespace(download_as_bytearray=AsyncMock(return_value=bytearray(data)))
    return types.SimpleNamespace(file_size=file_size, get_file=AsyncMock(return_value=file), file_name=None)


@pytest.fixture
def relay_bot(fake_stt):
    from tutor_assistant.telegram_bot import TutorBot

    settings = Settings(llm_mode="off", telegram_token="1:x", admin_chat_id="-500", admin_user_ids=("999",))
    bot = TutorBot(settings, TutorAssistant(settings, Storage(":memory:"), transcriber=fake_stt))
    pair = bot.relay.create_pair("Анна Петровна", "Миша")
    t, s = bot.relay.invite_payloads(pair)
    bot.relay.bind(t, "111")
    bot.relay.bind(s, "222")
    return bot


def run(coro):
    return asyncio.run(coro)


def test_bot_relay_voice(relay_bot):
    from test_relay import Ctx, pm, sent_texts

    ctx = Ctx()
    run(relay_bot.on_private_message(pm(111, message_id=5, voice=_voice("Привет! Сегодня тема — погода.")), ctx))
    assert ctx.bot.copy_message.call_args.args[0] == 222  # чистое голосовое доставлено

    ctx = Ctx()
    up = pm(111, message_id=6, voice=_voice("Запиши мой номер восемь девятьсот шестнадцать пятьсот пятьдесят пять "
                                             "двенадцать тридцать четыре"))
    run(relay_bot.on_private_message(up, ctx))
    ctx.bot.copy_message.assert_not_called()
    assert "не доставлено" in up.effective_message.reply_text.call_args[0][0]
    admin = sent_texts(ctx, -500)
    assert admin and "Расшифровка" in admin[0] and "пятьсот пятьдесят пять" in admin[0]


def test_bot_relay_voice_without_speech_recognition(relay_bot):
    from test_relay import Ctx, pm

    relay_bot.assistant.transcriber = FakeTranscriber(available=False)
    ctx = Ctx()
    up = pm(111, message_id=7, voice=_voice("hello"))
    run(relay_bot.on_private_message(up, ctx))
    ctx.bot.copy_message.assert_not_called()
    assert "не удалось проверить речь" in up.effective_message.reply_text.call_args[0][0]

    relay_bot.settings = Settings(**{**relay_bot.settings.__dict__, "relay_unchecked_audio": True})
    ctx = Ctx()
    run(relay_bot.on_private_message(pm(111, message_id=8, voice=_voice("hello")), ctx))
    ctx.bot.copy_message.assert_called_once()


def test_bot_relay_lesson_start_announces_recording(relay_bot):
    from test_relay import Ctx, pm

    relay_bot.settings = Settings(**{**relay_bot.settings.__dict__, "require_recording": True})
    ctx = Ctx(["Погода"])
    up = pm(111, "/lesson_start")
    run(relay_bot.cmd_lesson_start(up, ctx))
    text = up.effective_message.reply_text.call_args[0][0]
    lesson = relay_bot.assistant.storage.active_lesson(relay_bot.relay.list()[0].chat_id)
    assert "Урок записывается" in text and f"record --lesson {lesson['id']}" in text
    assert relay_bot.assistant.recording_status(lesson["id"])["required"]
    assert "Урок записывается" in ctx.bot.send_message.call_args.args[1]  # ученик тоже предупреждён


def test_bot_gap_alert(relay_bot):
    from test_relay import Ctx

    ctx = Ctx()
    pair = relay_bot.relay.list()[0]
    gap = {"lesson_id": "L1", "chat_id": pair.chat_id, "tutor_id": "111", "summary": "запись урока прервана: нет звука 120 с",
           "incident_id": 5}
    run(relay_bot._alert_gap(ctx.bot, gap))
    targets = [c.args[0] for c in ctx.bot.send_message.call_args_list]
    assert targets == [111, -500]


def test_bot_group_voice_deleted(fake_stt):
    from test_interfaces import Ctx, make_update

    from tutor_assistant.telegram_bot import TutorBot

    settings = Settings(llm_mode="off", telegram_token="1:x")
    bot = TutorBot(settings, TutorAssistant(settings, Storage(":memory:"), transcriber=fake_stt))
    up = make_update(None, user_id=5, name="Вася")
    up.effective_message.voice = _voice("найди меня в инсте, ник vasya_2010")
    ctx = Ctx()
    run(bot.on_group_message(up, ctx))
    up.effective_message.delete.assert_awaited()
    assert any("[скрыто]" in c.args[1] or "скрыто" in c.args[1] for c in ctx.bot.send_message.call_args_list)


def test_bot_private_recording_analysis(fake_stt):
    from test_relay import Ctx, pm

    from tutor_assistant.telegram_bot import TutorBot

    settings = Settings(llm_mode="off", telegram_token="1:x")
    bot = TutorBot(settings, TutorAssistant(settings, Storage(":memory:"), transcriber=fake_stt))
    ctx = Ctx()
    audio = _voice("Новые слова сегодня: rain - дождь | мой номер 89001234567")
    run(bot.on_private_message(pm(777, audio=audio), ctx))
    texts = "\n".join(c.args[1] for c in ctx.bot.send_message.call_args_list)
    assert "rain" in texts and "Нарушения правил общения" in texts


def test_cli_transcribe_and_analyze_audio(tmp_path, capsys, monkeypatch):
    import tutor_assistant.service as service_mod
    from tutor_assistant.cli import main

    monkeypatch.setenv("TUTOR_LLM", "off")
    monkeypatch.setattr(service_mod, "make_transcriber", lambda s: FakeTranscriber())
    f = tmp_path / "lesson.mp3"
    f.write_text("Новые слова сегодня: rain - дождь | мой номер 89001234567", encoding="utf-8")
    db = ["--db", str(tmp_path / "db.sqlite3")]
    assert main(db + ["transcribe", str(f)]) == 1
    out = capsys.readouterr()
    assert "[00:00:00] Урок:" in out.out and "номер телефона" in out.err
    assert main(db + ["analyze", str(f), "--transcript-out", str(tmp_path / "t.txt")]) == 0
    out = capsys.readouterr().out
    assert "rain" in out and "Нарушения правил общения" in out
    assert (tmp_path / "t.txt").exists()


def test_cli_record_from_file(tmp_path, capsys, monkeypatch):
    import tutor_assistant.service as service_mod
    from tutor_assistant.cli import main

    monkeypatch.setenv("TUTOR_LLM", "off")
    monkeypatch.setattr(service_mod, "make_transcriber", lambda s: FakeTranscriber())
    monkeypatch.setattr(recorder, "iter_file_chunks",
                        lambda path, chunk: iter([b"Hello", "мой номер 89001234567".encode()]))
    db = str(tmp_path / "db.sqlite3")
    lesson = TutorAssistant(Settings(db_path=db, llm_mode="off", stt_mode="off")).start_lesson(chat_id="x")
    assert main(["--db", db, "record", "--lesson", lesson["id"], "--file", "any.wav"]) == 1
    out = capsys.readouterr()
    assert "Фрагмент 1: ок" in out.out and "контактные данные" in out.out
    assert main(["--db", db, "record"]) == 2




def test_run_recording_flushes_queue_at_the_end():
    lines, attempts = [], {"n": 0}

    def upload(_):
        attempts["n"] += 1
        if attempts["n"] <= 2:
            raise urllib.error.URLError("нет сети")
        return {"checked": True, "moderation": {"action": "allow"}}

    recorder.run_recording(iter([b"a", b"b"]), upload, lines.append, retry_delays=())
    assert sum("ок" in s for s in lines) == 2  # обе части дошли, когда связь вернулась


def test_unchecked_chunk_counts_duration(settings, storage):
    a = TutorAssistant(settings, storage, transcriber=FakeTranscriber(available=False))
    lid = _lesson(a)
    a.process_audio(lid, "t", "Анна", recorder.pcm16_to_wav(b"\x00\x00" * 32000), recording=True)
    assert a.recording_status(lid)["seconds"] == 2.0


def test_model_load_failure_is_not_retried_every_chunk(monkeypatch):
    pytest.importorskip("faster_whisper")
    import faster_whisper

    from tutor_assistant import speech

    calls = {"n": 0}

    def broken(*a, **k):
        calls["n"] += 1
        raise OSError("нет доступа к huggingface.co")

    monkeypatch.setattr(faster_whisper, "WhisperModel", broken)
    t = speech.WhisperTranscriber("tiny")
    for _ in range(3):
        with pytest.raises(RuntimeError):
            t.transcribe(b"x")
    assert calls["n"] == 1 and "huggingface" in t.last_error
