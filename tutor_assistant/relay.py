"""Анонимный мост между преподавателем и учеником.

В обычной Telegram-группе участники всегда видят профили друг друга и могут
написать в личку. Поэтому в этом режиме они вообще не состоят в общем чате:

* администратор школы создаёт пару и получает две одноразовые ссылки-приглашения
  (для преподавателя и для ученика);
* каждый открывает свою ссылку и дальше пишет только боту в личные сообщения;
* бот пересылает сообщения от своего имени, подписывая их псевдонимом пары
  («Анна Петровна», «Миша»), и перед пересылкой проверяет каждое сообщение.

Ни имя аккаунта, ни @ник, ни аватар, ни id собеседника не передаются.
Модуль не зависит от Telegram – здесь только правила и данные.
"""

from __future__ import annotations

import re
import secrets
import uuid
from dataclasses import dataclass
from typing import Any

from .storage import Storage

TUTOR, STUDENT = "tutor", "student"
_PAYLOAD_RE = re.compile(r"^(?:t|s)_([A-Za-z0-9_-]{8,40})$")


class RelayError(Exception):
    """Понятная пользователю ошибка (текст можно показывать как есть)."""


@dataclass(frozen=True)
class Pair:
    id: str
    tutor_alias: str
    student_alias: str
    tutor_user_id: str | None
    student_user_id: str | None
    tutor_code: str
    student_code: str
    active: bool

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> Pair:
        return cls(row["id"], row["tutor_alias"], row["student_alias"], row["tutor_user_id"], row["student_user_id"],
                   row["tutor_code"], row["student_code"], bool(row["active"]))

    @property
    def chat_id(self) -> str:
        """Идентификатор «чата» пары для уроков, словаря и журнала нарушений."""
        return f"pair:{self.id}"

    def role_of(self, user_id: str) -> str | None:
        if user_id == self.tutor_user_id:
            return TUTOR
        if user_id == self.student_user_id:
            return STUDENT
        return None

    def alias(self, role: str) -> str:
        return self.tutor_alias if role == TUTOR else self.student_alias

    def other_user(self, role: str) -> str | None:
        return self.student_user_id if role == TUTOR else self.tutor_user_id

    def other_role(self, role: str) -> str:
        return STUDENT if role == TUTOR else TUTOR


def _clean_alias(value: str | None, default: str) -> str:
    alias = re.sub(r"\s+", " ", (value or "").strip())[:40]
    # Псевдоним не должен сам содержать @ник или ссылку.
    alias = re.sub(r"[@/:]", "", alias).strip()
    return alias or default


class RelayService:
    def __init__(self, storage: Storage):
        self.storage = storage

    # -- пары ----------------------------------------------------------------------
    def create_pair(self, tutor_alias: str | None, student_alias: str | None, created_by: str | None = None) -> Pair:
        pair_id = uuid.uuid4().hex[:8]
        row = self.storage.create_pair(
            pair_id, _clean_alias(tutor_alias, "Преподаватель"), _clean_alias(student_alias, "Ученик"),
            secrets.token_urlsafe(12), secrets.token_urlsafe(12), created_by)
        return Pair.from_row(row)

    def get(self, pair_id: str) -> Pair | None:
        row = self.storage.get_pair(pair_id)
        return Pair.from_row(row) if row else None

    def deactivate(self, pair_id: str) -> bool:
        return self.storage.deactivate_pair(pair_id)

    def list(self, include_inactive: bool = False) -> list[Pair]:
        return [Pair.from_row(r) for r in self.storage.list_pairs(include_inactive)]

    @staticmethod
    def invite_payloads(pair: Pair) -> tuple[str, str]:
        return f"t_{pair.tutor_code}", f"s_{pair.student_code}"

    def bind(self, payload: str, user_id: str) -> tuple[Pair, str]:
        """Привязать пользователя к паре по ссылке-приглашению."""
        m = _PAYLOAD_RE.match(payload or "")
        if not m:
            raise RelayError("Ссылка-приглашение недействительна. Попросите администратора школы прислать новую.")
        found = self.storage.pair_by_code(m.group(1))
        if not found or found[1][0] != payload[0]:
            raise RelayError("Ссылка-приглашение недействительна. Попросите администратора школы прислать новую.")
        row, role = found
        pair = Pair.from_row(row)
        if not pair.active:
            raise RelayError("Эта пара отключена администратором школы.")
        bound = pair.tutor_user_id if role == TUTOR else pair.student_user_id
        if bound and bound != user_id:
            raise RelayError("Ссылка уже использована другим пользователем. Обратитесь к администратору школы.")
        if pair.role_of(user_id) not in (None, role):
            raise RelayError("Нельзя быть одновременно преподавателем и учеником в одной паре.")
        if not bound:
            self.storage.bind_pair_user(pair.id, role, user_id)
            pair = self.get(pair.id) or pair
        self.storage.set_current_pair(user_id, pair.id)
        return pair, role

    # -- текущий собеседник --------------------------------------------------------
    def pairs_for(self, user_id: str) -> list[tuple[Pair, str]]:
        out = []
        for row in self.storage.pairs_for_user(user_id):
            pair = Pair.from_row(row)
            role = pair.role_of(user_id)
            if role:
                out.append((pair, role))
        return out

    def current(self, user_id: str) -> tuple[Pair, str] | None:
        pairs = self.pairs_for(user_id)
        if not pairs:
            return None
        current_id = self.storage.current_pair_id(user_id)
        for pair, role in pairs:
            if pair.id == current_id:
                return pair, role
        return pairs[0] if len(pairs) == 1 else None

    def switch(self, user_id: str, pair_id: str) -> tuple[Pair, str]:
        for pair, role in self.pairs_for(user_id):
            if pair.id == pair_id:
                self.storage.set_current_pair(user_id, pair_id)
                return pair, role
        raise RelayError("Такого собеседника нет в вашем списке.")

    # -- пересланные сообщения -----------------------------------------------------
    def record(self, pair: Pair, src_chat: str, src_msg: int, dst_chat: str, dst_msg: int) -> None:
        self.storage.add_relay_message(pair.id, src_chat, src_msg, dst_chat, dst_msg)

    def resolve_reply(self, user_id: str, replied_msg_id: int) -> tuple[Pair, str, int | None] | None:
        """Ответ (reply) на сообщение в личке с ботом → пара, роль и сообщение у собеседника для цитаты."""
        row = self.storage.relay_by_dst(user_id, replied_msg_id)  # ответ на сообщение собеседника
        counterpart = row["src_msg"] if row else None
        if row is None:
            rows = self.storage.relay_by_src(user_id, replied_msg_id)  # ответ на собственное сообщение
            row = rows[-1] if rows else None
            counterpart = row["dst_msg"] if row else None
        if row is None:
            return None
        pair = self.get(row["pair_id"])
        if pair is None or not pair.active:
            return None
        role = pair.role_of(user_id)
        return (pair, role, counterpart) if role else None

    def delivered_copies(self, src_chat: str, src_msgs: list[int]) -> list[tuple[str, int]]:
        """Где лежат копии этих сообщений у собеседника – чтобы удалить части номера, отправленного по кусочкам."""
        out = []
        for msg_id in src_msgs:
            out += [(r["dst_chat"], r["dst_msg"]) for r in self.storage.relay_by_src(src_chat, msg_id)]
        return out
