"""Командная строка: python -m tutor_assistant <команда>."""

from __future__ import annotations

import argparse
import dataclasses
import json
import logging
import sys
from pathlib import Path

from . import render
from .config import Settings
from .models import Role
from .service import TutorAssistant


def read_text_file(path: str) -> str:
    """Читает файл в UTF-8, а файлы из Windows — в cp1251."""
    if path == "-":
        return sys.stdin.read()
    data = Path(path).read_bytes()
    for enc in ("utf-8-sig", "cp1251"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _assistant(args: argparse.Namespace) -> TutorAssistant:
    settings = Settings.from_env()
    if getattr(args, "no_llm", False):
        settings = dataclasses.replace(settings, llm_mode="off")
    if getattr(args, "db", None):
        settings = dataclasses.replace(settings, db_path=args.db)
    return TutorAssistant(settings)


def cmd_analyze(args: argparse.Namespace) -> int:
    assistant = _assistant(args)
    text = read_text_file(args.file)
    report, violations = assistant.analyze_transcript(
        text, title=args.title, student_id=args.student, use_llm=not args.no_llm, persist=args.save,
        tutor_names=tuple(args.tutor or ()), student_names=tuple(args.student_name or ()),
    )
    if args.json:
        print(json.dumps({"report": report.model_dump(), "violations": violations}, ensure_ascii=False, indent=2))
    else:
        print(render.render_report(report))
        if violations:
            print("\n🚨 Нарушения правил общения:")
            for v in violations:
                print(f"• {v['speaker']} ({v['role']}): {v['summary']} [{v['action']}]\n  Было: {v['original_text']}\n"
                      f"  Стало: {v['redacted_text']}")
    if args.md:
        Path(args.md).write_text(render.render_report_markdown(report), encoding="utf-8")
        print(f"\nКонспект сохранён: {args.md}", file=sys.stderr)
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    assistant = _assistant(args)
    text = " ".join(args.text) if args.text else sys.stdin.read()
    result = assistant.moderate(text)
    if args.json:
        print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
    else:
        icon = {"block": "🚫", "warn": "⚠️", "allow": "✅"}[result.action]
        print(f"{icon} {result.action.upper()} (уровень: {result.severity.name.lower()})")
        if result.summary:
            print(f"Найдено: {result.summary}")
        for f in result.findings:
            print(f"  - {f.reason}: {f.value}")
        if result.blocked:
            print(f"Текст после скрытия: {result.redacted_text}")
    return 1 if result.blocked else 0


CHAT_HELP = """Режим урока. Пишите реплики с префиксом:
  t: текст   — преподаватель       s: текст — ученик
Команды: /end — завершить урок и получить отчёт, /quit — выход.
Запросы: «новые слова сегодня», «дз», «новые слова», «мой словарь», «тест», «конспект»."""


def cmd_chat(args: argparse.Namespace) -> int:
    assistant = _assistant(args)
    lesson = assistant.start_lesson(chat_id=f"cli:{args.chat}", tutor_id="tutor", tutor_name="Преподаватель",
                                    title=args.title)
    print(CHAT_HELP)
    print(f"Урок {lesson['id']} начат.\n")
    while True:
        try:
            line = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if not line:
            continue
        if line in ("/quit", "/exit"):
            return 0
        if line == "/end":
            report = assistant.finish_lesson(lesson["id"])
            print(render.render_report(report))
            lesson = assistant.start_lesson(chat_id=f"cli:{args.chat}", tutor_id="tutor", tutor_name="Преподаватель")
            print(f"\nНачат новый урок {lesson['id']}.")
            continue
        prefix, _, body = line.partition(":")
        role = {"t": Role.TUTOR, "т": Role.TUTOR, "s": Role.STUDENT, "с": Role.STUDENT, "у": Role.STUDENT}.get(
            prefix.strip().lower())
        if role is None or not body.strip():
            answer = assistant.handle_text_query(line, chat_id=f"cli:{args.chat}")
            print(answer or "Не понял. Используйте префикс «t:» или «s:», либо /end.")
            continue
        speaker = "tutor" if role == Role.TUTOR else "student"
        out = assistant.process_message(lesson["id"], speaker, speaker, body.strip(), role=role)
        m = out.moderation
        if m.warning:
            print(m.warning)
        if m.blocked:
            print(f"   В чате видно: {m.redacted_text}")
        if out.new_words:
            print("   📚 Записал слова: " + ", ".join(w.word + (f" — {w.translation}" if w.translation else "")
                                              for w in out.new_words))
        if out.new_homework:
            print("   📝 Записал ДЗ: " + "; ".join(h.text for h in out.new_homework))
        answer = assistant.handle_text_query(body.strip(), chat_id=f"cli:{args.chat}")
        if answer:
            print(answer)


def cmd_words(args: argparse.Namespace) -> int:
    assistant = _assistant(args)
    owner = f"student:{args.student}"
    words = assistant.words_today(owner) if args.today else assistant.storage.all_words(owner)
    print(render.render_words(words, "Новые слова сегодня" if args.today else "Словарь ученика"))
    return 0


def cmd_incidents(args: argparse.Namespace) -> int:
    assistant = _assistant(args)
    rows = assistant.storage.incidents(lesson_id=args.lesson, user_id=args.user, limit=args.limit)
    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0
    if not rows:
        print("Нарушений нет.")
    for r in rows:
        print(f"#{r['id']} {r['created_at']} урок {r['lesson_id']} — {r['user_name'] or r['user_id']} ({r['role']}): "
              f"{r['summary']} [{r['severity']}/{r['action']}]\n   {r['original_text']}")
    return 0


def cmd_bot(args: argparse.Namespace) -> int:
    from .telegram_bot import run_bot

    run_bot(Settings.from_env())
    return 0


def cmd_api(args: argparse.Namespace) -> int:
    from .api import run_api

    settings = Settings.from_env()
    run_api(settings, host=args.host or settings.api_host, port=args.port or settings.api_port)
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="tutor_assistant", description="Ассистент онлайн-школы и репетитора")
    p.add_argument("-v", "--verbose", action="store_true", help="подробный журнал")
    p.add_argument("--db", help="путь к базе SQLite (по умолчанию TUTOR_DB_PATH)")
    sub = p.add_subparsers(dest="command", required=True)

    a = sub.add_parser("analyze", help="отчёт и проверка по расшифровке урока")
    a.add_argument("file", help="файл с расшифровкой (или - для stdin)")
    a.add_argument("--title", help="название урока")
    a.add_argument("--student", help="id ученика (для учёта уже изученных слов)")
    a.add_argument("--tutor", action="append", help="имя преподавателя в расшифровке (можно несколько)")
    a.add_argument("--student-name", action="append", help="имя ученика в расшифровке (можно несколько)")
    a.add_argument("--json", action="store_true", help="вывод в JSON")
    a.add_argument("--md", help="сохранить конспект в Markdown")
    a.add_argument("--save", action="store_true", help="сохранить урок, слова и нарушения в базу")
    a.add_argument("--no-llm", action="store_true", help="не использовать Claude")
    a.set_defaults(func=cmd_analyze)

    c = sub.add_parser("check", help="проверить сообщение на контакты")
    c.add_argument("text", nargs="*", help="текст (или stdin)")
    c.add_argument("--json", action="store_true")
    c.set_defaults(func=cmd_check)

    ch = sub.add_parser("chat", help="интерактивный урок в консоли")
    ch.add_argument("--chat", default="local", help="идентификатор чата")
    ch.add_argument("--title", help="название урока")
    ch.add_argument("--no-llm", action="store_true")
    ch.set_defaults(func=cmd_chat)

    w = sub.add_parser("words", help="словарь ученика")
    w.add_argument("--student", required=True)
    w.add_argument("--today", action="store_true", help="только слова за сегодня")
    w.set_defaults(func=cmd_words)

    i = sub.add_parser("incidents", help="журнал нарушений")
    i.add_argument("--lesson")
    i.add_argument("--user")
    i.add_argument("--limit", type=int, default=50)
    i.add_argument("--json", action="store_true")
    i.set_defaults(func=cmd_incidents)

    b = sub.add_parser("bot", help="запустить Telegram-бота")
    b.set_defaults(func=cmd_bot)

    s = sub.add_parser("api", help="запустить HTTP API для платформы школы")
    s.add_argument("--host")
    s.add_argument("--port", type=int)
    s.set_defaults(func=cmd_api)
    return p


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
        except (AttributeError, ValueError):
            pass
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.WARNING,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    try:
        return int(args.func(args) or 0)
    except FileNotFoundError as exc:
        print(f"Файл не найден: {exc.filename}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 130
