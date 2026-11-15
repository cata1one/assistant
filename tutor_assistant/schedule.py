"""Private teacher timetable; dates are stored as UTC instants."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from .portal import Portal, PortalError, Viewer
from .storage import utcnow


def _instant(value: Any) -> datetime:
    if not isinstance(value, str) or len(value) > 40:
        raise PortalError(400, "Укажите дату и время с часовым поясом.")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if result.tzinfo is None or result.utcoffset() is None or not 2000 <= result.year <= 2100:
            raise ValueError
        return result.astimezone(timezone.utc).replace(microsecond=0)
    except (ValueError, OverflowError):
        raise PortalError(400, "Укажите корректные дату и время с часовым поясом.") from None


def _iso(value: datetime) -> str:
    return value.isoformat(timespec="seconds")


class Schedule:
    def __init__(self, portal: Portal):
        self.portal = portal
        self.storage = portal.storage

    def _teacher(self, viewer: Viewer) -> str:
        account = self.storage.get_account(viewer.user_id) if viewer.user_id.startswith("a_") else None
        if not account or account["role"] != "tutor":
            raise PortalError(403, "Расписание доступно преподавателю.")
        return account["id"]

    def list(self, viewer: Viewer, query: dict[str, str]) -> dict[str, Any]:
        owner = self._teacher(viewer)
        now = datetime.now(timezone.utc)
        start = _instant(query["from"]) if query.get("from") else now - timedelta(days=1)
        end = _instant(query["to"]) if query.get("to") else now + timedelta(days=30)
        if end <= start or end - start > timedelta(days=93):
            raise PortalError(400, "Выберите период до 93 дней.")
        rows = self.storage._all(
            "SELECT s.id, s.pair_id, s.group_id, s.title, s.starts_at, s.ends_at, s.note, "
            "p.student_alias, p.student_user_id, p.active AS pair_active, g.title AS group_title "
            "FROM teacher_schedule s LEFT JOIN pairs p ON p.id=s.pair_id AND p.tutor_user_id=s.owner_id "
            "LEFT JOIN study_groups g ON g.id=s.group_id AND g.owner_id=s.owner_id "
            "WHERE s.owner_id=? AND s.starts_at<? AND s.ends_at>? ORDER BY s.starts_at, s.id LIMIT 501",
            (owner, _iso(end), _iso(start)),
        )
        items = []
        for row in rows[:500]:
            active = bool(row["pair_active"] and row["student_user_id"])
            items.append({"id": row["id"], "pair_id": row["pair_id"], "group_id": row["group_id"],
                          "title": row["title"], "starts_at": row["starts_at"], "ends_at": row["ends_at"],
                          "note": row["note"], "name": row["student_alias"] or row["group_title"] or "Удалённый ученик или класс",
                          "chat_id": f"pair:{row['pair_id']}" if active else None})
        return {"items": items, "truncated": len(rows) > 500}

    def save(self, viewer: Viewer, body: Any, event_id: str | None = None) -> dict[str, str]:
        owner = self._teacher(viewer)
        if not isinstance(body, dict):
            raise PortalError(400, "Укажите параметры занятия.")
        title = body.get("title")
        note = body.get("note", "")
        if not isinstance(title, str) or not title.strip() or len(title.strip()) > 120:
            raise PortalError(400, "Название занятия — от 1 до 120 символов.")
        if not isinstance(note, str) or len(note.strip()) > 500:
            raise PortalError(400, "Заметка — не более 500 символов.")
        pair_id, group_id = body.get("pair_id") or None, body.get("group_id") or None
        if bool(pair_id) == bool(group_id) or not isinstance(pair_id or group_id, str):
            raise PortalError(400, "Выберите ученика или класс.")
        start, end = _instant(body.get("starts_at")), _instant(body.get("ends_at"))
        if not timedelta(minutes=5) <= end - start <= timedelta(hours=8):
            raise PortalError(400, "Продолжительность занятия — от 5 минут до 8 часов.")
        editing = event_id is not None
        event_id = event_id or secrets.token_hex(12)
        with self.storage._lock:
            db = self.storage._conn
            try:
                exists = db.execute("SELECT id FROM teacher_schedule WHERE id=? AND owner_id=?", (event_id, owner)).fetchone()
                if editing and not exists:
                    raise PortalError(404, "Запись расписания не найдена.")
                if pair_id and not db.execute("SELECT 1 FROM pairs WHERE id=? AND tutor_user_id=? AND active=1", (pair_id, owner)).fetchone():
                    raise PortalError(404, "Ученик не найден.")
                if group_id and not db.execute("SELECT 1 FROM study_groups WHERE id=? AND owner_id=?", (group_id, owner)).fetchone():
                    raise PortalError(404, "Класс не найден.")
                conflict = db.execute("SELECT 1 FROM teacher_schedule WHERE owner_id=? AND id<>? AND starts_at<? AND ends_at>? LIMIT 1",
                                      (owner, event_id, _iso(end), _iso(start))).fetchone()
                if conflict:
                    raise PortalError(409, "На это время уже запланировано другое занятие.")
                now = utcnow()
                if exists:
                    db.execute("UPDATE teacher_schedule SET pair_id=?, group_id=?, title=?, starts_at=?, ends_at=?, note=?, updated_at=? WHERE id=? AND owner_id=?",
                               (pair_id, group_id, title.strip(), _iso(start), _iso(end), note.strip(), now, event_id, owner))
                else:
                    db.execute("INSERT INTO teacher_schedule(id, owner_id, pair_id, group_id, title, starts_at, ends_at, note, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
                               (event_id, owner, pair_id, group_id, title.strip(), _iso(start), _iso(end), note.strip(), now, now))
                db.commit()
            except Exception:
                db.rollback()
                raise
        return {"id": event_id}

    def delete(self, viewer: Viewer, event_id: str) -> dict[str, bool]:
        owner = self._teacher(viewer)
        result = self.storage._exec("DELETE FROM teacher_schedule WHERE id=? AND owner_id=?", (event_id, owner))
        if not result.rowcount:
            raise PortalError(404, "Запись расписания не найдена.")
        return {"ok": True}
