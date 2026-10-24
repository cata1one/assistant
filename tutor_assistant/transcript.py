"""Разбор расшифровки (транскрипта) или чата урока.

Поддерживаемые форматы строк::

    Учитель: Today we will learn ...
    Ученик: OK
    [00:12:33] Анна Петровна: ...
    10:05 - Иван (ученик): ...
    Teacher: ... / Student: ... / T: ... / S: ...

Строка без «Имя:» считается продолжением реплики предыдущего говорящего.
"""

from __future__ import annotations

import re
from collections.abc import Iterable

from .models import Role, Utterance

TUTOR_WORDS = ("учитель", "учительница", "преподаватель", "преподавательница", "репетитор", "педагог", "наставник",
               "teacher", "tutor", "instructor", "lehrer", "lehrerin", "professeur", "profesor", "profesora")
STUDENT_WORDS = ("ученик", "ученица", "студент", "студентка", "учащийся", "слушатель", "student", "pupil", "learner",
                 "schüler", "schülerin", "élève", "alumno", "alumna")
SHORT_TUTOR = {"t", "у", "п", "р", "уч", "teacher", "tutor"}
SHORT_STUDENT = {"s", "ст", "уч-к", "student"}

# Слова, после которых двоеточие не означает «говорящего».
NOT_SPEAKERS = {
    "homework", "дз", "д/з", "домашнее задание", "домашка", "задание", "тема", "тема урока", "правило", "rule", "rules",
    "example", "examples", "пример", "примеры", "note", "заметка", "новые слова", "новые слова сегодня", "words",
    "new words", "vocabulary", "словарик", "перевод", "translation", "ответ", "answer", "answers", "вопрос",
    "question", "упражнение", "exercise", "итог", "итоги", "важно", "запомните", "remember", "на дом", "слова",
    "ключевые слова", "key words", "lexis", "grammar", "грамматика", "correct", "правильно", "wrong", "ошибка",
    "task", "tasks", "topic", "summary", "конспект", "test", "тест", "p.s", "ps", "nb", "https", "http",
}

_LINE_RE = re.compile(
    r"^\s*(?:\[?(?P<ts>\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–—]?\s*)?"
    r"(?P<name>[^:\n\[\]]{1,40}?)\s*(?:\((?P<role>[^)\n]{1,25})\))?\s*:\s(?P<text>.*)$"
)
_TS_ONLY_RE = re.compile(r"^\s*\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*$")


def _role_from_label(label: str) -> Role:
    lab = label.strip().lower().replace("ё", "е").rstrip(".")
    if lab in SHORT_TUTOR:
        return Role.TUTOR
    if lab in SHORT_STUDENT:
        return Role.STUDENT
    if any(w in lab for w in TUTOR_WORDS):
        return Role.TUTOR
    if any(w in lab for w in STUDENT_WORDS):
        return Role.STUDENT
    return Role.UNKNOWN


def _looks_like_name(name: str) -> bool:
    words = name.split()
    if not 1 <= len(words) <= 3:
        return False
    if any(not re.fullmatch(r"[^\W\d_][\w.'\-]*", w) for w in words):
        return False
    # Имена пишутся с заглавной: «Анна Петровна», «Ivan».
    return all(w[0].isupper() for w in words)


def parse_transcript(
    text: str,
    tutor_names: Iterable[str] = (),
    student_names: Iterable[str] = (),
) -> list[Utterance]:
    tutor_set = {n.strip().lower() for n in tutor_names if n.strip()}
    student_set = {n.strip().lower() for n in student_names if n.strip()}
    utterances: list[Utterance] = []
    known_speakers: dict[str, Role] = {}

    for raw_line in (text or "").replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = raw_line.rstrip()
        if not line.strip() or _TS_ONLY_RE.match(line):
            if utterances and utterances[-1].text and not utterances[-1].text.endswith("\n"):
                utterances[-1].text += "\n"
            continue
        m = _LINE_RE.match(line)
        speaker = None
        if m:
            name = m.group("name").strip()
            label = m.group("role") or ""
            low = name.lower().replace("ё", "е")
            if low not in NOT_SPEAKERS and not low.startswith(("новые слова", "new words", "домашн")):
                role = _role_from_label(label) if label else _role_from_label(name)
                if low in tutor_set:
                    role = Role.TUTOR
                elif low in student_set:
                    role = Role.STUDENT
                if role != Role.UNKNOWN or low in known_speakers or _looks_like_name(name) or label:
                    speaker = (name, role)
        if speaker:
            name, role = speaker
            low = name.lower()
            if role == Role.UNKNOWN:
                role = known_speakers.get(low, Role.UNKNOWN)
            known_speakers[low] = role
            utterances.append(Utterance(name, role, m.group("text").strip(), m.group("ts")))
        elif utterances:
            sep = "" if utterances[-1].text.endswith("\n") or not utterances[-1].text else "\n"
            utterances[-1].text += sep + line.strip()
        else:
            utterances.append(Utterance("—", Role.UNKNOWN, line.strip()))

    for u in utterances:
        u.text = u.text.strip()
    utterances = [u for u in utterances if u.text]
    _infer_unknown_roles(utterances)
    return utterances


def _infer_unknown_roles(utterances: list[Utterance]) -> None:
    """Если роли не подписаны: тот, кто говорит больше, – преподаватель."""
    unknown = {u.speaker for u in utterances if u.role == Role.UNKNOWN and u.speaker != "—"}
    if not unknown:
        return
    has_tutor = any(u.role == Role.TUTOR for u in utterances)
    volume: dict[str, int] = {}
    for u in utterances:
        if u.speaker in unknown:
            volume[u.speaker] = volume.get(u.speaker, 0) + len(u.text.split())
    ranked = sorted(volume, key=lambda s: -volume[s])
    mapping = {sp: Role.TUTOR if (not has_tutor and i == 0) else Role.STUDENT for i, sp in enumerate(ranked)}
    for u in utterances:
        if u.speaker in mapping:
            u.role = mapping[u.speaker]


def utterances_to_text(utterances: Iterable[Utterance]) -> str:
    names = {Role.TUTOR: "Преподаватель", Role.STUDENT: "Ученик", Role.UNKNOWN: "Участник"}
    lines = []
    for u in utterances:
        who = f"{u.speaker} ({names[u.role].lower()})" if u.speaker not in ("—", "") else names[u.role]
        lines.append(f"{who}: {u.text}")
    return "\n".join(lines)
