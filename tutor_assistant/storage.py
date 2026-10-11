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
    created_at TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'text'
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

-- Запись урока: когда пришёл последний фрагмент аудио (для контроля перерывов)
CREATE TABLE IF NOT EXISTS recordings (
    lesson_id TEXT PRIMARY KEY REFERENCES lessons(id),
    required INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    last_chunk_at TEXT,
    chunks INTEGER NOT NULL DEFAULT 0,
    seconds REAL NOT NULL DEFAULT 0,
    gap_alerted_at TEXT
);

-- Родители: получают отчёты об уроках чата/пары (по ссылке-приглашению от школы)
CREATE TABLE IF NOT EXISTS parent_invites (
    code TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    student_name TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    uses INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER NOT NULL DEFAULT 2
);
CREATE TABLE IF NOT EXISTS parent_subscriptions (
    chat_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (chat_id, user_id)
);

-- Анонимный мост: преподаватель и ученик общаются только через бота
CREATE TABLE IF NOT EXISTS pairs (
    id TEXT PRIMARY KEY,
    tutor_alias TEXT NOT NULL,
    student_alias TEXT NOT NULL,
    tutor_user_id TEXT,
    student_user_id TEXT,
    tutor_code TEXT NOT NULL UNIQUE,
    student_code TEXT NOT NULL UNIQUE,
    created_by TEXT,
    created_at TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_pairs_tutor ON pairs(tutor_user_id);
CREATE INDEX IF NOT EXISTS idx_pairs_student ON pairs(student_user_id);

CREATE TABLE IF NOT EXISTS relay_current (
    user_id TEXT PRIMARY KEY,
    pair_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS relay_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair_id TEXT NOT NULL,
    src_chat TEXT NOT NULL,
    src_msg INTEGER NOT NULL,
    dst_chat TEXT NOT NULL,
    dst_msg INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_relay_dst ON relay_messages(dst_chat, dst_msg);
CREATE INDEX IF NOT EXISTS idx_relay_src ON relay_messages(src_chat, src_msg);

-- Сайт школы: заявки, доступ в личный кабинет, ссылки на класс ProgressMe, доска
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT NOT NULL,
    course_id TEXT,
    level TEXT,
    goal TEXT,
    comment TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    ip TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_tokens (
    token_hash TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classrooms (
    chat_id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    updated_by TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_boards_chat ON boards(chat_id);

CREATE TABLE IF NOT EXISTS board_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    author_role TEXT NOT NULL,
    kind TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_board_items ON board_items(board_id, id);
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
            self._migrate()
            self._conn.commit()

    def _migrate(self) -> None:
        """Новые столбцы для баз, созданных прошлыми версиями."""
        cols = {r[1] for r in self._conn.execute("PRAGMA table_info(messages)").fetchall()}
        if "source" not in cols:  # text — набрано в чате, speech — расшифровка речи
            self._conn.execute("ALTER TABLE messages ADD COLUMN source TEXT NOT NULL DEFAULT 'text'")

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
                    created_at: str | None = None, source: str = "text") -> int:
        cur = self._exec(
            "INSERT INTO messages(lesson_id, speaker_id, speaker_name, role, text, created_at, source)"
            " VALUES (?,?,?,?,?,?,?)",
            (lesson_id, speaker_id, speaker_name, role.value, text, created_at or utcnow(), source),
        )
        return int(cur.lastrowid or 0)

    def lesson_utterances(self, lesson_id: str) -> list[Utterance]:
        rows = self._all("SELECT * FROM messages WHERE lesson_id=? ORDER BY id", (lesson_id,))
        return [Utterance(r["speaker_name"] or r["speaker_id"] or "—", Role(r["role"]), r["text"], r["created_at"])
                for r in rows]

    def messages_since(self, lesson_id: str, since: int = 0, limit: int = 300) -> list[dict[str, Any]]:
        """Реплики урока (уже без контактов) — для чата и живой расшифровки в онлайн-классе."""
        return self._all("SELECT id, speaker_name, role, text, created_at, source FROM messages "
                         "WHERE lesson_id=? AND id>? ORDER BY id LIMIT ?", (lesson_id, since, limit))

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

    # -- анонимный мост -------------------------------------------------------------
    def create_pair(self, pair_id: str, tutor_alias: str, student_alias: str, tutor_code: str, student_code: str,
                    created_by: str | None) -> dict[str, Any]:
        self._exec("INSERT INTO pairs(id, tutor_alias, student_alias, tutor_code, student_code, created_by, created_at)"
                   " VALUES (?,?,?,?,?,?,?)",
                   (pair_id, tutor_alias, student_alias, tutor_code, student_code, created_by, utcnow()))
        return self.get_pair(pair_id)  # type: ignore[return-value]

    def get_pair(self, pair_id: str) -> dict[str, Any] | None:
        return self._one("SELECT * FROM pairs WHERE id=?", (pair_id,))

    def pair_by_code(self, code: str) -> tuple[dict[str, Any], str] | None:
        row = self._one("SELECT * FROM pairs WHERE tutor_code=?", (code,))
        if row:
            return row, "tutor"
        row = self._one("SELECT * FROM pairs WHERE student_code=?", (code,))
        return (row, "student") if row else None

    def bind_pair_user(self, pair_id: str, role: str, user_id: str) -> None:
        column = "tutor_user_id" if role == "tutor" else "student_user_id"
        self._exec(f"UPDATE pairs SET {column}=? WHERE id=?", (user_id, pair_id))

    def deactivate_pair(self, pair_id: str) -> bool:
        return bool(self._exec("UPDATE pairs SET active=0 WHERE id=? AND active=1", (pair_id,)).rowcount)

    def pairs_for_user(self, user_id: str) -> list[dict[str, Any]]:
        return self._all("SELECT * FROM pairs WHERE active=1 AND (tutor_user_id=? OR student_user_id=?)"
                         " ORDER BY created_at, rowid", (user_id, user_id))

    def list_pairs(self, include_inactive: bool = False, limit: int = 100) -> list[dict[str, Any]]:
        where = "" if include_inactive else "WHERE active=1"
        return self._all(f"SELECT * FROM pairs {where} ORDER BY created_at DESC, rowid DESC LIMIT ?", (int(limit),))

    def set_current_pair(self, user_id: str, pair_id: str) -> None:
        self._exec("INSERT INTO relay_current(user_id, pair_id) VALUES (?,?)"
                   " ON CONFLICT(user_id) DO UPDATE SET pair_id=excluded.pair_id", (user_id, pair_id))

    def current_pair_id(self, user_id: str) -> str | None:
        row = self._one("SELECT pair_id FROM relay_current WHERE user_id=?", (user_id,))
        return row["pair_id"] if row else None

    def add_relay_message(self, pair_id: str, src_chat: str, src_msg: int, dst_chat: str, dst_msg: int) -> None:
        self._exec("INSERT INTO relay_messages(pair_id, src_chat, src_msg, dst_chat, dst_msg, created_at)"
                   " VALUES (?,?,?,?,?,?)", (pair_id, src_chat, int(src_msg), dst_chat, int(dst_msg), utcnow()))

    def relay_by_dst(self, dst_chat: str, dst_msg: int) -> dict[str, Any] | None:
        return self._one("SELECT * FROM relay_messages WHERE dst_chat=? AND dst_msg=? ORDER BY id DESC LIMIT 1",
                         (dst_chat, int(dst_msg)))

    def relay_by_src(self, src_chat: str, src_msg: int) -> list[dict[str, Any]]:
        return self._all("SELECT * FROM relay_messages WHERE src_chat=? AND src_msg=? ORDER BY id",
                         (src_chat, int(src_msg)))

    # -- запись урока -----------------------------------------------------------------
    def ensure_recording(self, lesson_id: str, required: bool = False, at: datetime | None = None) -> None:
        when = _iso(at)
        self._exec("INSERT INTO recordings(lesson_id, required, started_at) VALUES (?,?,?)"
                   " ON CONFLICT(lesson_id) DO UPDATE SET required=MAX(recordings.required, excluded.required)",
                   (lesson_id, int(required), when))

    def touch_recording(self, lesson_id: str, seconds: float, at: datetime | None = None) -> None:
        when = _iso(at)
        self.ensure_recording(lesson_id, at=at)
        self._exec("UPDATE recordings SET chunks=chunks+1, seconds=seconds+?, last_chunk_at=? WHERE lesson_id=?",
                   (float(seconds or 0), when, lesson_id))

    def get_recording(self, lesson_id: str) -> dict[str, Any] | None:
        return self._one("SELECT * FROM recordings WHERE lesson_id=?", (lesson_id,))

    def active_recordings(self) -> list[dict[str, Any]]:
        return self._all("SELECT r.*, l.chat_id, l.tutor_id, l.tutor_name, l.student_id, l.title FROM recordings r"
                         " JOIN lessons l ON l.id = r.lesson_id WHERE l.status='active'")

    def claim_gap_alert(self, lesson_id: str, reference: str, at: datetime | None = None) -> bool:
        """Отметить, что о перерыве уже сообщили (атомарно — без дублей, даже если работают и бот, и API)."""
        cur = self._exec("UPDATE recordings SET gap_alerted_at=? WHERE lesson_id=?"
                         " AND (gap_alerted_at IS NULL OR gap_alerted_at < ?)", (_iso(at), lesson_id, reference))
        return cur.rowcount == 1


    # -- история уроков ученика -------------------------------------------------------
    def previous_finished_lesson(self, lesson: dict[str, Any]) -> dict[str, Any] | None:
        """Прошлый завершённый урок того же ученика (или того же чата, если ученик неизвестен)."""
        if lesson.get("student_id"):
            cond, val = "student_id=?", lesson["student_id"]
        elif lesson.get("chat_id"):
            cond, val = "chat_id=?", lesson["chat_id"]
        else:
            return None
        return self._one(f"SELECT * FROM lessons WHERE {cond} AND status='finished' AND id<>?"
                         " ORDER BY started_at DESC, rowid DESC LIMIT 1", (val, lesson["id"]))

    def finished_lessons_count(self, lesson: dict[str, Any]) -> int:
        if lesson.get("student_id"):
            cond, val = "student_id=?", lesson["student_id"]
        elif lesson.get("chat_id"):
            cond, val = "chat_id=?", lesson["chat_id"]
        else:
            return 0
        row = self._one(f"SELECT COUNT(*) AS n FROM lessons WHERE {cond} AND status='finished' AND id<>?",
                        (val, lesson["id"]))
        return int(row["n"]) if row else 0

    # -- родители ---------------------------------------------------------------------
    def create_parent_invite(self, code: str, chat_id: str, student_name: str | None, created_by: str | None,
                             max_uses: int = 2) -> None:
        self._exec("INSERT INTO parent_invites(code, chat_id, student_name, created_by, created_at, max_uses)"
                   " VALUES (?,?,?,?,?,?)", (code, chat_id, student_name, created_by, utcnow(), max_uses))

    def use_parent_invite(self, code: str, user_id: str) -> dict[str, Any] | None:
        """Подписать родителя по коду. None — код неизвестен или исчерпан."""
        with self._lock:
            row = self._conn.execute("SELECT * FROM parent_invites WHERE code=?", (code,)).fetchone()
            if not row:
                return None
            invite = dict(row)
            already = self._conn.execute("SELECT 1 FROM parent_subscriptions WHERE chat_id=? AND user_id=?",
                                         (invite["chat_id"], user_id)).fetchone()
            if not already:
                if invite["uses"] >= invite["max_uses"]:
                    return None
                self._conn.execute("UPDATE parent_invites SET uses=uses+1 WHERE code=?", (code,))
                self._conn.execute("INSERT INTO parent_subscriptions(chat_id, user_id, created_at) VALUES (?,?,?)",
                                   (invite["chat_id"], user_id, utcnow()))
                self._conn.commit()
            return invite

    def parents_for(self, chat_id: str) -> list[str]:
        return [r["user_id"] for r in self._all("SELECT user_id FROM parent_subscriptions WHERE chat_id=? ORDER BY rowid",
                                                (chat_id,))]

    def parent_chats(self, user_id: str) -> list[str]:
        return [r["chat_id"] for r in self._all("SELECT chat_id FROM parent_subscriptions WHERE user_id=? ORDER BY rowid",
                                                (user_id,))]

    def remove_parent(self, chat_id: str, user_id: str) -> bool:
        return bool(self._exec("DELETE FROM parent_subscriptions WHERE chat_id=? AND user_id=?",
                               (chat_id, user_id)).rowcount)

    # -- сайт: заявки ---------------------------------------------------------------
    def add_application(self, *, name: str, contact: str, course_id: str | None, level: str | None, goal: str | None,
                        comment: str | None, ip: str | None) -> int:
        cur = self._exec("INSERT INTO applications(name, contact, course_id, level, goal, comment, ip, created_at)"
                         " VALUES (?,?,?,?,?,?,?,?)", (name, contact, course_id, level, goal, comment, ip, utcnow()))
        return int(cur.lastrowid)

    def applications(self, status: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
        if status:
            return self._all("SELECT * FROM applications WHERE status=? ORDER BY id DESC LIMIT ?", (status, limit))
        return self._all("SELECT * FROM applications ORDER BY id DESC LIMIT ?", (limit,))

    def set_application_status(self, app_id: int, status: str) -> bool:
        return bool(self._exec("UPDATE applications SET status=? WHERE id=?", (status, app_id)).rowcount)

    def applications_since(self, ip: str, since: datetime) -> int:
        row = self._one("SELECT COUNT(*) AS n FROM applications WHERE ip=? AND created_at>=?", (ip, _iso(since)))
        return int(row["n"]) if row else 0

    # -- сайт: доступ в личный кабинет --------------------------------------------------
    def add_access_token(self, token_hash: str, role: str, user_id: str, expires_at: datetime) -> None:
        self._exec("INSERT INTO access_tokens(token_hash, role, user_id, created_at, expires_at) VALUES (?,?,?,?,?)",
                   (token_hash, role, user_id, utcnow(), _iso(expires_at)))

    def get_access_token(self, token_hash: str) -> dict[str, Any] | None:
        return self._one("SELECT * FROM access_tokens WHERE token_hash=? AND expires_at>?", (token_hash, utcnow()))

    def revoke_access_tokens(self, user_id: str) -> int:
        return self._exec("DELETE FROM access_tokens WHERE user_id=?", (user_id,)).rowcount

    def purge_access_tokens(self) -> None:
        self._exec("DELETE FROM access_tokens WHERE expires_at<=?", (utcnow(),))

    # -- сайт: класс на платформе уроков --------------------------------------------------
    def set_classroom(self, chat_id: str, url: str | None, updated_by: str | None) -> None:
        if url is None:
            self._exec("DELETE FROM classrooms WHERE chat_id=?", (chat_id,))
            return
        self._exec("INSERT INTO classrooms(chat_id, url, updated_by, updated_at) VALUES (?,?,?,?) "
                   "ON CONFLICT(chat_id) DO UPDATE SET url=excluded.url, updated_by=excluded.updated_by, "
                   "updated_at=excluded.updated_at", (chat_id, url, updated_by, utcnow()))

    def get_classroom(self, chat_id: str) -> str | None:
        row = self._one("SELECT url FROM classrooms WHERE chat_id=?", (chat_id,))
        return row["url"] if row else None

    # -- сайт: доска ----------------------------------------------------------------------
    def create_board(self, board_id: str, chat_id: str, title: str, created_by: str | None) -> dict[str, Any]:
        self._exec("INSERT INTO boards(id, chat_id, title, created_by, created_at) VALUES (?,?,?,?,?)",
                   (board_id, chat_id, title, created_by, utcnow()))
        return self.get_board(board_id)  # type: ignore[return-value]

    def get_board(self, board_id: str) -> dict[str, Any] | None:
        return self._one("SELECT * FROM boards WHERE id=?", (board_id,))

    def boards_for(self, chat_id: str) -> list[dict[str, Any]]:
        return self._all("SELECT * FROM boards WHERE chat_id=? ORDER BY created_at, id", (chat_id,))

    def add_board_item(self, board_id: str, author_role: str, kind: str, data: dict[str, Any]) -> int:
        cur = self._exec("INSERT INTO board_items(board_id, author_role, kind, data, created_at) VALUES (?,?,?,?,?)",
                         (board_id, author_role, kind, json.dumps(data, ensure_ascii=False), utcnow()))
        return int(cur.lastrowid)

    def board_items(self, board_id: str, since: int = 0, limit: int = 2000) -> list[dict[str, Any]]:
        rows = self._all("SELECT id, author_role, kind, data FROM board_items WHERE board_id=? AND id>? "
                         "ORDER BY id LIMIT ?", (board_id, since, limit))
        for r in rows:
            r["data"] = json.loads(r["data"])
        return rows

    def board_item_count(self, board_id: str) -> int:
        row = self._one("SELECT COUNT(*) AS n FROM board_items WHERE board_id=?", (board_id,))
        return int(row["n"]) if row else 0

    def lessons_for_chats(self, chat_ids: Iterable[str], limit: int = 100) -> list[dict[str, Any]]:
        ids = list(chat_ids)
        if not ids:
            return []
        marks = ",".join("?" * len(ids))
        return self._all(f"SELECT * FROM lessons WHERE chat_id IN ({marks}) ORDER BY started_at DESC LIMIT ?",
                         (*ids, limit))


def _iso(at: datetime | None) -> str:
    return (at or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat(timespec="seconds")
