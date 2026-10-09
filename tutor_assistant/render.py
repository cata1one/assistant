"""Оформление результатов в текст (Telegram/консоль) и Markdown."""

from __future__ import annotations

import html
from collections.abc import Iterable

from .homework import LANGUAGE_NAMES
from .models import HomeworkTask, LessonReport, TestQuestion, VocabItem
from .quiz import LETTERS


def _word_line(v: VocabItem, i: int) -> str:
    line = f"{i}. {v.word}"
    if v.transcription:
        line += f" {v.transcription}"
    if v.part_of_speech:
        line += f" ({v.part_of_speech})"
    if v.translation:
        line += f" — {v.translation}"
    if v.example:
        line += f"\n   Пример: {v.example}"
    return line


def render_words(words: Iterable[VocabItem], title: str = "Новые слова") -> str:
    items = list(words)
    if not items:
        return f"{title}: пока нет."
    return f"📚 {title} ({len(items)}):\n" + "\n".join(_word_line(v, i) for i, v in enumerate(items, 1))


def render_homework(teacher: list[HomeworkTask], generated: list[HomeworkTask]) -> str:
    lines = ["📝 Домашнее задание"]
    if teacher:
        lines.append("Задано преподавателем:")
        lines += [f"{i}. {t.text}" for i, t in enumerate(teacher, 1)]
    if generated:
        lines.append("Дополнительно для закрепления:" if teacher else "Задания по материалу урока:")
        lines += [f"{i}. {t.text}" for i, t in enumerate(generated, 1)]
    if not teacher and not generated:
        lines.append("Домашнее задание не задано.")
    return "\n".join(lines)


def render_test(test: list[TestQuestion], with_answers: bool = False) -> str:
    if not test:
        return "✅ Тест: недостаточно материала для теста."
    lines = [f"✅ Тест для самопроверки ({len(test)} вопр.)"]
    for i, q in enumerate(test, 1):
        lines.append(f"{i}. {q.question}")
        for j, opt in enumerate(q.options):
            lines.append(f"   {LETTERS[j] if j < len(LETTERS) else j + 1}) {opt}")
    if with_answers:
        lines.append("\n🔑 Ответы:")
        for i, q in enumerate(test, 1):
            ans = q.answer
            if q.options and q.answer in q.options:
                idx = q.options.index(q.answer)
                ans = f"{LETTERS[idx] if idx < len(LETTERS) else idx + 1}) {q.answer}"
            lines.append(f"{i}. {ans}" + (f" — {q.explanation}" if q.explanation else ""))
    return "\n".join(lines)


def render_summary(r: LessonReport) -> str:
    lang = LANGUAGE_NAMES.get(r.target_language, r.target_language)
    head = f"📘 Конспект урока от {r.date}" + (f" — {r.title}" if r.title else "")
    lines = [head]
    if r.topic:
        lines.append(f"Тема: {r.topic}")
    lines.append(f"Язык: {lang}")
    if r.summary:
        lines += ["", r.summary]
    if r.key_points:
        lines += ["", "Главное:"] + [f"• {p}" for p in r.key_points]
    if r.rules:
        lines += ["", "📐 Правила:"]
        for i, rule in enumerate(r.rules, 1):
            lines.append(f"{i}. {rule.title}")
            if rule.explanation and rule.explanation.rstrip(".") != rule.title.rstrip("."):
                lines.append(f"   {rule.explanation}")
            for ex in rule.examples:
                lines.append(f"   — {ex}")
    if r.corrections:
        lines += ["", "🛠 Работа над ошибками:"]
        for c in r.corrections:
            line = f"• {c.wrong} → {c.correct}" if c.wrong != "—" else f"• Правильно: {c.correct}"
            lines.append(line + (f" ({c.note})" if c.note else ""))
    return "\n".join(lines)


def render_stats(r: LessonReport) -> str:
    s = r.stats
    parts = [f"Реплик: {s.messages} (преподаватель {s.tutor_messages}, ученик {s.student_messages})",
             f"доля речи ученика: {s.student_talk_share}%"]
    if s.duration_minutes is not None:
        parts.append(f"длительность: {s.duration_minutes} мин")
    if s.violations:
        parts.append(f"⚠️ нарушений правил общения: {s.violations}")
    return "📊 " + "; ".join(parts)


def render_report(r: LessonReport, with_answers: bool = True) -> str:
    blocks = [render_summary(r), render_words(r.vocabulary, "Новые слова урока")]
    if r.extra_words:
        blocks.append(render_words(r.extra_words, "Также звучали на уроке"))
    blocks += [render_test(r.test, with_answers=with_answers), render_homework(r.homework_teacher, r.homework_generated),
               render_stats(r)]
    if r.notes:
        blocks.append("ℹ️ " + "\nℹ️ ".join(r.notes))
    return "\n\n".join(blocks)


def render_report_markdown(r: LessonReport) -> str:
    md = [f"# Конспект урока — {r.date}" + (f": {r.title}" if r.title else "")]
    if r.topic:
        md.append(f"**Тема:** {r.topic}")
    if r.summary:
        md.append(r.summary)
    if r.key_points:
        md.append("## Главное\n" + "\n".join(f"- {p}" for p in r.key_points))
    if r.rules:
        md.append("## Правила")
        for rule in r.rules:
            block = f"### {rule.title}\n{rule.explanation}"
            if rule.examples:
                block += "\n" + "\n".join(f"- *{e}*" for e in rule.examples)
            md.append(block)
    if r.vocabulary:
        md.append("## Новые слова\n| # | Слово | Транскрипция | Перевод | Пример |\n|---|---|---|---|---|")
        md[-1] += "\n" + "\n".join(
            f"| {i} | {_md(v.word)} | {_md(v.transcription or '')} | {_md(v.translation or '')} | {_md(v.example or '')} |"
            for i, v in enumerate(r.vocabulary, 1))
    if r.extra_words:
        md.append("## Также звучали на уроке\n" + ", ".join(v.word for v in r.extra_words))
    if r.corrections:
        md.append("## Работа над ошибками\n" + "\n".join(
            f"- ~~{c.wrong}~~ → **{c.correct}**" + (f" — {c.note}" if c.note else "") if c.wrong != "—"
            else f"- **{c.correct}**" for c in r.corrections))
    if r.test:
        md.append("## Тест\n" + "\n".join(
            f"{i}. {q.question}" + "".join(f"\n   - {o}" for o in q.options) for i, q in enumerate(r.test, 1)))
        md.append("<details><summary>Ответы</summary>\n\n" + "\n".join(
            f"{i}. {q.answer}" + (f" — {q.explanation}" if q.explanation else "") for i, q in enumerate(r.test, 1))
            + "\n</details>")
    hw = []
    if r.homework_teacher:
        hw.append("**Задано преподавателем:**\n" + "\n".join(f"{i}. {t.text}" for i, t in enumerate(r.homework_teacher, 1)))
    if r.homework_generated:
        hw.append("**Для закрепления:**\n" + "\n".join(f"{i}. {t.text}" for i, t in enumerate(r.homework_generated, 1)))
    if hw:
        md.append("## Домашнее задание\n" + "\n\n".join(hw))
    md.append("---\n" + render_stats(r).replace("📊 ", ""))
    return "\n\n".join(md) + "\n"


def _md(s: str) -> str:
    return s.replace("|", "\\|").replace("\n", " ")


def escape_html(s: str) -> str:
    return html.escape(s, quote=False)


def split_message(text: str, limit: int = 4000) -> list[str]:
    """Делит длинный текст на части для Telegram (лимит 4096 символов)."""
    if len(text) <= limit:
        return [text]
    parts, current = [], ""
    for block in text.split("\n"):
        while len(block) > limit:
            if current:
                parts.append(current)
                current = ""
            parts.append(block[:limit])
            block = block[limit:]
        if len(current) + len(block) + 1 > limit:
            parts.append(current)
            current = block
        else:
            current = f"{current}\n{block}" if current else block
    if current:
        parts.append(current)
    return parts
