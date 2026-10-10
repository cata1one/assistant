from __future__ import annotations

import io
from pathlib import Path

import pytest

from tutor_assistant.config import Settings
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture
def settings() -> Settings:
    return Settings(llm_mode="off", stt_mode="off", db_path=":memory:", timezone="Europe/Moscow")


@pytest.fixture
def storage() -> Storage:
    s = Storage(":memory:")
    yield s
    s.close()


@pytest.fixture
def assistant(settings: Settings, storage: Storage) -> TutorAssistant:
    return TutorAssistant(settings, storage)


@pytest.fixture
def sample_lesson() -> str:
    return (ROOT / "examples" / "sample_lesson.txt").read_text(encoding="utf-8")


class FakeTranscriber:
    """Подмена распознавания речи: «аудио» — это текст в UTF-8, сегменты разделены «|»."""

    last_error = None

    def __init__(self, available: bool = True):
        self._available = available
        self.calls = 0

    @property
    def available(self) -> bool:
        return self._available

    def transcribe(self, audio, language=None):
        from tutor_assistant.speech import Segment, Transcription

        self.calls += 1
        if isinstance(audio, (bytes, bytearray)):
            data = bytes(audio)
        elif isinstance(audio, (str, Path)):
            data = Path(audio).read_bytes()
        else:
            data = audio.read()
        text = data.decode("utf-8")
        if text.startswith("FAIL"):
            raise RuntimeError("битый файл")
        parts = [p.strip() for p in text.split("|") if p.strip()]
        segments = [Segment(i * 10.0, i * 10.0 + 9.0, p) for i, p in enumerate(parts)]
        return Transcription(" ".join(parts), segments, "ru", len(parts) * 10.0)


@pytest.fixture
def fake_stt() -> FakeTranscriber:
    return FakeTranscriber()


@pytest.fixture
def speech_assistant(settings: Settings, storage: Storage, fake_stt: FakeTranscriber) -> TutorAssistant:
    return TutorAssistant(settings, storage, transcriber=fake_stt)


def as_file(text: str) -> io.BytesIO:
    return io.BytesIO(text.encode("utf-8"))
