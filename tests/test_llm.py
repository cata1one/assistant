"""Интеграция с Claude — на подменённом клиенте, без сетевых запросов."""

import types

import anthropic
import httpx2
import pytest

from tutor_assistant.config import Settings
from tutor_assistant.llm import (
    FALLBACK_BETA,
    LLMClient,
    LLMLessonReport,
    LLMQuestion,
    LLMRule,
    LLMVocab,
)
from tutor_assistant.report import build_report
from tutor_assistant.transcript import parse_transcript

TRANSCRIPT = ("Учитель: Новые слова сегодня: cat — кошка\n"
              "Учитель: ДЗ: выучить слова\n"
              "Ученик: мой номер [скрыто]\n")


def llm_report(**over):
    data = dict(
        topic="Животные", summary="Сегодня изучали животных.", key_points=["cat — кошка"],
        rules=[LLMRule(title="Артикль a", explanation="Перед согласной — a", examples=["a cat"])],
        vocabulary=[LLMVocab(word="cat", translation="кот", transcription="[kæt]", part_of_speech="noun",
                             example="A cat sleeps."),
                    LLMVocab(word="kitten", translation="котёнок", transcription=None, part_of_speech="noun",
                             example=None),
                    LLMVocab(word="dog", translation="собака", transcription=None, part_of_speech=None, example=None)],
        corrections=[],
        test=[LLMQuestion(kind="choice", question="cat — это…", options=["кошка", "собака"], answer="кошка",
                          explanation=None)],
        homework_teacher=["Выучить слова"], homework_generated=["Напишите 3 предложения про кошек"],
        review_items=["Артикль a перед согласной"], parent_summary="Миша выучил названия животных.",
        parent_achievements=["Уверенно называет животных"], parent_attention=["Путает a и an"],
        parent_teacher_remarks=["Молодец на уроке"], homework_status="unknown",
        parent_recommendations=["Повторяйте слова 5 минут в день"],
    )
    data.update(over)
    return LLMLessonReport(**data)


class FakeStream:
    def __init__(self, message):
        self.message = message

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def get_final_message(self):
        return self.message


class FakeClient:
    """Имитирует client.beta.messages.stream(...)."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []
        self.beta = types.SimpleNamespace(messages=types.SimpleNamespace(stream=self._stream))

    def _stream(self, **kwargs):
        self.calls.append(kwargs)
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return FakeStream(item)


def message(parsed=None, stop_reason="end_turn"):
    return types.SimpleNamespace(parsed_output=parsed, stop_reason=stop_reason)


def make_llm(responses, **settings):
    llm = LLMClient(Settings(llm_mode="off", **settings))
    llm._client = FakeClient(responses)
    return llm


def bad_request():
    req = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    return anthropic.BadRequestError("fallbacks not supported", response=httpx2.Response(400, request=req), body=None)


def test_request_shape_and_merge():
    llm = make_llm([message(llm_report())])
    utt = parse_transcript(TRANSCRIPT)
    report = build_report(utt, llm.settings, llm=llm, known_words=["dog"])
    call = llm._client.calls[0]
    assert call["model"] == "claude-opus-5-5"
    assert call["output_format"] is LLMLessonReport
    assert call["output_config"] == {"effort": "medium"}
    assert call["betas"] == [FALLBACK_BETA] and call["fallbacks"] == "default"
    assert "<transcript>" in call["messages"][0]["content"] and "cat — кошка" in call["messages"][0]["content"]

    assert report.generated_by == "claude"
    words = {v.word: v for v in report.vocabulary}
    # Слово учителя сохраняется с переводом учителя, Claude только дополняет поля
    assert words["cat"].translation == "кошка" and words["cat"].transcription == "[kæt]"
    assert "kitten" in words
    assert "dog" not in words  # уже изучено ранее
    assert [h.text for h in report.homework_teacher] == ["Выучить слова."]  # ДЗ учителя важнее
    assert report.homework_generated[0].text.startswith("Напишите")
    assert report.test[0].answer == "кошка"


def test_retry_without_fallbacks_on_bad_request():
    llm = make_llm([bad_request(), message(llm_report())])
    result = llm.generate_lesson_report("T", [], [], [])
    assert result is not None
    assert "fallbacks" in llm._client.calls[0] and "fallbacks" not in llm._client.calls[1]


def test_fallbacks_can_be_disabled():
    llm = make_llm([message(llm_report())], llm_fallbacks=False)
    llm.generate_lesson_report("T", [], [], [])
    assert "fallbacks" not in llm._client.calls[0] and "betas" not in llm._client.calls[0]


@pytest.mark.parametrize("resp, err", [
    (message(None, stop_reason="refusal"), "отклонила"),
    (message(None, stop_reason="max_tokens"), "обрезан"),
    (message(None), "формате"),
    (anthropic.APIConnectionError(request=httpx2.Request("POST", "https://x")), "соединения"),
])
def test_failures_fall_back_to_offline(resp, err):
    llm = make_llm([resp, resp], llm_fallbacks=False)
    report = build_report(parse_transcript(TRANSCRIPT), llm.settings, llm=llm)
    assert report.generated_by == "offline"
    assert report.vocabulary[0].word == "cat" and report.test is not None
    assert any(err in n for n in report.notes)


def test_unavailable_without_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    assert not LLMClient(Settings(llm_mode="auto")).available
    assert not LLMClient(Settings(llm_mode="off")).available
    assert Settings(llm_mode="auto").llm_enabled is False
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    assert Settings(llm_mode="auto").llm_enabled is True
