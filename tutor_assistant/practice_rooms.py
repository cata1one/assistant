"""Peer conversation rooms, independent of private teacher lessons."""
from __future__ import annotations

import json
import secrets
import threading
import time

from .portal import PortalError

LANGUAGES = {"en", "zh", "es", "fr", "it", "pt", "ar", "sr", "hi", "el"}
LEVELS = {"A1", "A2", "B1", "B2", "C1", "C2", "any"}
MAX_PARTICIPANTS = 4
TTL = 35


class PracticeRooms:
    def __init__(self, portal, classroom):
        self.portal = portal
        self.classroom = classroom
        self._lock = threading.RLock()
        self._rooms = {}

    def _account(self, viewer):
        row = self.portal.storage.get_account(viewer.user_id)
        if not row or row["role"] not in ("student", "tutor"):
            raise PortalError(403, "нужен аккаунт ученика или преподавателя")
        return row

    def _clean(self):
        now = time.monotonic()
        for rid, room in list(self._rooms.items()):
            room["peers"] = {k: v for k, v in room["peers"].items() if now - v["seen"] < TTL}
            if not room["peers"]:
                del self._rooms[rid]

    def list(self, viewer, query):
        self._account(viewer)
        text = str(query.get("q") or "").strip().casefold()[:100]
        language = query.get("language", "")
        level = query.get("level", "")
        with self._lock:
            self._clean()
            rooms = []
            for r in self._rooms.values():
                if text and text not in (r["title"] + " " + r["topic"]).casefold():
                    continue
                if language and language != r["language"]:
                    continue
                if level and level != r["level"]:
                    continue
                rooms.append({k: r[k] for k in ("id", "title", "topic", "language", "level") } |
                             {"count": len(r["peers"]), "capacity": MAX_PARTICIPANTS})
            return {"rooms": rooms[:100]}

    def create(self, viewer, body):
        account = self._account(viewer)
        if not isinstance(body, dict):
            raise PortalError(400, "нужны параметры комнаты")
        title, topic = str(body.get("title") or "").strip(), str(body.get("topic") or "").strip()
        language, level = body.get("language"), body.get("level")
        if not title or len(title) > 80 or len(topic) > 160 or language not in LANGUAGES or level not in LEVELS:
            raise PortalError(400, "проверьте название, тему, язык и уровень")
        if any(self.portal.assistant.moderate(t).is_violation for t in (title, topic) if t):
            raise PortalError(422, "уберите контакты из названия и темы")
        with self._lock:
            self._clean()
            if any(r["owner"] == viewer.user_id for r in self._rooms.values()):
                raise PortalError(409, "у вас уже есть открытая комната")
            rid = secrets.token_hex(12)
            self._rooms[rid] = {"id": rid, "title": title, "topic": topic, "language": language, "level": level,
                                "owner": viewer.user_id, "peers": {viewer.user_id: {"name": account["name"], "seen": time.monotonic()}},
                                "signals": [], "next": 1, "prompt": 0}
            return {"id": rid}

    def join(self, viewer, rid):
        account = self._account(viewer)
        with self._lock:
            self._clean()
            room = self._rooms.get(rid)
            if not room:
                raise PortalError(404, "комната закрыта")
            if viewer.user_id not in room["peers"] and len(room["peers"]) >= MAX_PARTICIPANTS:
                raise PortalError(409, "в комнате нет мест")
            room["peers"][viewer.user_id] = {"name": account["name"], "seen": time.monotonic()}
            return {"ok": True}

    def state(self, viewer, rid, since=0):
        self._account(viewer)
        with self._lock:
            self._clean()
            room = self._rooms.get(rid)
            if not room or viewer.user_id not in room["peers"]:
                raise PortalError(404, "комната закрыта или вы вышли")
            room["peers"][viewer.user_id]["seen"] = time.monotonic()
            return {"id": rid, "title": room["title"], "topic": room["topic"], "language": room["language"], "me": viewer.user_id,
                    "peers": [{"id": k, "name": v["name"]} for k, v in room["peers"].items()],
                    "signals": [s for s in room["signals"] if s["to"] == viewer.user_id and s["id"] > since],
                    "ice_servers": self.classroom.ice_servers(), "prompt": room["prompt"]}

    def signal(self, viewer, rid, body):
        self._account(viewer)
        if not isinstance(body, dict) or body.get("kind") not in ("offer", "answer", "ice"):
            raise PortalError(400, "неверный сигнал")
        if len(json.dumps(body.get("data"))) > 65536:
            raise PortalError(413, "сигнал слишком большой")
        with self._lock:
            self._clean()
            room = self._rooms.get(rid)
            if not room or viewer.user_id not in room["peers"] or body.get("to") not in room["peers"]:
                raise PortalError(403, "участник не найден")
            room["signals"].append({"id": room["next"], "from": viewer.user_id, "to": body["to"],
                                    "kind": body["kind"], "data": body.get("data")})
            room["next"] += 1
            del room["signals"][:-400]
            return {"ok": True}

    def next_prompt(self, viewer, rid):
        self._account(viewer)
        with self._lock:
            self._clean()
            room = self._rooms.get(rid)
            if not room or viewer.user_id not in room["peers"]:
                raise PortalError(403, "сначала войдите в комнату")
            room["prompt"] += 1
            return {"prompt": room["prompt"]}

    def leave(self, viewer, rid):
        self._account(viewer)
        with self._lock:
            room = self._rooms.get(rid)
            if room:
                room["peers"].pop(viewer.user_id, None)
                if not room["peers"]:
                    del self._rooms[rid]
            return {"ok": True}
