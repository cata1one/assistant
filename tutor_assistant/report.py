"""Сборка итогового отчёта по уроку: конспект, слова, правила, тест, ДЗ."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime

from .config import Settings
from .homework import HomeworkCollector, generate_homework
from .llm import LLMClient, LLMLessonReport
from .models import (
    Correction,
    HomeworkTask,
    LessonReport,
    ParentReport,
    Rule,
    TestQuestion,
    Utterance,
    VocabItem,
    word_key,
)
from .parent_report import (
    build_parent_report,
    build_review_items,
    collect_signals,
    compute_progress,
    parent_note,
    student_name_from,
)
from .quiz import generate_test
from .summary import (
    compute_stats,
    detect_topic,
    extract_corrections,
    extract_rules,
    offline_summary,
)
from .transcript import utterances_to_text
from .vocabulary import VocabularyCollector, attach_examples, auto_candidates


def collect_lesson_material(utterances: list[Utterance], target_language: str) -> tuple[list[VocabItem], list[HomeworkTask]]:
    """Объявленные слова и ДЗ преподавателя – в порядке реплик."""
    vocab = VocabularyCollector(target_language)
    hw = HomeworkCollector()
    for u in utterances:
        if u.is_tutor:
            vocab.feed_tutor_message(u.text)
            hw.feed_tutor_message(u.text)
        else:
            vocab.stop_awaiting()
    return vocab.words, hw.tasks


def build_report(
    utterances: list[Utterance],
    settings: Settings,
    llm: LLMClient | None = None,
    known_words: Iterable[str] = (),
    title: str | None = None,
    lesson_id: str | None = None,
    violations: int = 0,
    date: datetime | None = None,
    announced: list[VocabItem] | None = None,
    assigned: list[HomeworkTask] | None = None,
    notes: list[str] | None = None,
    previous: LessonReport | None = None,
    lessons_before: int = 0,
    student_name: str | None = None,
) -> LessonReport:
    """Строит отчёт. Если передан ``llm`` и он доступен – конспект, тест и отчёт родителям делает Claude.

    ``announced``/``assigned`` – слова и ДЗ, уже собранные по ходу живого урока;
    если не переданы, извлекаются из реплик. ``notes`` – заметки преподавателя для
    родителей, ``previous`` – отчёт прошлого урока ученика (для динамики).
    """
    known = [k for k in known_words if k]
    # Заметки «Родителям: …» – не материал урока: в конспект ученика они не попадают.
    notes = list(notes or [])
    lesson_utts: list[Utterance] = []
    for u in utterances:
        note = parent_note(u.text) if u.is_tutor else None
        if note:
            notes.append(note)
        else:
            lesson_utts.append(u)
    utterances = lesson_utts
    student_name = student_name or student_name_from(utterances)
    if announced is None or assigned is None:
        found_words, found_hw = collect_lesson_material(utterances, settings.target_language)
        announced = found_words if announced is None else announced
        assigned = found_hw if assigned is None else assigned

    vocabulary = [v.model_copy() for v in announced]
    attach_examples(vocabulary, utterances)
    known_keys = {word_key(k) for k in known} | {v.key for v in vocabulary}
    extra = auto_candidates(utterances, settings.target_language, known=known_keys)
    topic = detect_topic(utterances)
    rules = extract_rules(utterances)
    corrections = extract_corrections(utterances)
    stats = compute_stats(utterances, violations)
    day = (date or datetime.now(settings.tz)).strftime("%Y-%m-%d")

    report = LessonReport(
        lesson_id=lesson_id, title=title, date=day, target_language=settings.target_language, topic=topic,
        rules=rules, vocabulary=vocabulary, extra_words=extra, corrections=corrections,
        homework_teacher=list(assigned), stats=stats,
    )

    llm_result: LLMLessonReport | None = None
    if llm is not None and llm.available and utterances:
        llm_result = llm.generate_lesson_report(
            transcript=utterances_to_text(utterances), target_language=settings.target_language,
            announced_words=[f"{v.word} – {v.translation}" if v.translation else v.word for v in announced],
            assigned_homework=[t.text for t in assigned],
            known_words=known,
            title=title,
            teacher_notes=notes,
            progress=_progress_text(previous, lessons_before),
            student_name=student_name,
        )
        if llm_result is None and llm.last_error:
            report.notes.append(f"{_who(llm)} недоступен ({llm.last_error}); отчёт подготовлен офлайн.")
    elif llm is not None and llm.last_error:
        report.notes.append(f"{_who(llm)} недоступен ({llm.last_error}); отчёт подготовлен офлайн.")

    if llm_result is not None:
        _merge_llm(report, llm_result, known_keys={word_key(k) for k in known})
        if getattr(llm, "provider", None) == "ai":
            report.generated_by = "ai"
    else:
        report.summary, report.key_points = offline_summary(topic, rules, vocabulary, corrections, len(assigned))
        report.test = generate_test(vocabulary or extra, seed=lesson_id or day, target_language=settings.target_language)
        report.homework_generated = generate_homework(vocabulary or extra, rules, topic, settings.target_language,
                                                      has_teacher_homework=bool(assigned))
        if not vocabulary and extra:
            report.notes.append("Преподаватель не продиктовал список новых слов – показаны слова, которые звучали на уроке.")

    report.progress = compute_progress(report, known, previous, lessons_before)
    offline_parent = build_parent_report(report, utterances, student_name, notes, report.progress)
    if llm_result is not None:
        report.parent = _merge_parent(llm_result, offline_parent, notes)
        report.review_items = [x for x in llm_result.review_items if x.strip()] or \
            build_review_items(report, collect_signals(utterances)["attention"])
    else:
        report.parent = offline_parent
        report.review_items = build_review_items(report, collect_signals(utterances)["attention"])
    return report


def _who(llm: LLMClient) -> str:
    return "ИИ" if getattr(llm, "provider", None) == "ai" else "Claude"


def _progress_text(previous: LessonReport | None, lessons_before: int) -> str | None:
    if previous is None and not lessons_before:
        return None
    parts = [f"Это урок №{lessons_before + 1} ученика."]
    if previous is not None:
        parts.append(f"Прошлый урок {previous.date}: тема «{previous.topic or '—'}», исправлено ошибок: "
                     f"{len(previous.corrections)}, доля речи ученика: {previous.stats.student_talk_share:.0f}%.")
        if previous.homework_teacher:
            parts.append("ДЗ прошлого урока: " + "; ".join(t.text for t in previous.homework_teacher))
    return " ".join(parts)


def _merge_parent(r: LLMLessonReport, offline: ParentReport, notes: list[str]) -> ParentReport:
    remarks, seen = [], set()
    for item in [*notes, *r.parent_teacher_remarks]:  # заметки преподавателя – всегда, как он их написал
        key = item.lower().strip(" .«»")
        if item.strip() and key not in seen:
            seen.add(key)
            remarks.append(item.strip())
    status = r.homework_status if r.homework_status != "unknown" else offline.homework_status
    return ParentReport(
        student_name=offline.student_name, summary=r.parent_summary.strip() or offline.summary,
        achievements=[x for x in r.parent_achievements if x.strip()] or offline.achievements,
        attention=[x for x in r.parent_attention if x.strip()] or offline.attention,
        teacher_remarks=remarks, homework_status=status,
        recommendations=[x for x in r.parent_recommendations if x.strip()] or offline.recommendations,
        activity=offline.activity,
    )


def _merge_llm(report: LessonReport, r: LLMLessonReport, known_keys: set[str]) -> None:
    report.generated_by = "claude"
    report.topic = r.topic.strip() or report.topic
    report.summary = r.summary.strip()
    report.key_points = [p for p in r.key_points if p.strip()]
    if r.rules:
        report.rules = [Rule(title=x.title, explanation=x.explanation, examples=x.examples) for x in r.rules]
    if r.corrections:
        report.corrections = [Correction(wrong=x.wrong, correct=x.correct, note=x.note) for x in r.corrections]

    # Словарь: объявленные преподавателем слова остаются всегда (Claude только дополняет их поля).
    by_key = {v.key: v for v in report.vocabulary}
    for x in r.vocabulary:
        item = VocabItem(word=x.word, translation=x.translation or None, transcription=x.transcription,
                         part_of_speech=x.part_of_speech, example=x.example, source="llm")
        existing = by_key.get(item.key)
        if existing:
            for field in ("translation", "transcription", "part_of_speech", "example"):
                if not getattr(existing, field) and getattr(item, field):
                    setattr(existing, field, getattr(item, field))
        elif item.key and item.key not in known_keys:
            report.vocabulary.append(item)
            by_key[item.key] = item
    report.extra_words = [w for w in report.extra_words if w.key not in by_key]

    report.test = [TestQuestion(kind=q.kind, question=q.question, options=q.options, answer=q.answer,
                                explanation=q.explanation) for q in r.test]
    # ДЗ преподавателя: если автоматически ничего не нашли, берём уточнённое Claude.
    if not report.homework_teacher and r.homework_teacher:
        report.homework_teacher = [HomeworkTask(text=t, source="teacher") for t in r.homework_teacher if t.strip()]
    report.homework_generated = [HomeworkTask(text=t, source="generated") for t in r.homework_generated if t.strip()]
