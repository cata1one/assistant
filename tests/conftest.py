from __future__ import annotations

from pathlib import Path

import pytest

from tutor_assistant.config import Settings
from tutor_assistant.service import TutorAssistant
from tutor_assistant.storage import Storage

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture
def settings() -> Settings:
    return Settings(llm_mode="off", db_path=":memory:", timezone="Europe/Moscow")


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
