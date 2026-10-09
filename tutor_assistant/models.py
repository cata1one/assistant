"""Модели данных урока и отчёта."""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum

from pydantic import BaseModel, Field


class Role(str, Enum):
    TUTOR = "tutor"
    STUDENT = "student"
    UNKNOWN = "unknown"

    @classmethod
    def parse(cls, value: str | Role | None) -> Role:
        if isinstance(value, Role):
            return value
        v = (value or "").strip().lower()
        if v in {"tutor", "teacher", "учитель", "репетитор", "преподаватель", "t"}:
            return cls.TUTOR
        if v in {"student", "pupil", "ученик", "ученица", "студент", "s"}:
            return cls.STUDENT
        return cls.UNKNOWN


@dataclass
class Utterance:
    speaker: str
    role: Role
    text: str
    timestamp: str | None = None  # «00:12:33» или ISO-время

    @property
    def is_tutor(self) -> bool:
        return self.role in (Role.TUTOR, Role.UNKNOWN)


def word_key(word: str) -> str:
    """Ключ для сравнения слов: регистр, артикли, частица to, лишние пробелы."""
    w = re.sub(r"\s+", " ", (word or "").strip().lower().replace("ё", "е"))
    w = w.strip(" .,;:!?\"'«»()[]")
    w = re.sub(r"^(?:to|a|an|the|der|die|das|le|la|les|l'|el|los|las|il|lo|gli|un|une|ein|eine)\s+", "", w)
    return w


class VocabItem(BaseModel):
    word: str
    translation: str | None = None
    transcription: str | None = None
    part_of_speech: str | None = None
    example: str | None = None
    source: str = "auto"  # teacher_list | pair | auto | llm

    @property
    def key(self) -> str:
        return word_key(self.word)


class Rule(BaseModel):
    title: str
    explanation: str
    examples: list[str] = Field(default_factory=list)


class Correction(BaseModel):
    wrong: str
    correct: str
    note: str | None = None


class TestQuestion(BaseModel):
    kind: str = "choice"  # choice | open | gap | true_false | match
    question: str
    options: list[str] = Field(default_factory=list)
    answer: str
    explanation: str | None = None


class HomeworkTask(BaseModel):
    text: str
    source: str = "generated"  # teacher | generated


class LessonStats(BaseModel):
    messages: int = 0
    tutor_messages: int = 0
    student_messages: int = 0
    tutor_words: int = 0
    student_words: int = 0
    student_talk_share: float = 0.0  # доля речи ученика, %
    duration_minutes: int | None = None
    violations: int = 0


class LessonReport(BaseModel):
    lesson_id: str | None = None
    title: str | None = None
    date: str
    target_language: str = "en"
    topic: str | None = None
    summary: str = ""
    key_points: list[str] = Field(default_factory=list)
    rules: list[Rule] = Field(default_factory=list)
    vocabulary: list[VocabItem] = Field(default_factory=list)
    extra_words: list[VocabItem] = Field(default_factory=list)  # звучали на уроке, но не объявлены как новые
    corrections: list[Correction] = Field(default_factory=list)
    test: list[TestQuestion] = Field(default_factory=list)
    homework_teacher: list[HomeworkTask] = Field(default_factory=list)
    homework_generated: list[HomeworkTask] = Field(default_factory=list)
    stats: LessonStats = Field(default_factory=LessonStats)
    generated_by: str = "offline"  # offline | claude
    notes: list[str] = Field(default_factory=list)

    @property
    def homework(self) -> list[HomeworkTask]:
        return self.homework_teacher + self.homework_generated
