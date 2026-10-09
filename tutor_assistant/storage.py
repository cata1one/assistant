"""Хранилище на SQLite: уроки, реплики, словарь ученика, отчёты, нарушения.

Реплики сохраняются только в «очищенном» виде (без контактов). Исходный текст
нарушения хранится отдельно в журнале — как доказательство для администратора.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from collections.abc import Iterable
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from .models import HomeworkTask, LessonReport, Role, Utterance, VocabItem

SCHEMA = """
CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    chat_id TEXT,
    tutor_id TEXT,
    tutor_name TEXT,
    student_id TEXT,
    student_name TEXT,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    started_at TEXT NOT NULL,
    finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_lessons_chat ON lessons(chat_id, started_at);
CREATE INDEX IF NOT EXISTS idx_lessons_student ON lessons(student_id, started_at);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id TEXT NOT NULL REFERENCES lessons(id),
    speaker_id TEXT,
    speaker_name TEXT,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_lesson ON messages(lesson_id, id);

CREATE TABLE IF NOT EXISTS lesson_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id TEXT NOT NULL REFERENCES lessons(id),
    kind TEXT NOT NULL,            -- word | homework
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_lesson ON lesson_items(lesson_id, kind);

CREATE TABLE IF NOT EXISTS vocabulary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner TEXT NOT NULL,
    lesson_id TEXT,
    word TEXT NOT NULL,
    key TEXT NOT NULL,
    translation TEXT,
    transcription TEXT,
    part_of_speech TEXT,
    example TEXT,
    source TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(owner, key)
);
CREATE INDEX IF NOT EXISTS idx_vocab_owner ON vocabulary(owner, created_at);

CREATE TABLE IF NOT EXISTS reports (
    lesson_id TEXT PRIMARY KEY REFERENCES lessons(id),
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id TEXT,
    chat_id TEXT,
    user_id TEXT,
    user_name TEXT,
    role TEXT,
    severity TEXT NOT NULL,
    action TEXT NOT NULL,
    summary TEXT,
    original_text TEXT NOT NULL,
    redacted_text TEXT NOT NULL,
    findings TEXT NOT NULL,
    created_at TEXT NOT NULL,
    reviewed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_incidents_lesson ON incidents(lesson_id);
CREATE INDEX IF NOT EXISTS idx_incidents_user ON incidents(user_id, created_at);
"""


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Storage:
    def __init__(self, path: str | Path = ":memory:"):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(self.path, check_same_thread=False, timeout=30)
        self._conn.row_factory = sqlite3.Row
        with self._lock:
            if self.path != ":memory:":
                self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
            self._conn.executescript(SCHEMA)
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    # -- низкоуровневые ---------------------------------------------------------
    def _exec(self, sql: str, params: Iterable[Any] = ()) -> sqlite3.Cursor:
        with self._lock:
            cur = self._conn.execute(sql, tuple(params))
            self._conn.commit()
            return cur

    def _all(self, sql: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(r) for r in self._conn.execute(sql, tuple(params)).fetchall()]

    def _one(self, sql: str, params: Iterable[Any] = ()) -> dict[str, Any] | None:
        rows = self._all(sql, params)
        return rows[0] if rows else None

    # -- уроки ------------------------------------------------------------------
    def create_lesson(self, chat_id: str | None = None, tutor_id: str | None = None, tutor_name: str | None = None,
                      student_id: str | None = None, student_name: str | None = None,
                      title: str | None = None) -> dict[str, Any]:
        lesson_id = uuid.uuid4().hex[:12]
        self._exec(
            "INSERT INTO lessons(id, chat_id, tutor_id, tutor_name, student_id, student_name, title, started_at)"
            " VALUES (?,?,?,?,?,?,?,?)",
            (lesson_id, chat_id, tutor_id, tutor_name, student_id, student_name, title, utcnow()),
        )
        return self.get_lesson(lesson_id)  # type: ignore[return-value]

    def get_lesson(self, lesson_id: str) -> dict[str, Any] | None:
        return self._one("SELECT * FROM lessons WHERE id=?", (lesson_id,))

    def active_lesson(self, chat_id: str) -> dict[str, Any] | None:
        return self._one("SELECT * FROM lessons WHERE chat_id=? AND status='active' ORDER BY started_at DESC LIMIT 1",
                         (chat_id,))

    def last_lesson(self, chat_id: str | None = None, student_id: str | None = None,
                    finished_only: bool = True) -> dict[str, Any] | None:
        cond, params = [], []
        if chat_id is not None:
            cond.append("chat_id=?")
            params.append(chat_id)
        if student_id is not None:
            cond.append("student_id=?")
            params.append(student_id)
        if finished_only:
            cond.append("status='finished'")
        where = " AND ".join(cond) or "1=1"
        return self._one(f"SELECT * FROM lessons WHERE {where} ORDER BY started_at DESC, rowid DESC LIMIT 1", params)

    def update_lesson(self, lesson_id: str, **fields: Any) -> None:
        allowed = {"student_id", "student_name", "tutor_id", "tutor_name", "title", "status", "finished_at"}
        items = [(k, v) for k, v in fields.items() if k in allowed]
        if not items:
            return
        sets = ", ".join(f"{k}=?" for k, _ in items)
        self._exec(f"UPDATE lessons SET {sets} WHERE id=?", [v for _, v in items] + [lesson_id])

    def finish_lesson(self, lesson_id: str) -> None:
        self.update_lesson(lesson_id, status="finished", finished_at=utcnow())

    # -- реплики ----------------------------------------------------------------
    def add_message(self, lesson_id: str, speaker_id: str | None, speaker_name: str | None, role: Role, text: str,
                    created_at: str | None = None) -> int:
        cur = self._exec(
            "INSERT INTO messages(lesson_id, speaker_id, speaker_name, role, text, created_at) VALUES (?,?,?,?,?,?)",
            (lesson_id, speaker_id, speaker_name, role.value, text, created_at or utcnow()),
        )
        return int(cur.lastrowid or 0)

    def lesson_utterances(self, lesson_id: str) -> list[Utterance]:
        rows = self._all("SELECT * FROM messages WHERE lesson_id=? ORDER BY id", (lesson_id,))
        return [Utterance(r["speaker_name"] or r["speaker_id"] or "—", Role(r["role"]), r["text"], r["created_at"])
                for r in rows]

    # -- материалы, собранные по ходу урока --------------------------------------
    def add_lesson_item(self, lesson_id: str, kind: str, payload: dict[str, Any]) -> None:
        self._exec("INSERT INTO lesson_items(lesson_id, kind, payload, created_at) VALUES (?,?,?,?)",
                   (lesson_id, kind, json.dumps(payload, ensure_ascii=False), utcnow()))

    def lesson_items(self, lesson_id: str, kind: str) -> list[dict[str, Any]]:
        rows = self._all("SELECT payload FROM lesson_items WHERE lesson_id=? AND kind=? ORDER BY id", (lesson_id, kind))
        return [json.loads(r["payload"]) for r in rows]

    def lesson_words_live(self, lesson_id: str) -> list[VocabItem]:
        return [VocabItem(**p) for p in self.lesson_items(lesson_id, "word")]

    def lesson_homework_live(self, lesson_id: str) -> list[HomeworkTask]:
        return [HomeworkTask(**p) for p in self.lesson_items(lesson_id, "homework")]

    # -- словарь ученика ---------------------------------------------------------
    def add_words(self, owner: str, lesson_id: str | None, items: Iterable[VocabItem]) -> int:
        added = 0
        now = utcnow()
        with self._lock:
            for v in items:
                if not v.key:
                    continue
                exists = self._conn.execute("SELECT 1 FROM vocabulary WHERE owner=? AND key=?", (owner, v.key)).fetchone()
                self._conn.execute(
                    "INSERT INTO vocabulary(owner, lesson_id, word, key, translation, transcription, part_of_speech,"
                    " example, source, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
                    " ON CONFLICT(owner, key) DO UPDATE SET"
                    " translation=COALESCE(vocabulary.translation, excluded.translation),"
                    " transcription=COALESCE(vocabulary.transcription, excluded.transcription),"
                    " part_of_speech=COALESCE(vocabulary.part_of_speech, excluded.part_of_speech),"
                    " example=COALESCE(vocabulary.example, excluded.example)",
                    (owner, lesson_id, v.word, v.key, v.translation, v.transcription, v.part_of_speech, v.example,
                     v.source, now),
                )
                if not exists:
                    added += 1
            self._conn.commit()
        return added

    def known_words(self, owner: str, exclude_lesson: str | None = None) -> list[str]:
        if exclude_lesson:
            rows = self._all("SELECT word FROM vocabulary WHERE owner=? AND (lesson_id IS NULL OR lesson_id<>?)",
                             (owner, exclude_lesson))
        else:
            rows = self._all("SELECT word FROM vocabulary WHERE owner=?", (owner,))
        return [r["word"] for r in rows]

    def _vocab_rows(self, sql: str, params: Iterable[Any]) -> list[VocabItem]:
        return [VocabItem(word=r["word"], translation=r["translation"], transcription=r["transcription"],
                          part_of_speech=r["part_of_speech"], example=r["example"], source=r["source"] or "auto")
                for r in self._all(sql, params)]

    def words_between(self, owner: str, start: datetime, end: datetime) -> list[VocabItem]:
        return self._vocab_rows(
            "SELECT * FROM vocabulary WHERE owner=? AND created_at>=? AND created_at<? ORDER BY id",
            (owner, start.astimezone(timezone.utc).isoformat(timespec="seconds"),
             end.astimezone(timezone.utc).isoformat(timespec="seconds")),
        )

    def words_on_day(self, owner: str, day: date, tz: ZoneInfo) -> list[VocabItem]:
        start = datetime.combine(day, time.min, tzinfo=tz)
        return self.words_between(owner, start, start + timedelta(days=1))

    def words_for_lesson(self, owner: str, lesson_id: str) -> list[VocabItem]:
        return self._vocab_rows("SELECT * FROM vocabulary WHERE owner=? AND lesson_id=? ORDER BY id", (owner, lesson_id))

    def all_words(self, owner: str) -> list[VocabItem]:
        return self._vocab_rows("SELECT * FROM vocabulary WHERE owner=? ORDER BY id", (owner,))

    # -- отчёты -------------------------------------------------------------------
    def save_report(self, lesson_id: str, report: LessonReport) -> None:
        self._exec("INSERT INTO reports(lesson_id, payload, created_at) VALUES (?,?,?)"
                   " ON CONFLICT(lesson_id) DO UPDATE SET payload=excluded.payload, created_at=excluded.created_at",
                   (lesson_id, report.model_dump_json(), utcnow()))

    def get_report(self, lesson_id: str) -> LessonReport | None:
        row = self._one("SELECT payload FROM reports WHERE lesson_id=?", (lesson_id,))
        return LessonReport.model_validate_json(row["payload"]) if row else None

    # -- нарушения ----------------------------------------------------------------
    def add_incident(self, *, lesson_id: str | None, chat_id: str | None, user_id: str | None, user_name: str | None,
                     role: Role, severity: str, action: str, summary: str, original_text: str, redacted_text: str,
                     findings: list[dict[str, Any]]) -> int:
        cur = self._exec(
            "INSERT INTO incidents(lesson_id, chat_id, user_id, user_name, role, severity, action, summary,"
            " original_text, redacted_text, findings, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (lesson_id, chat_id, user_id, user_name, role.value, severity, action, summary, original_text,
             redacted_text, json.dumps(findings, ensure_ascii=False), utcnow()),
        )
        return int(cur.lastrowid or 0)

    def incidents(self, lesson_id: str | None = None, user_id: str | None = None, chat_id: str | None = None,
                  limit: int = 50) -> list[dict[str, Any]]:
        cond, params = [], []
        for col, val in (("lesson_id", lesson_id), ("user_id", user_id), ("chat_id", chat_id)):
            if val is not None:
                cond.append(f"{col}=?")
                params.append(val)
        where = " AND ".join(cond) or "1=1"
        rows = self._all(f"SELECT * FROM incidents WHERE {where} ORDER BY id DESC LIMIT ?", params + [int(limit)])
        for r in rows:
            r["findings"] = json.loads(r["findings"])
        return rows

    def incident_count(self, lesson_id: str | None = None, user_id: str | None = None, min_severity: str = "medium") -> int:
        levels = {"low": ("low", "medium", "high"), "medium": ("medium", "high"), "high": ("high",)}[min_severity]
        cond, params = [f"severity IN ({','.join('?' * len(levels))})"], list(levels)
        if lesson_id is not None:
            cond.append("lesson_id=?")
            params.append(lesson_id)
        if user_id is not None:
            cond.append("user_id=?")
            params.append(user_id)
        row = self._one(f"SELECT COUNT(*) AS n FROM incidents WHERE {' AND '.join(cond)}", params)
        return int(row["n"]) if row else 0
