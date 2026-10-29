"""Курсы Bright: готовые интерактивные занятия по уровням и экзаменам.

Все объяснения, тексты и задания написаны для платформы (из учебников ничего не копируется).
Преподаватель берёт занятие себе, меняет под ученика и выдаёт как домашку; ученик может
пройти любое занятие сам и проверить себя.

Чтобы занятия было удобно писать и проверять, у них компактная запись:
* ``W`` – слова «слово – перевод» по строкам;
* ``M`` – пары «левое = правое» по строкам;
* ``G`` – текст с пропусками [ответ|вариант];
* ``C`` – тест: строка «Вопрос | вариант | *верный | вариант», вопросы через пустую строку не нужны;
* ``L`` – аудирование: текст озвучивает браузер, пропуски и вопросы как выше.
"""

from __future__ import annotations

from typing import Any


def T(title: str, body: str) -> dict[str, Any]:
    return {"type": "text", "title": title, "body": body.strip()}


def W(text: str, title: str = "Новые слова") -> dict[str, Any]:
    items = []
    for line in text.strip().splitlines():
        word, _, tr = line.partition(" – ")
        items.append({"word": word.strip(), "translation": tr.strip() or None})
    return {"type": "words", "title": title, "items": items}


def M(title: str, text: str) -> dict[str, Any]:
    pairs = [[a.strip(), b.strip()] for a, _, b in (line.partition(" = ") for line in text.strip().splitlines())]
    return {"type": "match", "title": title, "pairs": pairs}


def G(title: str, text: str, bank: bool = True) -> dict[str, Any]:
    return {"type": "gap", "title": title, "text": text.strip(), "bank": bank}


def _qs(spec: str) -> list[dict[str, Any]]:
    out = []
    for line in spec.strip().splitlines():
        q, *opts = [x.strip() for x in line.split(" | ")]
        answer = next(i for i, o in enumerate(opts) if o.startswith("*"))
        out.append({"q": q, "options": [o.lstrip("*") for o in opts], "answer": answer})
    return out


def C(title: str, spec: str) -> dict[str, Any]:
    return {"type": "choice", "title": title, "questions": _qs(spec)}


def L(title: str, lang: str, script: str, spec: str = "") -> dict[str, Any]:
    return {"type": "listening", "title": title, "lang": lang, "script": script.strip(), "questions": _qs(spec) if spec else []}


def WR(title: str, prompt: str) -> dict[str, Any]:
    return {"type": "write", "title": title, "prompt": prompt.strip()}


def unit(uid: str, title: str, language: str, level: str, tags: list[str], summary: str, *blocks: dict[str, Any]) -> dict[str, Any]:
    return {"id": uid, "title": title, "language": language, "level": level, "tags": tags, "summary": summary,
            "blocks": list(blocks)}


from .library_en import ENGLISH  # noqa: E402 – содержимое использует помощники выше
from .library_exams import EXAMS  # noqa: E402
from .library_world import WORLD  # noqa: E402

LIBRARY: list[dict[str, Any]] = [*ENGLISH, *EXAMS, *WORLD]


def library_unit(unit_id: str) -> dict[str, Any] | None:
    return next((u for u in LIBRARY if u["id"] == unit_id), None)
