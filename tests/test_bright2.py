"""Голосовые в чате, помощник «Искорка», выбор языка распознавания, диагностика системы."""

import time

import pytest
from conftest import FakeTranscriber

from tutor_assistant.accounts import Accounts
from tutor_assistant.community import Community
from tutor_assistant.config import Settings
from tutor_assistant.learning import Learning
from tutor_assistant.portal import Portal, PortalError
from tutor_assistant.service import TutorAssistant
from tutor_assistant.spark import Spark
from tutor_assistant.storage import Storage

PAD = b" " * 300  # голосовое короче 200 байт считается пустым


@pytest.fixture
def env(tmp_path):
    settings = Settings(llm_mode="off", stt_mode="off", db_path=":memory:", site_url="https://bright.example")
    stt = FakeTranscriber()
    a = TutorAssistant(settings, Storage(":memory:"), transcriber=stt)
    portal = Portal(a)
    portal.telegram_send = lambda chat, text: None
    learning = Learning(portal, tmp_path)
    acc = Accounts(portal)
    return {"a": a, "portal": portal, "acc": acc, "c": Community(portal), "l": learning, "stt": stt,
            "spark": Spark(portal, learning, acc)}


def reg(env, role, email, name="Анна", **kw):
    res = env["acc"].register({"role": role, "name": name, "email": email, "password": "secret123", "consent": True, **kw}, "1.1.1.1")
    return env["portal"].viewer(res["token"])


def pair(env, school=False):
    if school:
        owner = reg(env, "school", "s@mail.ru", "Ирина", school_name="Лингва")
        code = env["acc"].school(owner)["tutor_invite"]["code"]
        tutor = reg(env, "tutor", "t@mail.ru", "Анна", invite=code)
    else:
        tutor = reg(env, "tutor", "t@mail.ru", "Анна")
    added = env["acc"].add_student(tutor, {"name": "Миша"})
    student = reg(env, "student", "m@mail.ru", "Миша", invite=added["invite"]["code"])
    return tutor, student, f"pair:{added['pair_id']}"


def save(env, viewer):
    return lambda data, mime: env["l"].save_audio(viewer.user_id, data, mime)


def test_voice_message_private_pair(env):
    tutor, student, chat = pair(env)
    out = env["c"].send_voice(student, chat, "Я сделал домашку".encode() + PAD, "audio/webm", save(env, student))
    assert out["audio"].startswith("/site/v1/files/") and out["stored"].startswith("Я сделал домашку")
    msgs = env["c"].messages(tutor, chat)["messages"]
    assert msgs[-1]["audio"] == out["audio"] and msgs[-1]["source"] == "voice"
    data, mime, _ = env["l"].file(out["audio"].rsplit("/", 1)[1])
    assert mime == "audio/webm" and data.startswith("Я сделал".encode())
    assert env["l"].materials(tutor)["materials"] == []  # голосовые не засоряют материалы
    with pytest.raises(PortalError):
        env["c"].send_voice(student, chat, b"x", "audio/webm", save(env, student))


def test_voice_with_contacts_blocked_in_school(env):
    tutor, student, chat = pair(env, school=True)
    out = env["c"].send_voice(student, chat, "напиши мне в телеграм @misha_real".encode() + PAD, "audio/webm", save(env, student))
    assert out["moderation"]["action"] == "block" and out["audio"] is None
    assert env["c"].messages(tutor, chat)["messages"][-1]["audio"] is None  # звук не отдаём
    env["stt"]._available = False
    with pytest.raises(PortalError) as e:  # без распознавания проверить нечем – в школе не пропускаем
        env["c"].send_voice(student, chat, "привет".encode() + PAD, "audio/webm", save(env, student))
    assert e.value.status == 503


def test_spark_offline_and_quiz(env):
    tutor, student, chat = pair(env)
    env["l"].add_words(tutor, {"chat_id": chat, "text": "kitchen – кухня\ntable – стол"})
    h = env["spark"].ask(student, {"text": "Как начать урок?"})
    assert h["ai"] is False and "Начать урок" in h["messages"][-1]["text"]
    h = env["spark"].ask(student, {"text": "Проверь мои слова"})
    assert "kitchen" in h["messages"][-1]["text"]
    h = env["spark"].ask_voice(student, "где домашка".encode() + PAD)
    assert h["messages"][-2]["voice"] and "Домашка" in h["messages"][-1]["text"]
    # без ИИ вопрос о языке не путается с вопросом о разделе «Домашка»
    h = env["spark"].ask(student, {"text": "Как сказать по-английски «я уже сделал домашку»?"})
    assert "включит ИИ" in h["messages"][-1]["text"] and "проверь мои слова" in h["messages"][-1]["text"]
    assert env["spark"].clear(student)["messages"] == []
    with pytest.raises(PortalError):
        env["spark"].ask(student, {"text": "  "})


def test_spark_with_ai_answers_in_background(env):
    tutor, student, chat = pair(env)
    sp = env["spark"]
    calls = []
    sp.ai.settings = Settings(ai_url="http://ai.local/v1", ai_model="qwen")  # провайдер «openai»
    sp.ai.chat = lambda system, dialog, timeout=None: calls.append((system, dialog)) or "Present Perfect — это..."
    h = sp.ask(tutor, {"text": "Объясни Present Perfect"})
    assert h["ai"] and h["messages"][-1]["status"] in ("pending", "done")
    for _ in range(50):
        last = sp.history(tutor)["messages"][-1]
        if last["status"] == "done":
            break
        time.sleep(0.02)
    assert last["text"] == "Present Perfect – это..."  # длинное тире заменено
    system, dialog = calls[0]
    assert "Миша" in system and dialog[-1] == {"role": "user", "content": "Объясни Present Perfect"}


def test_spark_rate_limit(env):
    tutor, _, _ = pair(env)
    for _ in range(40):
        env["spark"].ask(tutor, {"text": "где домашка"})
    with pytest.raises(PortalError) as e:
        env["spark"].ask(tutor, {"text": "где домашка"})
    assert e.value.status == 429


def test_transcribe_passes_allowed_languages(env):
    class Picky(FakeTranscriber):
        def transcribe(self, audio, language=None, allowed=None):
            self.allowed = allowed
            return super().transcribe(audio, language)

    st = Picky()
    env["a"].transcriber = st
    env["a"].transcribe(b"hello", languages=("ru", "en"))
    assert st.allowed == ("ru", "en")
    env["a"].transcriber = FakeTranscriber()  # старый интерфейс без allowed тоже работает
    tr, err = env["a"].transcribe(b"hello", languages=("ru", "en"))
    assert tr.text == "hello" and err is None


# -- приложение: service worker, APK и ссылки на него ----------------------------------------------

def test_app_files_and_links(tmp_path):
    from tutor_assistant.website import Website

    web = tmp_path / "web"
    web.mkdir()
    (web / "index.html").write_text("<html></html>")
    (web / "sw.js").write_text("self.addEventListener('fetch', () => {});")
    settings = Settings(llm_mode="off", stt_mode="off", db_path=str(tmp_path / "db.sqlite3"))
    site = Website(Portal(TutorAssistant(settings, Storage(":memory:"))), web_dir=web)
    assert Website.handles("/sw.js") and Website.handles("/bright.apk")

    sw = site.static("/sw.js")
    assert sw.status == 200 and sw.headers["Cache-Control"] == "no-cache"
    assert site.static("/bright.apk").status == 404
    cfg = site.public_config()
    assert cfg["apk_url"] is None and cfg["rustore_url"] is None

    (tmp_path / "bright.apk").write_bytes(b"PK\x03\x04apk")
    apk = site.static("/bright.apk")
    assert apk.status == 200 and apk.body == b"PK\x03\x04apk"
    assert apk.content_type == "application/vnd.android.package-archive"
    assert site.public_config()["apk_url"] == "/bright.apk"

    settings2 = Settings(llm_mode="off", stt_mode="off", db_path=":memory:", rustore_url="https://www.rustore.ru/catalog/app/x")
    site2 = Website(Portal(TutorAssistant(settings2, Storage(":memory:"))), web_dir=web)
    assert site2.public_config()["rustore_url"].startswith("https://www.rustore.ru/")
