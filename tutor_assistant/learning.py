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

from . import billing
from .models import HomeworkTask, VocabItem, word_key
from .portal import PARENT, Portal, PortalError, Viewer, _field, _lines
from .relay import STUDENT, TUTOR
from .vocabulary import extract_announced

MAX_FILE = 25 * 1024 * 1024
MAX_ATTACHMENT = 10 * 1024 * 1024  # фото к домашнему заданию
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
    def _tutor_access(self, viewer: Viewer, chat_id: Any):
        if not isinstance(chat_id, str):
            raise PortalError(400, "нужно поле chat_id")
        access = self.portal._access(viewer, chat_id)
        if access.role != TUTOR or not access.pair:
            raise PortalError(403, "это делает преподаватель ученика")
        return access

    def _check_text(self, chat_id: str, *texts: str | None) -> None:
        if self.portal.is_strict(chat_id):
            for t in texts:
                if t and self.assistant.moderate(t).blocked:
                    raise PortalError(422, "в тексте не должно быть контактов")

    def assign(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        if not isinstance(body, dict):
            raise PortalError(400, "нужен JSON-объект")
        access = self._tutor_access(viewer, body.get("chat_id"))
        billing.require_active(self.storage, viewer.user_id)
        unit = None
        if body.get("unit_id"):
            from .units import Units  # занятия используют этот модуль — импорт здесь, без цикла
            unit = Units(self).accessible(viewer, str(body["unit_id"]))
        text = _lines(body, "text", 3000) or (f"Выполните занятие «{unit['title']}»" if unit else None)
        if not text:
            raise PortalError(400, "напишите задание")
        words_text = _lines(body, "words", 3000) or ""
        self._check_text(access.chat_id, text, words_text)
        materials = [m for m in (body.get("materials") or []) if isinstance(m, str) and self.storage.get_material(m)][:10]
        due = _field(body, "due", 20)
        assignment_id = self.storage.add_assignment(access.chat_id, text, materials, due, unit["id"] if unit else None)
        # Слова из задания сразу становятся карточками: список «новые слова: …» в тексте,
        # поле «Новые слова» и слова занятия
        from .units import parse_words, unit_words
        words = parse_words(words_text)
        found, _ = extract_announced(text)
        words += [{"word": w.word, "translation": w.translation} for w in found]
        if unit:
            words += unit_words(unit)
        added = self._save_words(access.chat_id, words, "homework")
        pair = access.pair
        link = f"\n{self.portal.settings.site_url}/#/app/homework" if self.portal.settings.site_url else ""
        self.portal.telegram(pair.student_user_id, f"📝 Новое домашнее задание от {pair.tutor_alias}:\n{text[:800]}{link}")
        for parent in self.storage.parents_for(access.chat_id):
            self.portal.telegram(parent, f"📝 {pair.student_alias} получил домашнее задание:\n{text[:800]}")
        return {"id": assignment_id, "words_added": added}

    def _public_file(self, file_id: str) -> dict[str, Any] | None:
        m = self.storage.get_material(file_id)
        return {"id": m["id"], "url": f"/site/v1/files/{m['id']}", "title": m["title"], "mime": m["mime"]} if m else None

    def homework(self, viewer: Viewer) -> dict[str, Any]:
        accesses = [a for a in self.portal.accesses(viewer) if a.pair]
        by_chat = {a.chat_id: a for a in accesses}
        rows = self.storage.assignments(by_chat.keys())
        out = []
        for r in rows:
            a = by_chat[r["chat_id"]]
            mats = [self._public_material(m) for m in (self.storage.get_material(x) for x in r["materials"]) if m]
            unit = self.storage.get_unit(r["unit_id"]) if r.get("unit_id") else None
            result = r.get("result")
            out.append({**{k: r.get(k) for k in ("id", "chat_id", "text", "due", "status", "answer", "comment", "created_at",
                                                     "done_at")},
                        "materials": mats, "role": a.role,
                        "attachments": [f for f in (self._public_file(x) for x in r["attachments"]) if f],
                        "unit": {"id": unit["id"], "title": unit["title"]} if unit else None,
                        "score": {"score": result["score"], "total": result["total"]} if result else None,
                        "student": a.pair.student_alias, "tutor": a.pair.tutor_alias})
        return {"homework": out}

    def _assignment_access(self, viewer: Viewer, assignment_id: int):
        row = self.storage.get_assignment(assignment_id)
        if not row:
            raise PortalError(404, "задание не найдено")
        return row, self.portal._access(viewer, row["chat_id"])

    def update_homework(self, viewer: Viewer, assignment_id: int, body: Any) -> dict[str, Any]:
        row, access = self._assignment_access(viewer, assignment_id)
        body = body if isinstance(body, dict) else {}
        status = body.get("status")
        if access.role == STUDENT and (status in ("done", "open") or "remove_attachment" in body):
            if "remove_attachment" in body:
                left = [x for x in row["attachments"] if x != body["remove_attachment"]]
                self.storage.update_assignment(assignment_id, attachments=left)
                return {"id": assignment_id, "status": row["status"]}
            answer = _lines(body, "answer", 3000)
            self._check_text(row["chat_id"], answer)
            self.storage.update_assignment(assignment_id, status=status, answer=answer,
                                           done_at=datetime.now(timezone.utc).isoformat(timespec="seconds"))
            if status == "done":
                self.portal.telegram(access.pair.tutor_user_id,
                                     f"✅ {access.pair.student_alias} выполнил домашнее задание: {row['text'][:120]}")
        elif access.role == TUTOR and status == "delete":
            self.storage.delete_assignment(assignment_id)
        elif access.role == TUTOR and (status in ("checked", "open") or "text" in body or "comment" in body):
            fields: dict[str, Any] = {}
            if status:
                fields["status"] = status
            if "comment" in body:  # обратная связь ученику: что получилось, над чем поработать
                fields["comment"] = _lines(body, "comment", 2000)
                self._check_text(row["chat_id"], fields["comment"])
                if fields["comment"]:
                    self.portal.telegram(access.pair.student_user_id, f"💬 {access.pair.tutor_alias} оценил домашнее "
                                         f"задание: {fields['comment'][:600]}")
            if "text" in body:  # преподаватель правит задание
                fields["text"] = _lines(body, "text", 3000, required=True)
                fields["due"] = _field(body, "due", 20)
                self._check_text(row["chat_id"], fields["text"])
            self.storage.update_assignment(assignment_id, **fields)
            status = fields.get("status", row["status"])
        else:
            raise PortalError(403, "нельзя изменить это задание")
        return {"id": assignment_id, "status": status}

    def attach(self, viewer: Viewer, assignment_id: int, raw: bytes | None, headers: Any) -> dict[str, Any]:
        """Ученик прикладывает к ДЗ фото тетради или скриншот."""
        row, access = self._assignment_access(viewer, assignment_id)
        if access.role != STUDENT:
            raise PortalError(403, "фото к заданию прикладывает ученик")
        if not raw:
            raise PortalError(400, "пустой файл")
        if len(raw) > MAX_ATTACHMENT:
            raise PortalError(413, "картинка больше 10 МБ")
        if len(row["attachments"]) >= 10:
            raise PortalError(409, "к заданию можно приложить до 10 картинок")
        mime = (headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if not mime.startswith("image/") or mime not in ALLOWED_TYPES or not _looks_like_image(raw):
            raise PortalError(415, "приложите картинку: PNG, JPG, WEBP или GIF")
        file_id = secrets.token_hex(12)
        (self.files_dir / (file_id + ALLOWED_TYPES[mime])).write_bytes(raw)
        title = urllib.parse.unquote(headers.get("X-File-Name") or "скриншот")[:120] or "скриншот"
        self.storage.add_material(id=file_id, owner_id=viewer.user_id, title=title, kind="file", mime=mime,
                                  size=len(raw), folder="ДЗ")
        self.storage.update_assignment(assignment_id, attachments=[*row["attachments"], file_id])
        return self._public_file(file_id)  # type: ignore[return-value]

    # == словарь и карточки ==============================================================
    def _save_words(self, chat_id: str, words: list[dict[str, Any]], source: str) -> int:
        added = 0
        for w in words:
            word = (w.get("word") or "").strip()[:80]
            if word:
                self.storage.save_student_word(chat_id, word_key(word), word, (w.get("translation") or None),
                                               w.get("example"), source)
                added += 1
        return added

    def _vocab_chats(self, viewer: Viewer, chat_id: str | None) -> list[str]:
        if chat_id:
            a = self.portal._access(viewer, chat_id)
            if a.role not in (TUTOR, STUDENT, PARENT):
                raise PortalError(403, "нет доступа к словарю")
            return [chat_id]
        chats = [a.chat_id for a in self.portal.accesses(viewer) if a.role == STUDENT]
        if not chats:
            raise PortalError(403, "словарь и карточки — у ученика")
        return chats

    def word_list(self, viewer: Viewer, chat_id: str | None = None) -> list[dict[str, Any]]:
        """Слова уроков + слова от преподавателя и свои, без убранных учеником."""
        chats = self._vocab_chats(viewer, chat_id)
        extra = self.storage.student_words(chats)
        hidden = {r["word_key"] for r in extra if r["hidden"]}
        seen: set[str] = set()
        out = []
        for c in chats:
            for w in self.portal.words(viewer, c)["words"]:
                key = word_key(w["word"])
                if key not in seen and key not in hidden:
                    seen.add(key)
                    out.append({**w, "key": key, "source": "lesson", "chat_id": c})
        for r in extra:
            if not r["hidden"] and r["word_key"] not in seen:
                seen.add(r["word_key"])
                out.append({"word": r["word"], "translation": r["translation"], "example": r["example"],
                            "transcription": None, "key": r["word_key"], "source": r["source"], "chat_id": r["chat_id"]})
        return out

    def vocab(self, viewer: Viewer, chat_id: str | None = None) -> dict[str, Any]:
        words = self.word_list(viewer, chat_id)
        return {"count": len(words), "words": words}

    def add_words(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        from .units import parse_words
        body = body if isinstance(body, dict) else {}
        chats = self._vocab_chats(viewer, body.get("chat_id") if isinstance(body.get("chat_id"), str) else None)
        access = self.portal._access(viewer, chats[0])
        if access.role == PARENT:
            raise PortalError(403, "слова добавляют ученик и преподаватель")
        text = _lines(body, "text", 3000, required=True) or ""
        self._check_text(chats[0], text)
        words = parse_words(text)
        if not words:
            raise PortalError(400, "по одному слову в строке: «kitchen — кухня»")
        added = self._save_words(chats[0], words, "tutor" if access.role == TUTOR else "student")
        return {"added": added, **self.vocab(viewer, body.get("chat_id"))}

    def delete_word(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        body = body if isinstance(body, dict) else {}
        key = body.get("key")
        if not isinstance(key, str) or not key:
            raise PortalError(400, "нужно поле key")
        chat = body.get("chat_id") if isinstance(body.get("chat_id"), str) else None
        chats = self._vocab_chats(viewer, chat)
        if self.portal._access(viewer, chats[0]).role == PARENT:
            raise PortalError(403, "убрать слово могут ученик и преподаватель")
        for c in chats:
            self.storage.hide_student_word(c, key, str(body.get("word") or key)[:80])
        return {"ok": True}

    def _student_words(self, viewer: Viewer) -> list[dict[str, Any]]:
        if not any(a.role == STUDENT for a in self.portal.accesses(viewer)):
            raise PortalError(403, "карточки — для учеников")
        return self.word_list(viewer)

    def cards(self, viewer: Viewer, now: datetime | None = None) -> dict[str, Any]:
        now = now or datetime.now(timezone.utc)
        words = self._student_words(viewer)
        state = self.storage.srs_cards(f"srs:{viewer.user_id}")
        due, new, learned = [], [], 0
        for w in words:
            key = w["key"]
            card = state.get(key)
            item = {**w, "reps": card["reps"] if card else 0, "interval_days": card["interval_days"] if card else 0}
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
        keys = {w["key"] for w in self._student_words(viewer)}
        if body["key"] not in keys:
            raise PortalError(404, "слово не найдено в словаре")
        owner = f"srs:{viewer.user_id}"
        card = self.storage.srs_cards(owner).get(body["key"])
        nxt = sm2(card, body["grade"], now)
        self.storage.save_srs_card(owner, body["key"], **nxt)
        return {"key": body["key"], **nxt}

    # == правка отчёта преподавателем =======================================================
    def edit_report(self, viewer: Viewer, lesson_id: str, body: Any) -> dict[str, Any]:
        lesson = self.storage.get_lesson(lesson_id)
        if not lesson or not lesson.get("chat_id"):
            raise PortalError(404, "урок не найден")
        access = self.portal._access(viewer, lesson["chat_id"])
        if access.role != TUTOR:
            raise PortalError(403, "отчёт правит преподаватель")
        report = self.storage.get_report(lesson_id)
        if not report or not isinstance(body, dict):
            raise PortalError(404, "отчёта ещё нет")

        def lines(key: str, limit: int = 30) -> list[str] | None:
            v = body.get(key)
            if v is None:
                return None
            items = v.split("\n") if isinstance(v, str) else v if isinstance(v, list) else []
            return [str(x).strip()[:500] for x in items if str(x).strip()][:limit]

        texts: list[str] = []
        if "topic" in body:
            report.topic = _field(body, "topic", 200)
            texts.append(report.topic or "")
        if "summary" in body:
            report.summary = _lines(body, "summary", 3000) or ""
            texts.append(report.summary)
        for key in ("key_points", "review_items"):
            v = lines(key)
            if v is not None:
                setattr(report, key, v)
                texts += v
        hw = lines("homework")
        if hw is not None:
            report.homework_teacher = [HomeworkTask(text=t, source="teacher") for t in hw]
            report.homework_generated = []
            texts += hw
        p = body.get("parent") if isinstance(body.get("parent"), dict) else {}
        if "summary" in p:
            report.parent.summary = str(p["summary"] or "").strip()[:3000]
            texts.append(report.parent.summary)
        for key in ("achievements", "attention", "recommendations", "teacher_remarks"):
            if key in p:
                v = [str(x).strip()[:500] for x in (p[key] or []) if str(x).strip()][:20] if isinstance(p[key], list) \
                    else [x.strip()[:500] for x in str(p[key] or "").split("\n") if x.strip()][:20]
                setattr(report.parent, key, v)
                texts += v
        if isinstance(body.get("vocabulary"), str):  # слова урока: правка сразу меняет карточки ученика
            from .units import parse_words
            words = parse_words(body["vocabulary"])
            old = {word_key(w.word): w for w in report.vocabulary}
            report.vocabulary = [VocabItem(word=w["word"], translation=w["translation"], source="teacher_list")
                                 for w in words]
            texts.append(body["vocabulary"])
            self._save_words(lesson["chat_id"], words, "tutor")
            new_keys = {word_key(w["word"]) for w in words}
            for key, w in old.items():
                if key not in new_keys:
                    self.storage.hide_student_word(lesson["chat_id"], key, w.word)
        self._check_text(lesson["chat_id"], *texts)
        report.notes = [*report.notes, "отредактировано преподавателем"][-10:]
        self.storage.save_report(lesson_id, report)
        return self.portal.lesson(viewer, lesson_id)

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


