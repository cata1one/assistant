"""Отчёт для родителей и список «что повторить» — по расшифровке урока (в том числе речи).

Что извлекается из речи преподавателя:

* похвала («молодец», «отлично получается…», *well done*) → успехи;
* замечания («путаешь…», «тебе нужно подтянуть…», «отвлекаешься») → на что обратить внимание;
* выполнено ли прошлое домашнее задание («дз не сделано», «домашку сделал отлично»);
* явные заметки преподавателя для родителей: «Родителям: …», «Для родителей: …»
  (в анонимном режиме такая реплика ученику не пересылается) и команда /note.

Плюс динамика по сравнению с прошлым уроком: ошибки, активность, размер словаря.
"""

from __future__ import annotations

import re
from collections.abc import Iterable

from .homework import HOMEWORK_TRIGGER_RE, LANGUAGE_NAMES_GEN
from .models import LessonReport, ParentReport, Progress, Role, Utterance, word_key
from .summary import plural

PARENT_NOTE_RE = re.compile(
    r"^\s*(?:для\s+родителей|родителям|замечани[ея]\s+(?:для\s+)?родител\w*|заметка\s+(?:для\s+)?родител\w*"
    r"|note\s+for\s+(?:the\s+)?parents?)\s*[:\-—–]\s*(?P<text>\S.*)$",
    re.IGNORECASE | re.DOTALL,
)

PRAISE_RE = re.compile(
    r"(?<![\w])(?:молод(?:ец|цы|чина)|умни(?:ца|чка)|отлично|прекрасно|замечательно|великолепно|превосходно|супер"
    r"|здорово|блестяще|так\s+держать|хорошая\s+работа|отличная\s+работа|good\s+job|well\s+done|great\s+job"
    r"|excellent|(?<!present\s)(?<!past\s)(?<!future\s)perfect(?!\s+(?:simple|continuous|progressive|tense|form))"
    r"|brilliant|awesome|nice\s+work|good\s+work|fantastic|wonderful)(?![\w])",
    re.IGNORECASE,
)
ATTENTION_RE = re.compile(
    r"(?<![\w])(?:путаешь|путаете|путает|забываешь|забываете|забывает|отвлекаешься|отвлекаетесь|отвлекается"
    r"|невнимательн\w*|тебе\s+(?:нужно|надо|стоит)|вам\s+(?:нужно|надо|стоит)|нужно\s+(?:подтянуть|поработать|потренировать)"
    r"|надо\s+(?:подтянуть|поработать|потренировать)|слаб(?:ое|ая)\s+(?:место|сторона)|(?:сложно|трудно)\s+(?:да[её]тся|дались)"
    r"|трудности\s+с|опоздал\w*|не\s+готов\w*|часто\s+ошиба\w*|ошибаешься|ошибаетесь|не\s+выучил\w*"
    r"|(?:you|we)\s+need\s+to\s+(?:practi[cs]e|review|work\s+on)|be\s+careful|pay\s+attention)(?![\w])",
    re.IGNORECASE,
)
PARENT_MENTION_RE = re.compile(r"(?<![\w])(?:родител\w*|передай(?:те)?\s+(?:маме|папе))(?![\w])", re.IGNORECASE)

_HW = r"(?:домашн\w*(?:\s+задани\w*)?|домашк\w*|дз|д/з|homework)"
HOMEWORK_STATUS_RES = [
    ("partial", re.compile(rf"{_HW}\s+(?:\w+\s+){{0,3}}(?:частично|не\s+до\s+конца|наполовину)"
                           rf"|(?:частично|не\s+до\s+конца|наполовину|не\s+вс[её])\s+(?:\w+\s+){{0,2}}(?:сделал\w*|выполнил\w*|сделано|выполнено)",
                           re.IGNORECASE)),
    ("not_done", re.compile(rf"(?:не\s+(?:сделал\w*|выполнил\w*|подготовил\w*|сделано|выполнено|сделана))\s+(?:\w+\s+){{0,2}}{_HW}"
                            rf"|{_HW}\s+(?:\w+\s+){{0,2}}не\s+(?:сделан\w*|выполнен\w*|готов\w*|сделал\w*|выполнил\w*)"
                            rf"|забыл\w*\s+(?:про\s+|о\s+)?{_HW}|(?:didn'?t|did\s+not)\s+do\s+(?:your\s+|the\s+)?homework",
                            re.IGNORECASE)),
    ("done", re.compile(rf"{_HW}\s+(?:\w+\s+){{0,3}}(?:выполнен\w*|сделан\w*|отлично|хорошо|молодец|без\s+ошибок|проверил\w*)"
                        rf"|(?:сделал\w*|выполнил\w*)\s+(?:\w+\s+){{0,2}}{_HW}|(?:did|done)\s+(?:your\s+|the\s+)?homework",
                        re.IGNORECASE)),
]


def parent_note(text: str) -> str | None:
    """«Родителям: Миша стал увереннее» → «Миша стал увереннее» (заметка не для ученика)."""
    m = PARENT_NOTE_RE.match(text or "")
    return m.group("text").strip() if m else None


def _sentences(text: str) -> list[str]:
    return [s.strip(" -—–") for s in re.split(r"(?<=[.!?])\s+|\n+", text) if s.strip(" -—–")]


def _quote(s: str, limit: int = 160) -> str:
    s = s.strip().rstrip(".")
    if len(s) > limit:
        s = s[: limit - 1].rsplit(" ", 1)[0] + "…"
    return f"«{s}»"


def homework_status(utterances: Iterable[Utterance]) -> str:
    """Как выполнено прошлое ДЗ — по словам преподавателя. Новое задание («ДЗ: …») не учитывается."""
    for u in utterances:
        if not u.is_tutor:
            continue
        for sent in _sentences(u.text):
            if re.search(r"(?:дз|домашн\w*\s+задани\w*|homework)\s*[:\-—–]\s*\S", sent, re.IGNORECASE):
                continue  # это выдача нового задания
            for status, rx in HOMEWORK_STATUS_RES:
                if rx.search(sent):
                    return status
    return "unknown"


def collect_signals(utterances: list[Utterance]) -> dict:
    praise_count = 0
    praise_quotes: list[str] = []
    attention: list[str] = []
    remarks: list[str] = []
    seen: set[str] = set()
    for u in utterances:
        if not u.is_tutor:
            continue
        note = parent_note(u.text)
        if note:
            remarks.append(note)
            continue
        for sent in _sentences(u.text):
            key = sent.lower()
            if key in seen:
                continue
            seen.add(key)
            praise = PRAISE_RE.findall(sent)
            praise_count += len(praise)
            if PARENT_MENTION_RE.search(sent):
                remarks.append(sent)
            elif ATTENTION_RE.search(sent) and not HOMEWORK_TRIGGER_RE.search(sent):
                attention.append(_quote(sent))
            elif praise and len(sent.split()) >= 4 and not re.match(r"(?:тема|topic)\b", sent, re.IGNORECASE):
                praise_quotes.append(_quote(sent))
    return {"praise_count": praise_count, "praise_quotes": praise_quotes[:3], "attention": attention[:4],
            "remarks": remarks[:6], "homework_status": homework_status(utterances)}


def activity_level(report: LessonReport) -> str | None:
    s = report.stats
    if not s.student_words or not s.tutor_words:
        return None  # в записи без разделения говорящих активность не оценить
    share = s.student_talk_share
    level = "высокая" if share >= 35 else "средняя" if share >= 20 else "низкая"
    return f"{level} (ученик говорил {share:.0f}% времени урока)"


def build_review_items(report: LessonReport, attention: list[str]) -> list[str]:
    items: list[str] = []
    for c in report.corrections[:4]:
        items.append(f"Ошибка: {c.wrong} → правильно: {c.correct}" if c.wrong != "—" else f"Правильно: {c.correct}")
    for r in report.rules[:3]:
        items.append(f"Правило: {r.title}")
    hard = [v.word for v in report.vocabulary if v.source == "teacher_list"][:6]
    if hard:
        items.append("Новые слова: " + ", ".join(hard))
    items += [f"Замечание преподавателя: {a}" for a in attention[:2]]
    return items[:8]


def build_parent_report(report: LessonReport, utterances: list[Utterance], student_name: str | None,
                        notes: Iterable[str] = (), progress: Progress | None = None) -> ParentReport:
    """Офлайн-отчёт для родителей (без LLM)."""
    sig = collect_signals(utterances)
    lang = LANGUAGE_NAMES_GEN.get(report.target_language, "изучаемом языке")
    achievements: list[str] = []
    attention: list[str] = []

    if report.vocabulary:
        words = ", ".join(v.word for v in report.vocabulary[:8]) + ("…" if len(report.vocabulary) > 8 else "")
        achievements.append(f"Изучено {plural(len(report.vocabulary), 'новое слово', 'новых слова', 'новых слов')}: {words}.")
    if report.rules:
        titles = "; ".join(r.title.rstrip(".") for r in report.rules[:3])
        achievements.append("Разобрано: " + titles + ("" if titles.endswith("…") else "."))
    if sig["homework_status"] == "done":
        achievements.append("Домашнее задание к уроку выполнено.")
    if sig["praise_count"]:
        achievements.append(f"Похвала преподавателя на уроке: {plural(sig['praise_count'], 'раз', 'раза', 'раз')}.")
    achievements += [f"Преподаватель отметил: {q}" for q in sig["praise_quotes"][:2]]
    if progress:
        if progress.corrections_prev is not None and progress.corrections_now < progress.corrections_prev:
            achievements.append(f"Ошибок меньше, чем на прошлом уроке: {progress.corrections_prev} → {progress.corrections_now}.")
        if progress.talk_share_prev is not None and progress.talk_share_now - progress.talk_share_prev >= 5:
            achievements.append(f"Говорит на уроке больше, чем в прошлый раз: {progress.talk_share_prev:.0f}% → "
                                f"{progress.talk_share_now:.0f}%.")
        if progress.words_total:
            achievements.append(f"Всего в словаре ученика: {plural(progress.words_total, 'слово', 'слова', 'слов')}.")

    attention += sig["attention"]
    if sig["homework_status"] == "not_done":
        attention.append("Домашнее задание к этому уроку не было выполнено.")
    elif sig["homework_status"] == "partial":
        attention.append("Домашнее задание к этому уроку выполнено не полностью.")
    if len(report.corrections) >= 3:
        attention.append(f"На уроке исправлено {plural(len(report.corrections), 'ошибка', 'ошибки', 'ошибок')} — "
                         "их стоит повторить (раздел «Что повторить» в конспекте).")
    if progress and progress.corrections_prev is not None and progress.corrections_now - progress.corrections_prev >= 2:
        attention.append(f"Ошибок больше, чем на прошлом уроке: {progress.corrections_prev} → {progress.corrections_now}.")
    activity = activity_level(report)
    if activity and report.stats.student_talk_share < 15:
        attention.append(f"Ученик говорил мало ({report.stats.student_talk_share:.0f}% времени урока) — "
                         "разговорной практики стоит больше.")

    recommendations: list[str] = []
    if report.homework_teacher:
        n = len(report.homework_teacher)
        recommendations.append(f"Проследите, чтобы домашнее задание ({plural(n, 'пункт', 'пункта', 'пунктов')}) "
                               "было выполнено к следующему уроку.")
    if report.vocabulary:
        recommendations.append("Попросите назвать новые слова урока и их перевод: 5 минут в день помогают запомнить их надёжнее.")
    if activity and report.stats.student_talk_share < 20:
        recommendations.append(f"Поощряйте разговор на {lang}: пара фраз о прошедшем дне, песни, мультфильмы.")
    if sig["homework_status"] == "not_done":
        recommendations.append("Помогите выделить постоянное время в расписании для домашнего задания.")
    if not recommendations:
        recommendations.append("Спросите, что нового было на уроке: пересказ помогает закрепить материал.")

    parts = []
    if report.topic:
        parts.append(f"Тема урока: {report.topic}.")
    done = []
    if report.rules:
        done.append(f"разобрали {plural(len(report.rules), 'правило', 'правила', 'правил')}")
    if report.vocabulary:
        done.append(f"выучили {plural(len(report.vocabulary), 'новое слово', 'новых слова', 'новых слов')}")
    if report.corrections:
        done.append(f"исправили {plural(len(report.corrections), 'ошибку', 'ошибки', 'ошибок')}")
    if done:
        parts.append("На уроке " + ", ".join(done) + ".")
    if report.homework_teacher:
        parts.append("Задано домашнее задание к следующему уроку.")
    summary = " ".join(parts) or report.summary

    remarks = [n.strip() for n in notes if n and n.strip()] + sig["remarks"]
    return ParentReport(student_name=student_name, summary=summary.strip(), achievements=achievements,
                        attention=attention, teacher_remarks=_dedupe(remarks), homework_status=sig["homework_status"],
                        recommendations=recommendations, activity=activity)


def compute_progress(report: LessonReport, known_words: Iterable[str], previous: LessonReport | None,
                     lessons_before: int) -> Progress:
    keys = {word_key(k) for k in known_words if k} | {v.key for v in report.vocabulary}
    return Progress(
        lessons_total=lessons_before + 1, words_total=len(keys), words_this_lesson=len(report.vocabulary),
        corrections_now=len(report.corrections), corrections_prev=len(previous.corrections) if previous else None,
        talk_share_now=report.stats.student_talk_share,
        talk_share_prev=previous.stats.student_talk_share if previous and previous.stats.student_words else None,
    )


def student_name_from(utterances: list[Utterance]) -> str | None:
    for u in utterances:
        if u.role == Role.STUDENT and u.speaker not in ("—", ""):
            return u.speaker
    return None


def _dedupe(items: list[str]) -> list[str]:
    seen, out = set(), []
    for it in items:
        k = it.lower().strip(" .")
        if k and k not in seen:
            seen.add(k)
            out.append(it)
    return out
