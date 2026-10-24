"""Тест для самопроверки дома (офлайн-генерация по словам урока)."""

from __future__ import annotations

import random
import re

from .homework import LANGUAGE_NAMES_GEN
from .models import TestQuestion, VocabItem

LETTERS = "АБВГДЕ"


def _blank(example: str, word: str) -> str | None:
    rx = re.compile(r"(?<![\w])" + re.escape(word) + r"(?P<suf>s|es|ed|ing|d)?(?![\w])", re.IGNORECASE)
    m = rx.search(example)
    if not m:
        return None
    return example[: m.start()] + "_____" + example[m.end():]


def generate_test(vocabulary: list[VocabItem], seed: str | int = 0, max_questions: int = 10,
                  target_language: str = "en") -> list[TestQuestion]:
    lang = LANGUAGE_NAMES_GEN.get(target_language, "изучаемом языке")
    rng = random.Random(str(seed))
    items = [v for v in vocabulary if v.word]
    translated = [v for v in items if v.translation]
    questions: list[TestQuestion] = []

    # 1) Выбор перевода (иностранное → родной язык)
    if len(translated) >= 2:
        pool = translated[:]
        rng.shuffle(pool)
        for v in pool[: max(1, max_questions // 2)]:
            distractors = [x.translation for x in translated if x.key != v.key and x.translation != v.translation]
            rng.shuffle(distractors)
            options = [v.translation] + distractors[:3]
            rng.shuffle(options)
            questions.append(TestQuestion(kind="choice", question=f"Выберите перевод слова «{v.word}»",
                                          options=[o for o in options if o], answer=v.translation or ""))

    # 2) Обратный перевод (родной → иностранный), открытый ответ
    if translated:
        pool = translated[:]
        rng.shuffle(pool)
        for v in pool[: max(1, max_questions // 4)]:
            questions.append(TestQuestion(kind="open", question=f"Как будет «{v.translation}» на {lang}?",
                                          answer=v.word))

    # 3) Пропуск в предложении из урока
    gap_items = [v for v in items if v.example and _blank(v.example, v.key)]
    rng.shuffle(gap_items)
    for v in gap_items[: max(1, max_questions // 4)]:
        others = [x.word for x in items if x.key != v.key]
        rng.shuffle(others)
        options = [v.word] + others[:2]
        rng.shuffle(options)
        questions.append(TestQuestion(kind="gap", question=f"Вставьте пропущенное слово: {_blank(v.example or '', v.key)}",
                                      options=options if len(options) > 1 else [], answer=v.word))

    # 4) Без переводов – хотя бы задания «переведите слово»
    if not translated:
        for v in items[:max_questions]:
            questions.append(TestQuestion(kind="open", question=f"Переведите слово «{v.word}» и составьте с ним предложение",
                                          answer="(проверяет преподаватель)"))

    # убираем дубли вопросов, сохраняя порядок
    seen, unique = set(), []
    for q in questions:
        if q.question not in seen:
            seen.add(q.question)
            unique.append(q)
    return unique[:max_questions]
