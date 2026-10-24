"""Аккаунты сайта: репетитор (BetterTeach), ученик и родитель (BetterStudy), онлайн-школа.

* Вход по почте и паролю – Telegram не обязателен (у многих он недоступен). Telegram можно
  привязать в профиле: тогда отчёты и сообщения дублируются туда.
* Репетитор бывает **частный** (сам себе школа, его переписка не фильтруется) или **в школе**
  (школа видит уроки и отчёты, контакты фильтруются, попытки обмена – сигналы школе).
* Ученик и родитель попадают к репетитору по ссылке-приглашению. Ученик сам не создаёт
  уроки и доски – это делает преподаватель.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
import threading
import time
from typing import Any

from . import billing
from .billing import PLANS
from .portal import ADMIN, PARENT, Portal, PortalError, Viewer, _field
from .relay import STUDENT, TUTOR, Pair, RelayService

ROLES = ("tutor", "student", "parent", "school")
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")
PBKDF2_ROUNDS = 200_000
LOGIN_ATTEMPTS = 10  # за 15 минут с одного адреса и с одной почты


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ROUNDS)
    return f"pbkdf2${PBKDF2_ROUNDS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, rounds, salt, digest = stored.split("$")
        check = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), int(rounds))
        return hmac.compare_digest(check.hex(), digest)
    except (ValueError, TypeError):
        return False


def first_name(name: str) -> str:
    """Другие пользователи видят только имя – без фамилии."""
    return (name or "").strip().split()[0][:30] if (name or "").strip() else ""


class Accounts:
    def __init__(self, portal: Portal):
        self.portal = portal
        self.storage = portal.storage
        self.assistant = portal.assistant
        self.relay = RelayService(self.storage)
        self._attempts: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    # -- вход ---------------------------------------------------------------------
    def _throttle(self, *keys: str) -> None:
        now = time.monotonic()
        with self._lock:
            for k in keys:
                hits = [t for t in self._attempts.get(k, []) if now - t < 900]
                if len(hits) >= LOGIN_ATTEMPTS:
                    raise PortalError(429, "слишком много попыток – подождите 15 минут")
                self._attempts[k] = hits + [now]

    def register(self, body: Any, ip: str | None) -> dict[str, Any]:
        if not isinstance(body, dict):
            raise PortalError(400, "нужен JSON-объект")
        role = body.get("role")
        if role not in ROLES:
            raise PortalError(400, "выберите, кто вы: репетитор, ученик, родитель или школа")
        name = _field(body, "name", 60, required=True)
        email = (_field(body, "email", 120, required=True) or "").lower()
        password = body.get("password")
        if not EMAIL_RE.match(email):
            raise PortalError(400, "проверьте адрес почты")
        if not isinstance(password, str) or len(password) < 8 or len(password) > 200:
            raise PortalError(400, "пароль – от 8 символов")
        if not body.get("consent"):
            raise PortalError(400, "нужно согласие на обработку персональных данных")
        if self.assistant.moderate(name).is_violation:
            raise PortalError(422, "имя – без телефонов, ников и ссылок")
        self._throttle(f"reg:{ip}")
        if self.storage.account_by_email(email):
            raise PortalError(409, "аккаунт с этой почтой уже есть – войдите")
        account_id = "a_" + secrets.token_hex(8)
        org_id = None
        if role == "school":
            school = _field(body, "school_name", 80, required=True)
            org_id = "o_" + secrets.token_hex(6)
            self.storage.add_org(org_id, school, account_id)
        self.storage.add_account(id=account_id, email=email, password_hash=hash_password(password), name=name,
                                 role=role, org_id=org_id)
        if role in ("tutor", "school"):  # 3 дня со всеми функциями и своя ссылка «пригласить коллегу»
            ref = self.storage.account_by_ref(str(body.get("ref") or "")) if body.get("ref") else None
            self.storage.update_account(account_id, trial_until=billing.trial_until(), ref_code=secrets.token_urlsafe(6),
                                        referred_by=ref["id"] if ref and ref["role"] in ("tutor", "school") else None)
        joined = None
        if body.get("invite"):
            joined = self.join(Viewer(account_id, False), body.get("invite"))
        return {"token": self.portal.issue_token(account_id), "account": self.public(account_id), "joined": joined}

    def login(self, body: Any, ip: str | None) -> dict[str, Any]:
        if not isinstance(body, dict):
            raise PortalError(400, "нужен JSON-объект")
        email = str(body.get("email") or "").strip().lower()
        password = body.get("password")
        self._throttle(f"ip:{ip}", f"mail:{email}")
        row = self.storage.account_by_email(email)
        if not row or not isinstance(password, str) or not verify_password(password, row["password_hash"]):
            raise PortalError(401, "неверная почта или пароль")
        joined = self.join(Viewer(row["id"], False), body["invite"]) if body.get("invite") else None
        return {"token": self.portal.issue_token(row["id"]), "account": self.public(row["id"]), "joined": joined}

    # -- восстановление пароля -----------------------------------------------------------------
    RESET_HOURS = 2

    def forgot_password(self, body: Any, ip: str | None) -> dict[str, Any]:
        """Письмо со ссылкой для нового пароля. Ответ всегда одинаковый, чтобы нельзя было выяснить, есть ли такая почта."""
        email = str((body or {}).get("email") or "").strip().lower() if isinstance(body, dict) else ""
        if not EMAIL_RE.match(email):
            raise PortalError(400, "проверьте адрес почты")
        self._throttle(f"forgot-ip:{ip}", f"forgot:{email}")
        row = self.storage.account_by_email(email)
        if row:
            code = secrets.token_urlsafe(24)
            self.storage.add_invite(code, "reset", row["id"], row["id"])
            site = self.portal.settings.site_url or ""
            self.portal.mailer.send(email, f"{self.portal.settings.school_name}: новый пароль",
                                    f"Здравствуйте, {row['name']}!\n\nЧтобы задать новый пароль, откройте ссылку (она действует {self.RESET_HOURS} ч.):\n"
                                    f"{site}/#/reset?code={code}\n\nЕсли вы ничего не просили, просто проигнорируйте письмо.",
                                    reply_to=self.portal.settings.support_email)
        return {"ok": True, "mail": self.portal.mailer.configured}

    def reset_password(self, body: Any, ip: str | None) -> dict[str, Any]:
        from datetime import datetime, timedelta, timezone

        body = body if isinstance(body, dict) else {}
        self._throttle(f"reset-ip:{ip}")
        inv = self.storage.get_invite(str(body.get("code") or ""))
        password = body.get("password")
        if not isinstance(password, str) or not 8 <= len(password) <= 200:
            raise PortalError(400, "пароль: от 8 символов")
        fresh = False
        if inv and inv["kind"] == "reset":
            try:
                fresh = datetime.now(timezone.utc) - datetime.fromisoformat(inv["created_at"]) < timedelta(hours=self.RESET_HOURS)
            except ValueError:
                fresh = False
        if not fresh or not self.storage.use_invite(inv["code"]):
            raise PortalError(410, "ссылка устарела или уже использована: запросите новую на странице входа")
        self.storage.update_account(inv["target"], password_hash=hash_password(password))
        self.storage.revoke_access_tokens(inv["target"])  # старые входы закрываем: пароль могли узнать посторонние
        return {"token": self.portal.issue_token(inv["target"]), "account": self.public(inv["target"])}

    # -- профиль ------------------------------------------------------------------
    def account(self, viewer: Viewer) -> dict[str, Any]:
        row = self.storage.get_account(viewer.user_id)
        if not row:
            raise PortalError(403, "этот раздел – для аккаунтов сайта")
        return row

    def public(self, account_id: str) -> dict[str, Any]:
        row = self.storage.get_account(account_id) or {}
        org = self.storage.get_org(row.get("org_id"))
        data = {"id": row.get("id"), "name": row.get("name"), "email": row.get("email"), "role": row.get("role"),
                "brand": "teach" if row.get("role") in ("tutor", "school") else "study",
                "org": {"id": org["id"], "name": org["name"], "filter_contacts": bool(org["filter_contacts"]),
                        "owner": org["owner_id"] == row.get("id")} if org else None,
                "telegram": bool(row.get("tg_user_id")), "billing": billing.plan_state(self.storage, row),
                "prefs": _prefs(row)}
        if row.get("role") == "student":
            data["mood"] = self.mood_of(row)
        if row.get("role") in ("tutor", "school"):
            if not row.get("ref_code"):
                row["ref_code"] = secrets.token_urlsafe(6)
                self.storage.update_account(row["id"], ref_code=row["ref_code"])
            ref = billing.referrals(self.storage, row)
            site = self.portal.settings.site_url or ""
            data["referral"] = {**ref, "link": f"{site}/#/register?role=tutor&ref={ref['code']}"}
        return data

    def me(self, viewer: Viewer) -> dict[str, Any]:
        self.account(viewer)
        return {"account": self.public(viewer.user_id), "plans": PLANS}

    def update_profile(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        self.account(viewer)
        if not isinstance(body, dict):
            raise PortalError(400, "нужен JSON-объект")
        fields: dict[str, Any] = {}
        if "name" in body:
            name = _field(body, "name", 60, required=True)
            if self.assistant.moderate(name).is_violation:
                raise PortalError(422, "имя – без телефонов, ников и ссылок")
            fields["name"] = name
        if body.get("password"):
            if not isinstance(body["password"], str) or len(body["password"]) < 8:
                raise PortalError(400, "пароль – от 8 символов")
            fields["password_hash"] = hash_password(body["password"])
        if fields:
            self.storage.update_account(viewer.user_id, **fields)
        return self.me(viewer)

    def telegram_link(self, viewer: Viewer) -> dict[str, Any]:
        """Ссылка для привязки Telegram: бот получит /start a_<код> и запомнит аккаунт."""
        self.account(viewer)
        code = secrets.token_urlsafe(12)
        self.storage.add_invite(code, "telegram", viewer.user_id, viewer.user_id)
        bot = self.portal.settings.bot_username
        return {"link": f"https://t.me/{bot}?start=a_{code}" if bot else None, "code": code}

    def link_telegram(self, code: str, tg_user_id: str) -> dict[str, Any] | None:
        inv = self.storage.get_invite(code)
        if not inv or inv["kind"] != "telegram" or not self.storage.use_invite(code):
            return None
        other = self.storage.account_by_tg(tg_user_id)
        if other and other["id"] != inv["target"]:
            self.storage.update_account(other["id"], tg_user_id=None)
        self.storage.update_account(inv["target"], tg_user_id=tg_user_id)
        return self.storage.get_account(inv["target"])

    # -- ученики репетитора ----------------------------------------------------------
    def _tutor(self, viewer: Viewer) -> dict[str, Any]:
        row = self.account(viewer)
        if row["role"] != "tutor":
            raise PortalError(403, "доступно преподавателям")
        return row

    def students(self, viewer: Viewer) -> dict[str, Any]:
        tutor = self._tutor(viewer)
        out = []
        for row in self.storage.tutor_pairs(tutor["id"]):
            pair = Pair.from_row(row)
            invite = next(iter(self.storage.invites_for(pair.id, "student")), None)
            parents = self.storage.parents_for(pair.chat_id)
            active = self.storage.active_lesson(pair.chat_id)
            out.append({"pair_id": pair.id, "chat_id": pair.chat_id, "name": pair.student_alias,
                        "joined": bool(pair.student_user_id), "parents": len(parents),
                        "invite": self._links(invite["code"]) if invite and not pair.student_user_id else None,
                        "parent_invite": self._links(self._parent_code(pair)),
                        "language": row.get("language") or self.portal.settings.target_language,
                        "mood": self.visible_mood(pair.student_user_id),
                        "photo": self._photo(pair.student_user_id),
                        "balance": row.get("balance", 0),
                        "active_lesson": active["id"] if active else None})
        limit = None  # на тарифе – без ограничения числа учеников
        return {"students": out, "limit": limit}

    def add_student(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        tutor = self._tutor(viewer)
        name = first_name(_field(body if isinstance(body, dict) else {}, "name", 40, required=True) or "")
        if self.assistant.moderate(name).is_violation:
            raise PortalError(422, "имя – без контактов")
        billing.require_active(self.storage, tutor["id"])
        pair = self.relay.create_pair(first_name(tutor["name"]), name, created_by=tutor["id"])
        self.storage.bind_pair_user(pair.id, TUTOR, tutor["id"])
        self.storage.set_pair_language(pair.id, _language(body))
        code = secrets.token_urlsafe(10)
        self.storage.add_invite(code, "student", pair.id, tutor["id"])
        pair = self.relay.get(pair.id)
        return {"pair_id": pair.id, "invite": self._links(code), "parent_invite": self._links(self._parent_code(pair))}

    def remove_student(self, viewer: Viewer, pair_id: str) -> dict[str, Any]:
        tutor = self._tutor(viewer)
        pair = self.relay.get(pair_id)
        if not pair or pair.tutor_user_id != tutor["id"]:
            raise PortalError(404, "ученик не найден")
        self.relay.deactivate(pair_id)
        return {"ok": True}

    def admin_extend(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        """Администратор платформы продлевает оплату (пока онлайн-оплата не подключена)."""
        if not viewer.admin:
            raise PortalError(403, "доступно администратору платформы")
        body = body if isinstance(body, dict) else {}
        acc = self.storage.account_by_email(str(body.get("email") or "").strip().lower())
        if not acc or acc["role"] not in ("tutor", "school"):
            raise PortalError(404, "преподаватель или школа с такой почтой не найдены")
        months = body.get("months")
        if months not in (1, 3, 12):
            raise PortalError(400, "срок: 1, 3 или 12 месяцев")
        teachers = len(self.storage.org_accounts(acc["org_id"], "tutor")) if acc["role"] == "school" and acc.get("org_id") else 1
        use = bool(body.get("use_discount")) and billing.referrals(self.storage, acc)["discounts"] > 0
        q = billing.quote(acc, months, self.storage, teachers, use_referral=use)
        until = billing.extend(self.storage, acc, months)
        if q["reason"] == "referral":
            self.storage.update_account(acc["id"], ref_used=str(int(acc.get("ref_used") or 0) + 1))
        pid = "adm_" + secrets.token_hex(8)  # оплата вне сайта: запоминаем, чтобы скидка на первый месяц не повторялась
        self.storage.add_payment(pid, acc["id"], months, q["total"], q["reason"])
        self.storage.settle_payment(pid)
        return {"email": acc["email"], "paid_until": until, "price": q["total"], "discount_used": q["reason"] == "referral",
                "teachers": teachers}

    def update_prefs(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        """Оформление кабинета и личные настройки. Переданные поля меняются, остальные остаются."""
        row = self.account(viewer)
        body = body if isinstance(body, dict) else {}
        prefs = _prefs(row)
        if "theme" in body:
            prefs["theme"] = body["theme"] if body["theme"] in THEMES else "default"
        if "avatar" in body:
            prefs["avatar"] = str(body.get("avatar") or "")[:40] or None
        if "stickers" in body:
            prefs["stickers"] = [str(x)[:40] for x in (body.get("stickers") or []) if isinstance(x, str)][:8]
        if "motto" in body:
            prefs["motto"] = str(body.get("motto") or "").strip()[:80] or None
            if prefs["motto"] and self.assistant.moderate(prefs["motto"]).is_violation:
                raise PortalError(422, "без контактов, пожалуйста")
        for flag in ("review_reports", "mood_private"):  # проверять конспект перед отправкой / не показывать настроение
            if flag in body:
                prefs[flag] = bool(body[flag])
        if body.get("photo") is None and "photo" in body:  # убрать свою картинку
            prefs.pop("photo", None)
        self.storage.update_account(viewer.user_id, prefs=json.dumps(prefs, ensure_ascii=False))
        return self.me(viewer)

    def _photo(self, user_id: str | None) -> str | None:
        row = self.storage.get_account(user_id) if user_id and user_id.startswith("a_") else None
        photo = _prefs(row).get("photo") if row else None
        return f"/site/v1/files/{photo}" if photo else None

    # -- настроение («социальная батарейка») -----------------------------------------------------------
    def _today(self) -> str:
        from datetime import datetime

        return datetime.now(self.portal.settings.tz).date().isoformat()

    def set_mood(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        """Ученик сам отмечает заряд от 1 до 5. Не отметил, значит нигде ничего не показывается."""
        row = self.account(viewer)
        if row["role"] != "student":
            raise PortalError(403, "настроение отмечают ученики")
        level = (body or {}).get("level") if isinstance(body, dict) else None
        if level is None:
            self.storage.clear_mood(row["id"], self._today())
        elif isinstance(level, int) and not isinstance(level, bool) and 1 <= level <= 5:
            self.storage.set_mood(row["id"], self._today(), level)
        else:
            raise PortalError(400, "level: число от 1 до 5")
        return self.mood_of(row)

    def mood_of(self, row: dict[str, Any]) -> dict[str, Any]:
        today = self._today()
        history = self.storage.moods(row["id"], 14)
        return {"today": next((m["level"] for m in history if m["day"] == today), None), "history": history}

    def visible_mood(self, student_id: str | None) -> dict[str, Any] | None:
        """Что видит преподаватель: последнюю отметку за три дня, если ученик её поставил и не скрыл."""
        row = self.storage.get_account(student_id) if student_id and student_id.startswith("a_") else None
        if not row or _prefs(row).get("mood_private"):
            return None
        from datetime import date, timedelta

        today = date.fromisoformat(self._today())
        for m in self.storage.moods(row["id"], 3):
            if date.fromisoformat(m["day"]) >= today - timedelta(days=2):
                return {"level": m["level"], "day": m["day"]}
        return None

    def set_language(self, viewer: Viewer, pair_id: str, body: Any) -> dict[str, Any]:
        tutor = self._tutor(viewer)
        pair = self.relay.get(pair_id)
        if not pair or pair.tutor_user_id != tutor["id"]:
            raise PortalError(404, "ученик не найден")
        self.storage.set_pair_language(pair_id, _language(body))
        return {"ok": True}

    def _parent_code(self, pair: Pair) -> str:
        row = self.storage._one("SELECT code FROM parent_invites WHERE chat_id=? ORDER BY rowid LIMIT 1", (pair.chat_id,))
        if row:
            return row["code"]
        return self.assistant.create_parent_invite(pair.chat_id, pair.student_alias, created_by=pair.tutor_user_id)

    def _links(self, code: str) -> dict[str, str]:
        site = self.portal.settings.site_url or ""
        return {"code": code, "url": f"{site}/#/join?code={code}"}

    # -- школа ----------------------------------------------------------------------
    def _school(self, viewer: Viewer) -> tuple[dict[str, Any], dict[str, Any]]:
        row = self.account(viewer)
        org = self.storage.get_org(row.get("org_id"))
        if row["role"] != "school" or not org:
            raise PortalError(403, "доступно администратору школы")
        return row, org

    def school(self, viewer: Viewer) -> dict[str, Any]:
        _, org = self._school(viewer)
        tutors = self.storage.org_accounts(org["id"], "tutor")
        pairs = self.storage.pairs_of_tutors([t["id"] for t in tutors])
        by_tutor: dict[str, list[dict[str, Any]]] = {}
        for p in pairs:
            by_tutor.setdefault(p["tutor_user_id"], []).append(p)
        invite = next(iter(self.storage.invites_for(org["id"], "tutor")), None)
        if not invite:
            code = secrets.token_urlsafe(10)
            self.storage.add_invite(code, "tutor", org["id"], viewer.user_id, max_uses=1000)
            invite = {"code": code}
        incidents = self.storage.org_incidents([f"pair:{p['id']}" for p in pairs], limit=100)
        lessons = self.storage.lessons_for_chats([f"pair:{p['id']}" for p in pairs], limit=100)
        return {
            "org": {"id": org["id"], "name": org["name"], "filter_contacts": bool(org["filter_contacts"])},
            "tutor_invite": self._links(invite["code"]),
            "tutors": [{"id": t["id"], "name": t["name"], "email": t["email"],
                        "students": [{"pair_id": p["id"], "name": p["student_alias"], "joined": bool(p["student_user_id"])}
                                     for p in by_tutor.get(t["id"], [])]} for t in tutors],
            "students_total": len(pairs),
            "signals": [{"id": i["id"], "created_at": i["created_at"], "chat_id": i["chat_id"], "who": i["user_name"],
                         "role": i["role"], "summary": i["summary"], "text": i["original_text"],
                         "severity": i["severity"]} for i in incidents],
            "lessons": [{"id": x["id"], "chat_id": x["chat_id"], "title": x.get("title"), "status": x["status"],
                         "started_at": x["started_at"], "tutor": x.get("tutor_name"), "student": x.get("student_name")}
                        for x in lessons],
        }

    def update_school(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        _, org = self._school(viewer)
        if isinstance(body, dict):
            if "name" in body:
                self.storage.update_org(org["id"], name=_field(body, "name", 80, required=True))
            if "filter_contacts" in body:
                self.storage.update_org(org["id"], filter_contacts=int(bool(body["filter_contacts"])))
        return self.school(viewer)

    # -- приглашения ----------------------------------------------------------------
    def invite_info(self, code: str | None) -> dict[str, Any]:
        """Что за приглашение – показываем до входа, без личных данных."""
        if not code:
            raise PortalError(404, "приглашение не найдено")
        inv = self.storage.get_invite(code)
        if inv and inv["kind"] == "student":
            pair = self.relay.get(inv["target"])
            if pair and pair.active:
                return {"kind": "student", "role": "student", "tutor": pair.tutor_alias, "student": pair.student_alias,
                        "used": bool(pair.student_user_id)}
        if inv and inv["kind"] == "tutor":
            org = self.storage.get_org(inv["target"])
            if org:
                return {"kind": "tutor", "role": "tutor", "school": org["name"]}
        row = self.storage._one("SELECT * FROM parent_invites WHERE code=?", (code,))
        if row:
            pair = self.relay.get(row["chat_id"].split(":", 1)[1]) if row["chat_id"].startswith("pair:") else None
            return {"kind": "parent", "role": "parent", "student": row["student_name"],
                    "tutor": pair.tutor_alias if pair else None}
        raise PortalError(404, "приглашение не найдено или устарело")

    def join(self, viewer: Viewer, code: Any) -> dict[str, Any]:
        if not isinstance(code, str) or not code:
            raise PortalError(400, "нет кода приглашения")
        info = self.invite_info(code)
        acc = self.account(viewer)
        if info["kind"] == "student":
            if acc["role"] != "student":
                raise PortalError(409, "это приглашение для ученика – войдите как ученик")
            inv = self.storage.get_invite(code)
            pair = self.relay.get(inv["target"])
            if pair.student_user_id and pair.student_user_id != acc["id"]:
                raise PortalError(409, "приглашение уже использовано")
            self.storage.bind_pair_user(pair.id, STUDENT, acc["id"])
            self.storage.use_invite(code)
            self.portal.telegram(pair.tutor_user_id, f"🔔 Ученик «{pair.student_alias}» подключился на сайте.")
            return {"kind": "student", "chat_id": pair.chat_id, "tutor": pair.tutor_alias}
        if info["kind"] == "tutor":
            if acc["role"] != "tutor":
                raise PortalError(409, "это приглашение для преподавателя")
            inv = self.storage.get_invite(code)
            if acc.get("org_id") and acc["org_id"] != inv["target"]:
                raise PortalError(409, "вы уже работаете в другой школе")
            self.storage.update_account(acc["id"], org_id=inv["target"])
            self.storage.use_invite(code)
            return {"kind": "tutor", "school": info["school"]}
        if acc["role"] != "parent":
            raise PortalError(409, "это приглашение для родителя – войдите как родитель")
        invite = self.assistant.subscribe_parent(code, acc["id"])
        if not invite:
            raise PortalError(409, "приглашение уже использовано")
        return {"kind": "parent", "chat_id": invite["chat_id"], "student": invite.get("student_name")}

    def strict(self, chat_id: str) -> bool:
        return self.portal.is_strict(chat_id)


THEMES = ("default", "sunset", "ocean", "forest", "lavender", "candy", "space", "notebook",
          "newyear", "valentine", "spring8", "easter", "summer", "autumn", "halloween", "birthday")


def _prefs(row: dict[str, Any]) -> dict[str, Any]:
    try:
        data = json.loads(row.get("prefs") or "{}")
    except ValueError:
        data = {}
    return data if isinstance(data, dict) else {}


def _language(body: Any) -> str | None:
    from .community import LANGUAGES

    lang = body.get("language") if isinstance(body, dict) else None
    if lang is None:
        return None
    if lang not in LANGUAGES:
        raise PortalError(400, "язык: " + ", ".join(LANGUAGES))
    return lang


ROLE_ACCESS = {TUTOR: "tutor", STUDENT: "student", PARENT: "parent", ADMIN: "school"}
