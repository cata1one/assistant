"""Конспект урока: тема, правила, работа над ошибками, статистика."""

from __future__ import annotations

import re
from collections.abc import Iterable
from datetime import datetime

from .models import Correction, LessonStats, Role, Rule, Utterance, VocabItem
from .textnorm import has_latin

TOPIC_RES = [
    re.compile(r"тема\s+(?:нашего\s+|сегодняшнего\s+)?(?:урока|занятия)?\s*(?:сегодня\s*)?[:\-—–]\s*(?P<t>[^.!?\n]{3,80})", re.I),
    re.compile(r"тема\s+(?:нашего\s+|сегодняшнего\s+)?(?:урока|занятия)\s+(?:—\s+)?(?P<t>[^.!?\n]{3,80})", re.I),
    re.compile(r"сегодня\s+(?:мы\s+)?(?:будем\s+)?(?:изучаем|изучим|изучать|проходим|пройдем|пройдём|разберем|разберём"
               r"|разбирать|поговорим\s+(?:о|об|про)|говорим\s+(?:о|об|про)|учим|выучим|повторим|повторяем|начнем|начнём)"
               r"\s+(?P<t>[^.!?\n]{3,80})", re.I),
    re.compile(r"today\s+(?:we\s+(?:will|'ll|are\s+going\s+to)\s+|we\s+|let'?s\s+)?(?:learn|study|talk\s+about|discuss"
               r"|practi[cs]e|revise|review|look\s+at|cover)\s+(?P<t>[^.!?\n]{3,80})", re.I),
    re.compile(r"(?:the\s+)?topic\s+(?:of\s+(?:the|today'?s)\s+lesson\s+)?(?:is|:)\s*(?P<t>[^.!?\n]{3,80})", re.I),
]

RULE_MARKERS = re.compile(
    r"(?:правил[оа]|запомни(?:те)?|обрати(?:те)?\s+внимание|важно|исключени[ея]|используется|употребляется"
    r"|ставится|образуется|строится|не\s+путай(?:те)?|нужно\s+(?:ставить|использовать|добавлять)"
    r"|всегда\s+(?:ставим|используем|пишем)|никогда\s+не|формула|схема|грамматик\w*|времена?\s+\w+"
    r"|(?<![\w])rule(?![\w])|remember|we\s+use|is\s+used|are\s+used|don'?t\s+forget|note\s+that|exception)",
    re.IGNORECASE,
)
_CORRECTION_RES = [
    re.compile(r"не\s+[«\"]?(?P<w>[A-Za-z][^«»\"\n,]{0,60}?)[»\"]?\s*,\s*а\s+[«\"]?(?P<c>[A-Za-z][^«»\"\n.!?]{0,60})[»\"]?", re.I),
    re.compile(r"правильно\s*(?:будет|говорить|сказать)?\s*[:\-—–]?\s*[«\"]?(?P<c>[A-Za-z][^«»\"\n.!?]{0,60})[»\"]?"
               r"(?:\s*,?\s*(?:а\s+)?не\s+[«\"]?(?P<w>[A-Za-z][^«»\"\n.!?]{0,60})[»\"]?)?", re.I),
    re.compile(r"(?:we\s+say|you\s+should\s+say|it'?s|say)\s+[«\"“]?(?P<c>[A-Za-z][^«»\"“”\n.!?,]{0,60})[»\"”]?\s*,?\s*not\s+"
               r"[«\"“]?(?P<w>[A-Za-z][^«»\"“”\n.!?]{0,60})[»\"”]?", re.I),
]


def detect_topic(utterances: Iterable[Utterance]) -> str | None:
    for u in utterances:
        if not u.is_tutor:
            continue
        for rx in TOPIC_RES:
            m = rx.search(u.text)
            if m:
                topic = _balance_quotes(m.group("t").strip(" ,;:—–-\""))
                return topic[:1].upper() + topic[1:] if topic else None
    return None


def _balance_quotes(s: str) -> str:
    s = s.strip()
    if s.startswith("«") and s.count("«") > s.count("»"):
        s = s[1:]
    if s.count("«") > s.count("»"):
        s += "»"
    if s.endswith("»") and s.count("»") > s.count("«"):
        s = s[:-1]
    return s.strip()


def plural(n: int, one: str, few: str, many: str) -> str:
    """plural(3, "пункт", "пункта", "пунктов") → «3 пункта»."""
    n_abs = abs(n) % 100
    if 11 <= n_abs <= 14:
        form = many
    elif n_abs % 10 == 1:
        form = one
    elif 2 <= n_abs % 10 <= 4:
        form = few
    else:
        form = many
    return f"{n} {form}"


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", text) if s.strip()]


def extract_rules(utterances: Iterable[Utterance], limit: int = 10) -> list[Rule]:
    rules: list[Rule] = []
    seen: set[str] = set()
    for u in utterances:
        if not u.is_tutor:
            continue
        sents = _sentences(u.text)
        for i, s in enumerate(sents):
            if len(s.split()) < 4 or not RULE_MARKERS.search(s):
                continue
            key = re.sub(r"\W+", " ", s.lower()).strip()
            if key in seen:
                continue
            seen.add(key)
            # Следующие предложения на изучаемом языке — примеры к правилу.
            examples = [x for x in sents[i + 1:i + 4] if has_latin(x) and not re.search(r"[а-яё]", x, re.I)][:3]
            title = re.sub(r"^(?:запомни(?:те)?|обрати(?:те)?\s+внимание|важно|итак|смотри(?:те)?)\s*[:,!—–-]?\s*", "",
                           s, flags=re.I)
            title = title[:1].upper() + title[1:]
            short = title if len(title) <= 70 else title[:67].rsplit(" ", 1)[0] + "…"
            rules.append(Rule(title=short.rstrip("."), explanation=title, examples=examples))
            if len(rules) >= limit:
                return rules
    return rules


def extract_corrections(utterances: Iterable[Utterance], limit: int = 15) -> list[Correction]:
    out: list[Correction] = []
    seen: set[tuple[str, str]] = set()
    for u in utterances:
        if not u.is_tutor:
            continue
        for rx in _CORRECTION_RES:
            for m in rx.finditer(u.text):
                correct = (m.group("c") or "").strip(" ,")
                wrong = (m.groupdict().get("w") or "").strip(" ,")
                if not correct or (wrong and wrong.lower() == correct.lower()):
                    continue
                key = (wrong.lower(), correct.lower())
                if key in seen:
                    continue
                seen.add(key)
                out.append(Correction(wrong=wrong or "—", correct=correct))
                if len(out) >= limit:
                    return out
    return out


def _parse_ts(ts: str | None) -> int | None:
    if not ts:
        return None
    try:
        if "T" in ts or "-" in ts:
            d = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return int(d.timestamp())
        parts = [int(p) for p in ts.split(":")]
    except ValueError:
        return None
    if len(parts) == 2:  # «10:05» — время на часах
        return parts[0] * 3600 + parts[1] * 60
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return None


def compute_stats(utterances: list[Utterance], violations: int = 0) -> LessonStats:
    tutor = [u for u in utterances if u.role == Role.TUTOR]
    student = [u for u in utterances if u.role == Role.STUDENT]
    tw = sum(len(u.text.split()) for u in tutor)
    sw = sum(len(u.text.split()) for u in student)
    stamps = [t for t in (_parse_ts(u.timestamp) for u in utterances) if t is not None]
    duration = None
    if len(stamps) >= 2 and stamps[-1] >= stamps[0]:
        duration = round((stamps[-1] - stamps[0]) / 60) or None
    return LessonStats(
        messages=len(utterances), tutor_messages=len(tutor), student_messages=len(student),
        tutor_words=tw, student_words=sw,
        student_talk_share=round(100 * sw / (tw + sw), 1) if tw + sw else 0.0,
        duration_minutes=duration, violations=violations,
    )


def offline_summary(topic: str | None, rules: list[Rule], vocabulary: list[VocabItem], corrections: list[Correction],
                    homework_count: int) -> tuple[str, list[str]]:
    parts = []
    parts.append(f"Тема урока: {topic}." if topic else "Краткий конспект урока.")
    if vocabulary:
        parts.append(f"Изучено {plural(len(vocabulary), 'новое слово', 'новых слова', 'новых слов')}.")
    if rules:
        parts.append(f"Разобрано {plural(len(rules), 'правило', 'правила', 'правил')} и важных моментов.")
    if corrections:
        parts.append(f"Работа над ошибками: {plural(len(corrections), 'ошибка', 'ошибки', 'ошибок')}.")
    if homework_count:
        parts.append(f"Домашнее задание: {plural(homework_count, 'пункт', 'пункта', 'пунктов')}.")
    key_points = [r.title for r in rules[:6]]
    if vocabulary:
        key_points.append("Новые слова: " + ", ".join(v.word for v in vocabulary[:12]))
    return " ".join(parts), key_points
