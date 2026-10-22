"""Домашнее задание: озвученное преподавателем и сгенерированное по материалу урока."""

from __future__ import annotations

import re
from collections.abc import Iterable

from .models import HomeworkTask, Rule, Utterance, VocabItem
from .summary import plural

LANGUAGE_NAMES = {
    "en": "английский", "de": "немецкий", "fr": "французский", "es": "испанский", "it": "итальянский",
    "pt": "португальский", "zh": "китайский", "ja": "японский", "ko": "корейский", "tr": "турецкий",
    "ar": "арабский", "sr": "сербский", "hi": "хинди", "el": "греческий",
}
LANGUAGE_NAMES_GEN = {
    "en": "английском", "de": "немецком", "fr": "французском", "es": "испанском", "it": "итальянском",
    "pt": "португальском", "zh": "китайском", "ja": "японском", "ko": "корейском", "tr": "турецком",
    "ar": "арабском", "sr": "сербском", "hi": "хинди", "el": "греческом",
}

HOMEWORK_TRIGGER_RE = re.compile(
    r"(?:домашн\w*\s+задани\w*|домашк\w*|домашнее|(?<![\w])дз(?![\w])|(?<![\w])д/з(?![\w])|задани\w*\s+на\s+дом"
    r"|(?<![\w])на\s+дом(?![\w])|к\s+следующему\s+(?:уроку|занятию|разу)|до\s+следующего\s+(?:урока|занятия)"
    r"|homework|home\s*task|for\s+next\s+(?:time|lesson|class)|by\s+next\s+(?:time|lesson|class))",
    re.IGNORECASE,
)
_ITEM_SPLIT_RE = re.compile(r"(?:^|\s|\n)(?:\d{1,2}\s*[.)]|[-•*])\s+")
_QUESTION_RE = re.compile(r"(?:какое|какая|что|а)\s+(?:у\s+нас\s+)?(?:будет\s+)?(?:домашн\w*|дз|задали|на\s+дом)|\?\s*$",
                          re.IGNORECASE)


_ASSIGN_RE = re.compile(
    r"(?<![\w])(?:(?:выучи|сделай|напиши|прочитай|прочти|выполни|повтори|подготовь|перескажи|переведи|послушай"
    r"|посмотри|ответь|составь|запиши|реши|найди|заполни|придумай|расскажи)(?:те)?"
    r"|выучить|сделать|написать|прочитать|выполнить|повторить|подготовить|пересказать|перевести|послушать"
    r"|посмотреть|ответить|составить|записать|решить|заполнить|придумать|рассказать"
    r"|learn|do|write|read|prepare|translate|watch|listen|finish|complete|revise|practi[cs]e)(?![\w])",
    re.IGNORECASE,
)
_CHECK_RE = re.compile(
    r"(?<![\w])(?:провер\w*|не\s+(?:сделал\w*|выполнил\w*|сделан\w*|выполнен\w*)|сделал\w*|выполнил\w*|как\s+(?:там|у\s+тебя|у\s+вас)"
    r"|did\s+you|have\s+you\s+done|check)(?![\w])",
    re.IGNORECASE,
)


def _split_tasks(text: str) -> list[str]:
    text = text.strip().strip(":—–- ")
    if not text:
        return []
    if _ITEM_SPLIT_RE.search("\n" + text):
        parts = [p.strip(" ;\n") for p in _ITEM_SPLIT_RE.split("\n" + text) if p.strip(" ;\n")]
    else:
        parts = [p.strip() for p in re.split(r"\s*;\s*|\n+", text) if p.strip()]
    parts = [p[:1].upper() + p[1:] for p in parts]
    return [p.rstrip(".") + "." if not p.endswith((".", "!", "?")) else p for p in parts]


def extract_from_message(text: str) -> tuple[list[str], bool]:
    """ДЗ из одной реплики преподавателя.

    Возвращает (задания, ожидать_продолжение). «Домашнее задание:» без текста —
    задания придут следующими репликами.
    """
    m = HOMEWORK_TRIGGER_RE.search(text or "")
    if not m:
        return [], False
    if _QUESTION_RE.search(text) and len(text.split()) <= 8:
        return [], False  # это вопрос «какое дз?», а не задание
    after = text[m.end():]
    colon = re.match(r"\s*(?:будет|такое|на\s+сегодня|на\s+завтра)?\s*[:\-—–]\s*", after)
    if colon:
        body = after[colon.end():]
        tasks = _split_tasks(body)
        return tasks, not tasks
    # Без двоеточия берём предложение целиком: «К следующему уроку выучите слова и сделайте упр. 5».
    start = max(text.rfind(".", 0, m.start()), text.rfind("!", 0, m.start()), text.rfind("\n", 0, m.start())) + 1
    end_match = re.search(r"[.!?\n](?:\s|$)", text[m.end():])
    end = m.end() + end_match.start() + 1 if end_match else len(text)
    sentence = text[start:end].strip()
    if len(sentence.split()) < 3:
        return [], True
    # В устной речи «домашнее задание» звучит и при проверке старого: «проверим домашнее задание»,
    # «ты не сделал дз». Заданием считаем только фразу с поручением.
    if _CHECK_RE.search(sentence) or not _ASSIGN_RE.search(sentence):
        return [], False
    return _split_tasks(sentence), False


def _is_task_line(text: str) -> bool:
    t = text.strip()
    return bool(t) and len(t) <= 400 and bool(re.match(r"^(?:\d{1,2}\s*[.)]|[-•*])\s+", t) or
                                              re.match(r"^(?:выучи|выполни|сделай|прочитай|напиши|перескажи|повтори"
                                                       r"|переведи|послушай|посмотри|ответь|составь|подготовь|learn"
                                                       r"|read|write|do|watch|listen|prepare|translate)", t, re.IGNORECASE))


class HomeworkCollector:
    def __init__(self) -> None:
        self.tasks: list[HomeworkTask] = []
        self._awaiting = False

    def feed_tutor_message(self, text: str) -> list[HomeworkTask]:
        tasks, awaiting = extract_from_message(text)
        added: list[HomeworkTask] = []
        if tasks or awaiting:
            self._awaiting = awaiting
            for t in tasks:
                added += self._add(t)
        elif self._awaiting and _is_task_line(text):
            for t in _split_tasks(text):
                added += self._add(t)
        else:
            self._awaiting = False
        return added

    def _add(self, text: str) -> list[HomeworkTask]:
        norm = text.lower().strip(" .")
        if not norm or any(t.text.lower().strip(" .") == norm for t in self.tasks):
            return []
        task = HomeworkTask(text=text, source="teacher")
        self.tasks.append(task)
        return [task]


def extract_assigned(utterances: Iterable[Utterance]) -> list[HomeworkTask]:
    collector = HomeworkCollector()
    for u in utterances:
        if u.is_tutor:
            collector.feed_tutor_message(u.text)
    return collector.tasks


def generate_homework(
    vocabulary: list[VocabItem],
    rules: list[Rule],
    topic: str | None,
    target_language: str = "en",
    has_teacher_homework: bool = False,
) -> list[HomeworkTask]:
    """Офлайн-генерация ДЗ по материалу урока (без LLM)."""
    lang_gen = LANGUAGE_NAMES_GEN.get(target_language, "изучаемом языке")
    tasks: list[str] = []
    words = [v.word for v in vocabulary]
    translated = [v for v in vocabulary if v.translation]

    if words:
        tasks.append(f"Выучите новые слова урока ({len(words)}): {', '.join(words)}. "
                     "Проговорите каждое вслух 3 раза и запишите в словарь с переводом.")
    if translated:
        sample = translated[:10]
        tasks.append("Переведите на " + LANGUAGE_NAMES.get(target_language, "изучаемый язык") + ": " + "; ".join(v.translation or "" for v in sample) + ".")
    if words:
        tasks.append(f"Составьте по одному предложению на {lang_gen} с каждым из слов: {', '.join(words[:8])}.")
    for rule in rules[:2]:
        tasks.append(f"Повторите правило «{rule.title}» и напишите 5 собственных примеров.")
    if topic:
        theme = f"на тему: {topic}" if "«" in topic else f"на тему «{topic}»"
    else:
        theme = "по теме урока"
    tasks.append(f"Напишите короткий текст (6–8 предложений) на {lang_gen} {theme}, "
                 f"используя минимум {plural(min(5, len(words)) or 5, 'новое слово', 'новых слова', 'новых слов')}"
                 " и изученную грамматику.")
    if not has_teacher_homework:
        tasks.append("Пройдите тест по уроку и проверьте себя по ключу ответов.")
    return [HomeworkTask(text=t, source="generated") for t in tasks]
