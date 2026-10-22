"""Учебные инструменты: материалы, домашние задания, карточки слов с интервальным повторением.

* **Материалы** — файлы (PDF, картинки, презентации, аудио, видео) и ссылки. Видео VK, YouTube
  и Rutube встраиваются плеером прямо в урок и на доску — без демонстрации экрана.
  Свои материалы у репетитора, общая база — у школы. Перенос с ProgressMe: выгрузите материалы
  файлами и перетащите их сюда пачкой.
* **Домашние задания** выдаёт преподаватель; ученик отмечает выполнение и пишет ответ,
  родитель видит статус.
* **Карточки**: новые слова урока сразу попадают в колоду. Повторение по алгоритму SM-2
  (кривая забывания): «не помню» — через 10 минут, дальше 1 день, 3 дня и всё реже.
"""

from __future__ import annotations

import re
import secrets
import tempfile
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .models import word_key
from .portal import PARENT, Portal, PortalError, Viewer, _field
from .relay import STUDENT, TUTOR

MAX_FILE = 25 * 1024 * 1024
ALLOWED_TYPES = {
    "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif",
    "application/pdf": ".pdf", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/ogg": ".ogg", "audio/wav": ".wav",
    "video/mp4": ".mp4", "video/webm": ".webm",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/plain": ".txt",
}
INLINE = ("image/", "application/pdf", "audio/", "video/")
FILE_ID_RE = re.compile(r"^[0-9a-f]{24}$")
NEW_CARDS_PER_SESSION = 10
GRADES = {"again": 1, "hard": 3, "good": 4, "easy": 5}


def video_embed(url: str) -> str | None:
    """Ссылка на видео → адрес встроенного плеера (VK Видео, YouTube, Rutube)."""
    try:
        p = urllib.parse.urlparse(url.strip())
    except ValueError:
        return None
    host = (p.hostname or "").lower().removeprefix("www.").removeprefix("m.")
    if host in ("vk.com", "vkvideo.ru", "vk.ru"):
        m = re.search(r"video(-?\d+)_(\d+)", url)
        if m:
            return f"https://vk.com/video_ext.php?oid={m.group(1)}&id={m.group(2)}&hd=2"
    if host in ("youtube.com", "youtu.be"):
        vid = urllib.parse.parse_qs(p.query).get("v", [None])[0] if host == "youtube.com" else p.path.strip("/")
        if host == "youtube.com" and p.path.startswith("/shorts/"):
            vid = p.path.split("/")[2]
        if vid and re.match(r"^[\w-]{6,20}$", vid):
            return f"https://www.youtube-nocookie.com/embed/{vid}"
    if host == "rutube.ru":
        m = re.search(r"/video/([0-9a-f]{20,40})", p.path)
        if m:
            return f"https://rutube.ru/play/embed/{m.group(1)}"
    return None


def sm2(card: dict[str, Any] | None, grade: str, now: datetime) -> dict[str, Any]:
    """Следующее повторение по SM-2 (как в Anki/ReWord)."""
    q = GRADES[grade]
    ease = card["ease"] if card else 2.5
    reps = card["reps"] if card else 0
    interval = card["interval_days"] if card else 0.0
    lapses = card["lapses"] if card else 0
    if q < 3:
        reps, lapses, interval = 0, lapses + 1, 10 / 1440  # снова через 10 минут
    else:
        reps += 1
        interval = 1.0 if reps == 1 else 3.0 if reps == 2 else round(interval * ease, 2)
        if q == 5:
            interval = round(interval * 1.3, 2)
    ease = max(1.3, round(ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02), 3))
    return {"ease": ease, "reps": reps, "lapses": lapses, "interval_days": interval,
            "due": (now + timedelta(days=interval)).isoformat(timespec="seconds"),
            "last_review": now.isoformat(timespec="seconds")}


class Learning:
    def __init__(self, portal: Portal, files_dir: str | Path | None = None):
        self.portal = portal
        self.storage = portal.storage
        self.assistant = portal.assistant
        db = portal.settings.db_path
        default = Path(tempfile.gettempdir()) / "better-files" if db == ":memory:" else Path(db).parent / "files"
        self.files_dir = Path(files_dir) if files_dir else default
        self.files_dir.mkdir(parents=True, exist_ok=True)

    def _account(self, viewer: Viewer) -> dict[str, Any]:
        acc = self.storage.get_account(viewer.user_id)
        if not acc:
            raise PortalError(403, "войдите в аккаунт сайта")
        return acc

    # == материалы ===================================================================
    def _material_owner(self, viewer: Viewer) -> dict[str, Any]:
        acc = self._account(viewer)
        if acc["role"] not in ("tutor", "school"):
            raise PortalError(403, "материалы добавляют преподаватели и школы")
        return acc

    def materials(self, viewer: Viewer) -> dict[str, Any]:
        acc = self._material_owner(viewer)
        rows = self.storage.materials_for(acc["id"], acc.get("org_id"))
        return {"materials": [self._public_material(r, acc) for r in rows]}

    def _public_material(self, r: dict[str, Any], acc: dict[str, Any] | None = None) -> dict[str, Any]:
        data = {k: r[k] for k in ("id", "title", "kind", "mime", "size", "folder", "created_at")}
        if r["kind"] == "file":
            data["url"] = f"/site/v1/files/{r['id']}"
        else:
            data["url"] = r["url"]
            data["embed"] = video_embed(r["url"]) if r["kind"] == "video" else None
        data["shared"] = bool(r.get("org_id"))
        data["mine"] = bool(acc and r["owner_id"] == acc["id"])
        return data

    def upload(self, viewer: Viewer, raw: bytes | None, headers: Any) -> dict[str, Any]:
        acc = self._material_owner(viewer)
        if not raw:
            raise PortalError(400, "пустой файл")
        if len(raw) > MAX_FILE:
            raise PortalError(413, "файл больше 25 МБ")
        mime = (headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if mime not in ALLOWED_TYPES:
            raise PortalError(415, "формат не поддерживается: картинки, PDF, презентации, документы, аудио и видео")
        if mime.startswith("image/") and not _looks_like_image(raw):
            raise PortalError(415, "файл не похож на картинку")
        title = urllib.parse.unquote(headers.get("X-File-Name") or "файл")[:120] or "файл"
        folder = urllib.parse.unquote(headers.get("X-Folder") or "")[:60] or None
        file_id = secrets.token_hex(12)
        (self.files_dir / (file_id + ALLOWED_TYPES[mime])).write_bytes(raw)
        shared = acc["role"] == "school" or (headers.get("X-Shared") == "1" and acc.get("org_id"))
        row = self.storage.add_material(id=file_id, owner_id=acc["id"], org_id=acc.get("org_id") if shared else None,
                                        title=title, kind="file", mime=mime, size=len(raw), folder=folder)
        return self._public_material(row, acc)

    def add_link(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        acc = self._material_owner(viewer)
        if not isinstance(body, dict):
            raise PortalError(400, "нужен JSON-объект")
        url = _field(body, "url", 500, required=True)
        p = urllib.parse.urlparse(url)
        if p.scheme not in ("https", "http") or not p.hostname:
            raise PortalError(400, "ссылка должна начинаться с https://")
        kind = "video" if video_embed(url) else "link"
        title = _field(body, "title", 120) or (p.hostname or url)
        shared = acc["role"] == "school" or (body.get("shared") and acc.get("org_id"))
        row = self.storage.add_material(id=secrets.token_hex(12), owner_id=acc["id"],
                                        org_id=acc.get("org_id") if shared else None, title=title, kind=kind, url=url,
                                        folder=_field(body, "folder", 60))
        return self._public_material(row, acc)

    def delete_material(self, viewer: Viewer, material_id: str) -> dict[str, Any]:
        acc = self._material_owner(viewer)
        row = self.storage.get_material(material_id)
        if not row or (row["owner_id"] != acc["id"] and not (acc["role"] == "school" and row["org_id"] == acc["org_id"])):
            raise PortalError(404, "материал не найден")
        if row["kind"] == "file":
            for f in self.files_dir.glob(material_id + ".*"):
                f.unlink(missing_ok=True)
        self.storage.delete_material(material_id)
        return {"ok": True}

    def file(self, file_id: str) -> tuple[bytes, str, str]:
        """Файл по секретному id (адрес знают только те, кому показали материал)."""
        if not FILE_ID_RE.match(file_id):
            raise PortalError(404, "не найдено")
        row = self.storage.get_material(file_id)
        if not row or row["kind"] != "file":
            raise PortalError(404, "не найдено")
        path = self.files_dir / (file_id + ALLOWED_TYPES.get(row["mime"], ""))
        if not path.is_file():
            raise PortalError(404, "не найдено")
        disposition = "inline" if row["mime"].startswith(INLINE) else "attachment"
        name = urllib.parse.quote(row["title"])
        return path.read_bytes(), row["mime"], f"{disposition}; filename*=UTF-8''{name}"

    # == домашние задания =============================================================
    def assign(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        if not isinstance(body, dict) or not isinstance(body.get("chat_id"), str):
            raise PortalError(400, "нужно поле chat_id")
        access = self.portal._access(viewer, body["chat_id"])
        if access.role != TUTOR or not access.pair:
            raise PortalError(403, "домашнее задание выдаёт преподаватель")
        text = _field(body, "text", 3000, required=True)
        if self.portal.is_strict(access.chat_id) and self.assistant.moderate(text).blocked:
            raise PortalError(422, "в задании не должно быть контактов")
        materials = [m for m in (body.get("materials") or []) if isinstance(m, str) and self.storage.get_material(m)][:10]
        due = _field(body, "due", 20)
        assignment_id = self.storage.add_assignment(access.chat_id, text, materials, due)
        pair = access.pair
        link = f"\n{self.portal.settings.site_url}/#/app/homework" if self.portal.settings.site_url else ""
        self.portal.telegram(pair.student_user_id, f"📝 Новое домашнее задание от {pair.tutor_alias}:\n{text[:800]}{link}")
        for parent in self.storage.parents_for(access.chat_id):
            self.portal.telegram(parent, f"📝 {pair.student_alias} получил домашнее задание:\n{text[:800]}")
        return {"id": assignment_id}

    def homework(self, viewer: Viewer) -> dict[str, Any]:
        accesses = [a for a in self.portal.accesses(viewer) if a.pair]
        by_chat = {a.chat_id: a for a in accesses}
        rows = self.storage.assignments(by_chat.keys())
        out = []
        for r in rows:
            a = by_chat[r["chat_id"]]
            mats = [self._public_material(m) for m in (self.storage.get_material(x) for x in r["materials"]) if m]
            out.append({**{k: r[k] for k in ("id", "chat_id", "text", "due", "status", "answer", "created_at", "done_at")},
                        "materials": mats, "role": a.role,
                        "student": a.pair.student_alias, "tutor": a.pair.tutor_alias})
        return {"homework": out}

    def update_homework(self, viewer: Viewer, assignment_id: int, body: Any) -> dict[str, Any]:
        row = self.storage.get_assignment(assignment_id)
        if not row:
            raise PortalError(404, "задание не найдено")
        access = self.portal._access(viewer, row["chat_id"])
        status = body.get("status") if isinstance(body, dict) else None
        if access.role == STUDENT and status in ("done", "open"):
            answer = _field(body, "answer", 3000)
            if answer and self.portal.is_strict(row["chat_id"]) and self.assistant.moderate(answer).blocked:
                raise PortalError(422, "в ответе не должно быть контактов")
            self.storage.update_assignment(assignment_id, status=status, answer=answer,
                                           done_at=datetime.now(timezone.utc).isoformat(timespec="seconds"))
            if status == "done":
                self.portal.telegram(access.pair.tutor_user_id,
                                     f"✅ {access.pair.student_alias} выполнил домашнее задание: {row['text'][:120]}")
        elif access.role == TUTOR and status in ("checked", "open"):
            self.storage.update_assignment(assignment_id, status=status)
        else:
            raise PortalError(403, "нельзя изменить это задание")
        return {"id": assignment_id, "status": status}

    # == карточки слов ==================================================================
    def _student_words(self, viewer: Viewer) -> list[dict[str, Any]]:
        if not any(a.role == STUDENT for a in self.portal.accesses(viewer)):
            raise PortalError(403, "карточки — для учеников")
        return self.portal.words(viewer)["words"]

    def cards(self, viewer: Viewer, now: datetime | None = None) -> dict[str, Any]:
        now = now or datetime.now(timezone.utc)
        words = self._student_words(viewer)
        state = self.storage.srs_cards(f"srs:{viewer.user_id}")
        due, new, learned = [], [], 0
        for w in words:
            key = word_key(w["word"])
            card = state.get(key)
            item = {**w, "key": key, "reps": card["reps"] if card else 0,
                    "interval_days": card["interval_days"] if card else 0}
            if not card:
                new.append(item)
            else:
                if card["interval_days"] >= 21:
                    learned += 1
                if datetime.fromisoformat(card["due"]) <= now:
                    due.append(item)
        queue = due + new[:NEW_CARDS_PER_SESSION]
        return {"queue": queue, "stats": {"total": len(words), "due": len(due), "new": len(new), "learned": learned}}

    def review(self, viewer: Viewer, body: Any, now: datetime | None = None) -> dict[str, Any]:
        now = now or datetime.now(timezone.utc)
        if not isinstance(body, dict) or body.get("grade") not in GRADES or not isinstance(body.get("key"), str):
            raise PortalError(400, "нужны key и grade: again, hard, good, easy")
        keys = {word_key(w["word"]) for w in self._student_words(viewer)}
        if body["key"] not in keys:
            raise PortalError(404, "слово не найдено в словаре")
        owner = f"srs:{viewer.user_id}"
        card = self.storage.srs_cards(owner).get(body["key"])
        nxt = sm2(card, body["grade"], now)
        self.storage.save_srs_card(owner, body["key"], **nxt)
        return {"key": body["key"], **nxt}

    def child_stats(self, viewer: Viewer) -> list[dict[str, Any]]:
        """Для родителя: сколько слов ребёнок уже выучил по карточкам."""
        out = []
        for a in self.portal.accesses(viewer):
            if a.role == PARENT and a.pair and a.pair.student_user_id:
                state = self.storage.srs_cards(f"srs:{a.pair.student_user_id}")
                out.append({"chat_id": a.chat_id, "learned": sum(1 for c in state.values() if c["interval_days"] >= 21),
                            "studied": len(state)})
        return out


def _looks_like_image(raw: bytes) -> bool:
    return raw[:8].startswith(b"\x89PNG") or raw[:3] == b"\xff\xd8\xff" or raw[:4] == b"GIF8" or \
        (raw[:4] == b"RIFF" and raw[8:12] == b"WEBP")


