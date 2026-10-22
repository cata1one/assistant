"""Бесплатный ИИ (OpenAI-совместимый): конспект урока по расшифровке, в фоне для медленных моделей."""

import json

from tutor_assistant import ai as ai_module
from tutor_assistant.config import Settings
from tutor_assistant.llm import LLMClient, _lenient
from tutor_assistant.models import Role
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage

ANSWER = {
    "topic": "Комнаты в квартире", "summary": "Разобрали названия комнат и мебели.", "key_points": "kitchen\nsofa",
    "vocabulary": [{"word": "wardrobe", "translation": "шкаф"}, {"word": "sofa", "translation": "диван"}, {"x": 1}],
    "test": [{"kind": "weird", "question": "Как будет «шкаф»?", "options": ["wardrobe", "sofa"], "answer": "wardrobe"}],
    "homework_teacher": ["Упражнение 4"], "parent_summary": "Миша хорошо работал.", "homework_status": "maybe",
}


def make(monkeypatch, answer):
    s = Settings(llm_mode="off", stt_mode="off", db_path=":memory:", ai_url="http://127.0.0.1:11434/v1", ai_model="qwen")
    monkeypatch.setattr(ai_module.AIClient, "complete", lambda self, system, user, timeout=None: answer)
    return TutorAssistant(s, Storage(":memory:"))


def lesson(a):
    les = a.start_lesson(chat_id="c1", tutor_id="t", student_id="s")
    a.process_message(les["id"], "t", "Анна", "Новые слова: kitchen — кухня", role=Role.TUTOR)
    a.process_message(les["id"], "s", "Миша", "I have a big wardrobe", role=Role.STUDENT)
    return les["id"]


def test_lenient_fixes_free_model_output():
    data = _lenient(ANSWER)
    assert data["key_points"] == ["kitchen", "sofa"] and data["homework_status"] == "unknown"
    assert [v["word"] for v in data["vocabulary"]] == ["wardrobe", "sofa"] and data["test"][0]["kind"] == "choice"


def test_free_ai_builds_report(monkeypatch):
    a = make(monkeypatch, "Вот отчёт:\n" + json.dumps(ANSWER, ensure_ascii=False))
    assert a.llm.provider == "ai" and a.llm.slow
    report = a.finish_lesson(lesson(a))
    assert report.generated_by == "ai" and report.topic == "Комнаты в квартире"
    words = {v.word for v in report.vocabulary}
    assert {"kitchen", "wardrobe", "sofa"} <= words  # объявленное слово сохраняется, слова ИИ добавляются
    assert report.parent.summary == "Миша хорошо работал."


def test_free_ai_failure_falls_back_offline(monkeypatch):
    a = make(monkeypatch, None)
    report = a.finish_lesson(lesson(a))
    assert report.generated_by == "offline" and any("ИИ недоступен" in n for n in report.notes)


def test_background_improve_keeps_teacher_edits(monkeypatch):
    a = make(monkeypatch, json.dumps(ANSWER, ensure_ascii=False))
    lid = lesson(a)
    draft = a.finish_lesson(lid, use_llm=False, ai_pending=True)
    assert draft.generated_by == "pending"
    improved = a.improve_report(lid)
    assert improved.generated_by == "ai" and a.storage.get_report(lid).topic == "Комнаты в квартире"
    edited = a.storage.get_report(lid)
    edited.notes.append("отредактировано преподавателем")
    edited.topic = "Моя тема"
    a.storage.save_report(lid, edited)
    assert a.improve_report(lid) is None and a.storage.get_report(lid).topic == "Моя тема"


def test_no_ai_configured():
    llm = LLMClient(Settings(llm_mode="off", ai_url="", ai_model=""))
    assert llm.provider is None and not llm.available
