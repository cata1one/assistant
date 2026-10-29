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
from .library_more import MORE  # noqa: E402

LIBRARY: list[dict[str, Any]] = [*ENGLISH, *EXAMS, *WORLD, *MORE]

# Учебники Bright: уроки, собранные по порядку в курс. cover – эмодзи для объёмной обложки (Fluent 3D).
BOOKS: list[dict[str, Any]] = [
    {"id": "en-a1", "title": "English A1. Старт", "language": "en", "level": "A1", "cover": "🌱", "color": "#DFF5E6",
     "about": "Первый учебник английского: о себе, семья, дом, время, умения и еда.",
     "units": ["lib-en-a1-to-be", "lib-en-a1-numbers-time", "lib-en-a1-family", "lib-en-a1-present-simple",
               "lib-en-a1-there-is", "lib-en-a1-place", "lib-en-a1-can", "lib-en-a1-food"]},
    {"id": "en-a2", "title": "English A2. Шаг вперёд", "language": "en", "level": "A2", "cover": "🚲", "color": "#E2E9FD",
     "about": "Прошлое, планы, сравнения, опыт и путешествия.",
     "units": ["lib-en-a2-past-simple", "lib-en-a2-past-continuous", "lib-en-a2-comparatives", "lib-en-a2-future",
               "lib-en-a2-continuous", "lib-en-a2-experience", "lib-en-a2-travel"]},
    {"id": "en-b1", "title": "English B1. Свободнее", "language": "en", "level": "B1", "cover": "🗺️", "color": "#FFF4C7",
     "about": "Времена в связке, условия, модальные глаголы, фразовые глаголы и разговор.",
     "units": ["lib-en-b1-present-perfect", "lib-en-b1-conditionals", "lib-en-b1-modals", "lib-en-b1-phrasal",
               "lib-en-b1-passive", "lib-en-b1-small-talk"]},
    {"id": "en-b2", "title": "English B2. Уверенно", "language": "en", "level": "B2", "cover": "🏔️", "color": "#EEEBFB",
     "about": "Сложные условные, косвенная речь, предположения, gerund и infinitive, связки и коллокации.",
     "units": ["lib-en-b2-third-conditional", "lib-en-b2-reported", "lib-en-b2-deduction", "lib-en-b2-gerund",
               "lib-en-b2-linkers", "lib-en-b2-make-do"]},
    {"id": "ielts", "title": "IELTS: все части экзамена", "language": "en", "level": "B1–B2", "cover": "🎓", "color": "#FCE6DE",
     "about": "Speaking, Writing Task 1 и 2, Listening и Reading: стратегии и тренировка.",
     "units": ["lib-ielts-speaking-hometown", "lib-ielts-speaking-part2", "lib-ielts-writing-trends",
               "lib-ielts-writing-task2", "lib-ielts-listening-form", "lib-ielts-reading-tfng"]},
    {"id": "ege-oge", "title": "ОГЭ и ЕГЭ по английскому", "language": "en", "level": "A2–B2", "cover": "📝", "color": "#E3F4EA",
     "about": "Грамматика и словообразование, электронное письмо и эссе.",
     "units": ["lib-oge-grammar-forms", "lib-oge-word-formation", "lib-ege-email", "lib-ege-essay"]},
    {"id": "hsk", "title": "Китайский: HSK 1–2", "language": "zh", "level": "HSK 1–2", "cover": "🐼", "color": "#FCE6DE",
     "about": "Тоны, приветствия, числа, время, семья, покупки, счётные слова, 了 и 过, сравнение с 比.",
     "units": ["lib-hsk1-greetings", "lib-hsk1-numbers", "lib-hsk1-family", "lib-hsk1-time", "lib-hsk1-shopping",
               "lib-zh-measure-words", "lib-hsk2-le-guo", "lib-hsk2-bi"]},
    {"id": "es-a1", "title": "Español A1", "language": "es", "level": "A1", "cover": "💃", "color": "#FFF4C7",
     "about": "Ser и estar, настоящее время, числа и время, gustar и планы.",
     "units": ["lib-es-ser-estar", "lib-es-presente", "lib-es-a1-numbers", "lib-es-a1-gustar", "lib-es-a1-ir-a"]},
    {"id": "fr-a1", "title": "Français A1–A2", "language": "fr", "level": "A1–A2", "cover": "🥐", "color": "#E2E9FD",
     "about": "Être и avoir, глаголы на -er, ближайшее будущее и passé composé.",
     "units": ["lib-fr-etre-avoir", "lib-fr-a1-er", "lib-fr-a2-futur-proche", "lib-fr-passe-compose"]},
    {"id": "it-pt", "title": "Italiano e Português A1", "language": "it", "level": "A1", "cover": "🍕", "color": "#E3F4EA",
     "about": "Знакомство и настоящее время в итальянском и португальском.",
     "units": ["lib-it-a1-intro", "lib-it-a1-presente", "lib-pt-a1-intro", "lib-pt-a1-presente"]},
    {"id": "first-words", "title": "Первые слова: арабский, греческий, сербский, хинди", "language": "ar", "level": "A0",
     "cover": "🌍", "color": "#EEEBFB", "about": "Приветствия и первые фразы на четырёх языках.",
     "units": ["lib-ar-first", "lib-el-first", "lib-sr-first", "lib-hi-first"]},
]


def library_unit(unit_id: str) -> dict[str, Any] | None:
    return next((u for u in LIBRARY if u["id"] == unit_id), None)
