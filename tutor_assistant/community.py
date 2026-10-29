"""Сообщество школы на сайте: чат пары вне урока, отзывы, преподаватели и биржа учеников.

Главный принцип – школа остаётся посредником, а контакты не раскрываются:

* **чат** – тот же анонимный мост, что и в Telegram: одна история и одна проверка на контакты
  (номер, разбитый между сайтом и Telegram, тоже склеивается);
* **отзывы** публикуются только после одобрения администратором; демо-отзывы – только
  с пометкой «пример» и только если школа их включила (``TUTOR_DEMO_REVIEWS``);
* **биржа**: ученик бесплатно описывает задачу и бюджет – без контактов в публичной части.
  Проверенные преподаватели школы откликаются со своей ценой. Ученик выбирает – и система
  сама создаёт анонимную пару в боте. Контакт ученика видит только администратор.
"""

from __future__ import annotations

import logging
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from . import catalog
from .models import Role
from .portal import ADMIN, PARENT, Portal, PortalError, Viewer, _field, hash_token
from .relay import STUDENT, TUTOR, RelayService

log = logging.getLogger(__name__)

LEVELS = {"beginner": "начальный", "intermediate": "средний", "advanced": "продвинутый"}
AUDIENCES = {"adult": "взрослый", "kid": "ребёнок или подросток"}
LANGUAGES = {"en": "английский", "zh": "китайский", "es": "испанский", "fr": "французский", "it": "итальянский",
             "pt": "португальский", "ar": "арабский", "sr": "сербский", "hi": "хинди", "el": "греческий"}
BUDGETS = {
    "lt1000": "до 1 000 ₽", "1000-1500": "1 000–1 500 ₽", "1500-2500": "1 500–2 500 ₽",
    "gt2500": "от 2 500 ₽", "discuss": "обсуждается",
}
REQUESTS_PER_DAY = 3  # с одного IP
MAX_CHAT_TEXT = 4000
MAX_VOICE = 5 * 1024 * 1024  # голосовое до ~5 минут
TEACHER_STATUSES = ("pending", "approved", "rejected")
REVIEW_STATUSES = ("pending", "approved", "rejected")

# Примеры отзывов – ТОЛЬКО для демонстрации вида блока. Помечаются «пример» и не показываются,
# пока школа явно не включит TUTOR_DEMO_REVIEWS. Заменяются настоящими отзывами из кабинета.
DEMO_REVIEWS: list[dict[str, Any]] = [
    {"author_name": "Пример: взрослый ученик", "author_role": "student", "audience": "adult", "course_id": "it-english",
     "rating": 5, "text": "Так будет выглядеть отзыв взрослого ученика: что было до занятий, что изменилось, "
                         "что понравилось в формате."},
    {"author_name": "Пример: родитель", "author_role": "parent", "audience": "kid", "course_id": "kids-english",
     "rating": 5, "text": "Так будет выглядеть отзыв родителя: как ребёнок занимается, помогают ли отчёты после "
                         "уроков, заметен ли прогресс."},
    {"author_name": "Пример: преподаватель", "author_role": "teacher", "audience": None, "course_id": None,
     "rating": 5, "text": "Так будет выглядеть отзыв преподавателя о школе: ученики, конспекты, которые готовятся "
                         "сами, удобство онлайн-класса."},
    {"author_name": "Пример: ученик HSK", "author_role": "student", "audience": "adult", "course_id": "hsk-4",
     "rating": 5, "text": "Так будет выглядеть отзыв о подготовке к экзамену: с какого уровня начали и какой "
                         "результат получили."},
]


@dataclass(frozen=True)
class Thread:
    chat_id: str
    role: str  # моя роль в переписке
    title: str  # с кем
    pair: Any
    alias: str  # как меня видит собеседник
    other_user: str | None
    can_write: bool


class Community:
    def __init__(self, portal: Portal):
        self.portal = portal
        self.assistant = portal.assistant
        self.storage = portal.storage
        self.settings = portal.settings
        self.relay = RelayService(self.storage)
        self._support_hits: dict[str, list[float]] = {}

    # -- роли ----------------------------------------------------------------------
    def teacher_status(self, viewer: Viewer) -> str | None:
        """approved – может работать с биржей. Преподаватель действующей пары считается проверенным."""
        row = self.storage.get_teacher(viewer.user_id)
        if row and row["status"] == "rejected":
            return "rejected"
        if any(a.role == TUTOR for a in self.portal.accesses(viewer)) or viewer.admin:
            return "approved"
        acc = self.storage.get_account(viewer.user_id) if viewer.user_id.startswith("a_") else None
        if acc and acc["role"] == "tutor":  # репетитор с аккаунтом сам отвечает за своих учеников
            return "approved"
        return row["status"] if row else None

    def _require_teacher(self, viewer: Viewer) -> None:
        if self.teacher_status(viewer) != "approved":
            raise PortalError(403, "откликаться могут проверенные преподаватели школы")

    def teacher_name(self, user_id: str) -> str:
        row = self.storage.get_teacher(user_id)
        if row:
            return row["name"]
        for p in self.storage.pairs_for_user(user_id):
            if p["tutor_user_id"] == user_id:
                return p["tutor_alias"]
        return "Преподаватель"

    def _clean(self, text: str | None, what: str) -> str | None:
        """Публичный текст не должен содержать контактов."""
        if text and self.assistant.moderate(text).is_violation:
            raise PortalError(422, f"{what}: без телефонов, ников и ссылок – общение идёт через платформу школы")
        return text

    # == переписка вне урока =============================================================
    # Ветки: «pair:<id>» – преподаватель и ученик; «pp:<id>:<родитель>» – преподаватель и родитель;
    # «ps:<id>:<родитель>» – родитель и школа. Школа читает переписки своих преподавателей, но не пишет в них.
    def _parent_name(self, user_id: str) -> str:
        acc = self.storage.get_account(user_id) if user_id.startswith("a_") else None
        return f"{acc['name'].split()[0]} (родитель)" if acc else "Родитель"

    def _thread(self, viewer: Viewer, chat_id: str) -> Thread:
        if chat_id.startswith("ps:"):
            try:
                _, pair_id, parent_id = chat_id.split(":", 2)
            except ValueError:
                raise PortalError(404, "переписка не найдена") from None
            access = self.portal._access(viewer, f"pair:{pair_id}")
            pair = access.pair
            org = self.portal.org_of(pair)
            if not pair or not org or parent_id not in self.storage.parents_for(pair.chat_id):
                raise PortalError(404, "переписка не найдена")
            school = f"Школа «{org['name']}»"
            if access.role == PARENT and viewer.user_id == parent_id:
                return Thread(chat_id, "parent", school, pair, self._parent_name(parent_id), org["owner_id"], True)
            if access.role == ADMIN:
                owner = viewer.user_id == org["owner_id"]
                return Thread(chat_id, "school", f"{self._parent_name(parent_id)} · {pair.student_alias}", pair, school,
                              parent_id if owner else None, owner)
            raise PortalError(403, "нет доступа к переписке")
        if chat_id.startswith("pp:"):
            try:
                _, pair_id, parent_id = chat_id.split(":", 2)
            except ValueError:
                raise PortalError(404, "переписка не найдена") from None
            access = self.portal._access(viewer, f"pair:{pair_id}")
            pair = access.pair
            if not pair or parent_id not in self.storage.parents_for(pair.chat_id):
                raise PortalError(404, "переписка не найдена")
            if access.role == PARENT and viewer.user_id == parent_id:
                return Thread(chat_id, "parent", pair.tutor_alias, pair, self._parent_name(parent_id),
                              pair.tutor_user_id, True)
            if access.role == TUTOR:
                return Thread(chat_id, TUTOR, self._parent_name(parent_id), pair, pair.tutor_alias, parent_id, True)
            if access.role == ADMIN:
                return Thread(chat_id, ADMIN, f"{pair.tutor_alias} ↔ {self._parent_name(parent_id)}", pair, "", None,
                              False)
            raise PortalError(403, "нет доступа к переписке")
        access = self.portal._access(viewer, chat_id)
        if not access.pair:
            raise PortalError(403, "переписка доступна участникам пары")
        pair = access.pair
        if access.role in (TUTOR, STUDENT):
            return Thread(chat_id, access.role, access.title, pair, pair.alias(access.role),
                          pair.other_user(access.role), True)
        if access.role == ADMIN:
            return Thread(chat_id, ADMIN, access.title, pair, "", None, False)
        raise PortalError(403, "переписка доступна преподавателю и ученику пары")

    def chats(self, viewer: Viewer) -> dict[str, Any]:
        out = []

        def add(t: Thread) -> None:
            last = self.storage.pair_messages(t.chat_id, limit=1)
            out.append({"chat_id": t.chat_id, "title": t.title, "role": t.role, "can_write": t.can_write,
                        "kind": {"pp": "parent", "ps": "school"}.get(t.chat_id.split(":", 1)[0], "student"),
                        "last": last[-1] if last else None,
                        "unread": self.storage.unread_count(t.chat_id, viewer.user_id, t.role) if t.can_write else 0})

        for a in self.portal.accesses(viewer):
            if not a.pair:
                continue
            org = self.portal.org_of(a.pair)
            if a.role in (TUTOR, STUDENT, ADMIN):
                add(self._thread(viewer, a.chat_id))
            if a.role == TUTOR:
                for parent in self.storage.parents_for(a.chat_id):
                    add(self._thread(viewer, f"pp:{a.pair.id}:{parent}"))
            if a.role == ADMIN and org and org["owner_id"] == viewer.user_id:
                for parent in self.storage.parents_for(a.chat_id):
                    add(self._thread(viewer, f"ps:{a.pair.id}:{parent}"))
            if a.role == PARENT:
                add(self._thread(viewer, f"pp:{a.pair.id}:{viewer.user_id}"))
                if org:
                    add(self._thread(viewer, f"ps:{a.pair.id}:{viewer.user_id}"))
        return {"chats": out}

    def messages(self, viewer: Viewer, chat_id: str, since: int = 0) -> dict[str, Any]:
        t = self._thread(viewer, chat_id)
        rows = self.storage.pair_messages(chat_id, since=since)
        if rows and t.can_write:
            self.storage.mark_read(chat_id, viewer.user_id, rows[-1]["id"])
        return {"chat_id": chat_id, "role": t.role, "with": t.title, "can_write": t.can_write,
                "messages": [{**{k: r[k] for k in ("id", "role", "author", "text", "source", "blocked", "created_at")},
                              "audio": f"/site/v1/files/{r['audio']}" if r.get("audio") and not r["blocked"] else None}
                             for r in rows]}

    def send(self, viewer: Viewer, chat_id: str, body: Any) -> dict[str, Any]:
        t = self._thread(viewer, chat_id)
        if not t.can_write:
            raise PortalError(403, "школа читает переписку, но не пишет в неё")
        text = body.get("text") if isinstance(body, dict) else None
        if not isinstance(text, str) or not text.strip() or len(text) > MAX_CHAT_TEXT:
            raise PortalError(400, f"текст: от 1 до {MAX_CHAT_TEXT} символов")
        return self._post(viewer, t, chat_id, text.strip())

    def send_voice(self, viewer: Viewer, chat_id: str, raw: bytes | None, mime: str, save_file: Any) -> dict[str, Any]:
        """Голосовое: сохраняем звук, расшифровываем и проверяем текст так же, как обычное сообщение.

        В строгих парах (школа) голосовое без расшифровки не пропускаем: проверить контакты в нём нечем.
        """
        t = self._thread(viewer, chat_id)
        if not t.can_write:
            raise PortalError(403, "школа читает переписку, но не пишет в неё")
        if not raw or len(raw) < 200:
            raise PortalError(400, "голосовое пустое: запишите ещё раз")
        if len(raw) > MAX_VOICE:
            raise PortalError(413, "голосовое слишком длинное: до 5 минут")
        strict = self.portal.is_strict(t.pair.chat_id) and not chat_id.startswith("ps:")
        langs = tuple(dict.fromkeys([self.settings.native_language,
                                     self.storage.chat_language(t.pair.chat_id) or self.settings.target_language]))
        transcription, _error = self.assistant.transcribe(raw, languages=langs)
        text = (transcription.text if transcription else "").strip()
        if strict and transcription is None and not self.settings.relay_unchecked_audio:
            raise PortalError(503, "голосовые сейчас недоступны: не работает распознавание речи. Напишите текстом")
        file_id = save_file(raw, mime)
        return self._post(viewer, t, chat_id, text or "🎤 Голосовое сообщение", source="voice", audio=file_id,
                          check=bool(text))

    def _post(self, viewer: Viewer, t: Thread, chat_id: str, text: str, source: str = "site", audio: str | None = None,
              check: bool = True) -> dict[str, Any]:
        pair, role, alias = t.pair, t.role, t.alias
        lesson = self.storage.active_lesson(pair.chat_id) if chat_id == pair.chat_id else None
        strict = self.portal.is_strict(pair.chat_id) and not chat_id.startswith("ps:")  # со школой можно делиться
        if lesson and check:  # во время урока сообщение ученику – часть урока: слова, ДЗ, конспект
            out = self.assistant.process_message(lesson["id"], viewer.user_id, alias, text,
                                                 role=Role.TUTOR if role == TUTOR else Role.STUDENT, moderate=strict)
            result, incident_id = out.moderation, out.incident_id
        elif strict and check:  # та же проверка, что и для Telegram-моста этой пары
            result, incident_id = self.assistant.moderate_chat_message(chat_id, viewer.user_id, alias, text,
                                                                       role=role if role in (TUTOR, STUDENT) else None)
        else:  # частный репетитор: переписка с его учениками и родителями не фильтруется
            result, incident_id = self.assistant.guard.check(""), None
        stored = result.redacted_text if result.blocked else text
        msg_id = self.storage.add_pair_message(chat_id, role, alias, stored, source=source, blocked=result.blocked,
                                               audio=audio)
        who = {"tutor": "преподаватель", "student": "ученик", "parent": "родитель"}.get(role, role)
        if result.is_violation:
            self.portal.notify_violation(pair.chat_id, f"🚨 Нарушение #{incident_id or '–'} (переписка на сайте, "
                                         f"пара {pair.id}): {result.summary}\nКто: {who} «{alias}»\nТекст:\n{text[:1500]}")
        delivered = False
        if not result.blocked:
            link = f"\n\nОтветить: {self.settings.site_url}/#/app/messages" if self.settings.site_url else ""
            prefix = "🎤 " if source == "voice" else ""
            delivered = self.portal.telegram(t.other_user, f"{alias}: {prefix}{text}{link}")
        return {"id": msg_id, "stored": stored, "moderation": result.to_dict(), "delivered_to_telegram": delivered,
                "audio": f"/site/v1/files/{audio}" if audio and not result.blocked else None}

    # == отзывы =========================================================================
    def public_reviews(self) -> dict[str, Any]:
        rows = [{"id": r["id"], "author_name": r["author_name"], "author_role": r["author_role"],
                 "audience": r["audience"], "course_id": r["course_id"], "rating": r["rating"], "text": r["text"],
                 "created_at": r["created_at"], "demo": False} for r in self.storage.reviews("approved")]
        if self.settings.demo_reviews and not rows:
            rows = [{**r, "id": f"demo{i}", "demo": True, "created_at": None} for i, r in enumerate(DEMO_REVIEWS)]
        real = [r for r in rows if not r["demo"]]
        avg = round(sum(r["rating"] for r in real) / len(real), 1) if real else None
        return {"reviews": rows, "count": len(real), "average": avg}

    def submit_review(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        if not isinstance(body, dict):
            raise PortalError(400, "нужен JSON-объект")
        roles = {a.role for a in self.portal.accesses(viewer)}
        if TUTOR in roles or self.teacher_status(viewer) == "approved":
            role = "teacher"
        elif PARENT in roles:
            role = "parent"
        elif STUDENT in roles:
            role = "student"
        else:
            raise PortalError(403, "отзыв могут оставить ученики, родители и преподаватели школы")
        rating = body.get("rating")
        if not isinstance(rating, int) or isinstance(rating, bool) or not 1 <= rating <= 5:
            raise PortalError(400, "оценка – от 1 до 5")
        text = _field(body, "text", 1500, required=True)
        if len(text) < 20:
            raise PortalError(400, "напишите хотя бы пару предложений (от 20 символов)")
        name = _field(body, "author_name", 60, required=True)
        course_id = _field(body, "course_id", 60)
        if course_id and course_id not in catalog.course_ids():
            raise PortalError(400, "неизвестное направление")
        self._clean(text, "Отзыв")
        self._clean(name, "Имя")
        audience = body.get("audience") if body.get("audience") in AUDIENCES else None
        review_id = self.storage.add_review(user_id=viewer.user_id, author_role=role, author_name=name,
                                            audience=audience, course_id=course_id, rating=rating, text=text)
        self.portal.notify_admin(f"⭐ Новый отзыв #{review_id} ({rating}/5) от «{name}» – ждёт одобрения в кабинете.")
        return {"id": review_id, "status": "pending"}

    def my_reviews(self, viewer: Viewer) -> dict[str, Any]:
        return {"reviews": self.storage.reviews_by_user(viewer.user_id)}

    def admin_reviews(self, viewer: Viewer) -> dict[str, Any]:
        self._admin(viewer)
        return {"reviews": self.storage.reviews(None)}

    def set_review_status(self, viewer: Viewer, review_id: int, status: Any) -> dict[str, Any]:
        self._admin(viewer)
        if status not in REVIEW_STATUSES:
            raise PortalError(400, "status: " + ", ".join(REVIEW_STATUSES))
        if not self.storage.set_review_status(review_id, status):
            raise PortalError(404, "отзыв не найден")
        return {"id": review_id, "status": status}

    @staticmethod
    def _admin(viewer: Viewer) -> None:
        if not viewer.admin:
            raise PortalError(403, "доступно администраторам школы")

    # == преподаватели ===================================================================
    def teacher_profile(self, viewer: Viewer) -> dict[str, Any]:
        row = self.storage.get_teacher(viewer.user_id)
        return {"status": self.teacher_status(viewer), "profile": row,
                "fee_percent": self.settings.market_fee_percent}

    def save_teacher_profile(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        if not isinstance(body, dict):
            raise PortalError(400, "нужен JSON-объект")
        name = _field(body, "name", 60, required=True)
        bio = _field(body, "bio", 1200)
        languages = _field(body, "languages", 100)
        specialties = _field(body, "specialties", 300)
        rate = body.get("rate")
        if rate is not None and (not isinstance(rate, int) or isinstance(rate, bool) or not 300 <= rate <= 20000):
            raise PortalError(400, "ставка – от 300 до 20 000 ₽ за урок")
        for value, what in ((name, "Имя"), (bio, "О себе"), (specialties, "Специализация")):
            self._clean(value, what)
        new = self.storage.get_teacher(viewer.user_id) is None
        # Преподаватель действующей пары уже проверен школой
        auto = self.teacher_status(viewer) == "approved"
        self.storage.upsert_teacher(viewer.user_id, name, bio=bio, languages=languages, specialties=specialties,
                                    rate=rate, status="approved" if auto else "pending")
        if new and not auto:
            self.portal.notify_admin(f"👩‍🏫 Новая анкета преподавателя «{name}» – одобрите в кабинете (Преподаватели).")
        return self.teacher_profile(viewer)

    def admin_teachers(self, viewer: Viewer) -> dict[str, Any]:
        self._admin(viewer)
        return {"teachers": self.storage.teachers()}

    def set_teacher_status(self, viewer: Viewer, user_id: str, status: Any) -> dict[str, Any]:
        self._admin(viewer)
        if status not in TEACHER_STATUSES:
            raise PortalError(400, "status: " + ", ".join(TEACHER_STATUSES))
        if not self.storage.set_teacher_status(user_id, status):
            raise PortalError(404, "преподаватель не найден")
        if status == "approved":
            link = f"\n{self.settings.site_url}/#/market" if self.settings.site_url else ""
            self.portal.telegram(user_id, "✅ Школа одобрила вашу анкету. Теперь вы можете откликаться на заявки "
                                          f"учеников на бирже.{link}")
        return {"user_id": user_id, "status": status}

    # == биржа учеников =====================================================================
    def market_meta(self) -> dict[str, Any]:
        open_rows = self.storage.market_requests("open")
        return {"levels": LEVELS, "audiences": AUDIENCES, "languages": LANGUAGES, "budgets": BUDGETS,
                "open": len(open_rows), "fee_percent": self.settings.market_fee_percent,
                "teachers": len(self.storage.teachers("approved"))}

    def create_request(self, body: Any, ip: str | None) -> dict[str, Any]:
        if not isinstance(body, dict):
            raise PortalError(400, "нужен JSON-объект")
        if body.get("website"):  # ловушка для ботов
            return {"id": None, "key": None}
        name = _field(body, "name", 40, required=True)
        contact = _field(body, "contact", 120, required=True)
        goals = _field(body, "goals", 800, required=True)
        wishes = _field(body, "teacher_wishes", 500)
        comment = _field(body, "comment", 800)
        schedule = _field(body, "schedule", 200)
        age = body.get("age")
        if age is not None and (not isinstance(age, int) or isinstance(age, bool) or not 4 <= age <= 99):
            raise PortalError(400, "возраст – от 4 до 99")
        choice = lambda key, opts: body.get(key) if body.get(key) in opts else None  # noqa: E731
        audience, language, level, budget = (choice("audience", AUDIENCES), choice("language", LANGUAGES),
                                             choice("level", LEVELS), choice("budget", BUDGETS))
        if not (audience and language and level and budget):
            raise PortalError(400, "выберите, для кого занятия, язык, уровень и бюджет")
        course_id = _field(body, "course_id", 60)
        if course_id and course_id not in catalog.course_ids():
            raise PortalError(400, "неизвестное направление")
        if not body.get("consent"):
            raise PortalError(400, "нужно согласие на обработку персональных данных")
        for value, what in ((name, "Имя"), (goals, "Цели"), (wishes, "Пожелания"), (comment, "Комментарий"),
                            (schedule, "Расписание")):
            self._clean(value, what)
        if ip and self.storage.market_requests_since(ip, datetime.now(timezone.utc) - timedelta(days=1)) \
                >= REQUESTS_PER_DAY:
            raise PortalError(429, "слишком много заявок – попробуйте завтра")
        request_id, key = secrets.token_hex(5), secrets.token_urlsafe(24)
        self.storage.add_market_request(id=request_id, owner_hash=hash_token(key), name=name.split()[0], age=age,
                                        audience=audience, language=language, course_id=course_id, level=level,
                                        goals=goals, teacher_wishes=wishes, comment=comment, budget=budget,
                                        schedule=schedule, contact=contact, ip=ip)
        self.portal.notify_admin(f"🧭 Новая заявка на бирже #{request_id}: {name}, {LANGUAGES[language]}, "
                                 f"{LEVELS[level]}, бюджет {BUDGETS[budget]}\nСвязь (видит только школа): {contact}")
        self._notify_teachers(request_id, language)
        return {"id": request_id, "key": key}

    def _notify_teachers(self, request_id: str, language: str) -> None:
        link = f"\n{self.settings.site_url}/#/market?r={request_id}" if self.settings.site_url else ""
        for t in self.storage.teachers("approved"):
            langs = (t.get("languages") or "").lower()
            if not langs or LANGUAGES[language][:4] in langs or language in langs:
                self.portal.telegram(t["user_id"], f"🧭 Новая заявка ученика на бирже ({LANGUAGES[language]}).{link}")

    def _public(self, r: dict[str, Any]) -> dict[str, Any]:
        course = next((c["title"] for c in catalog.COURSES if c["id"] == r.get("course_id")), None)
        return {"id": r["id"], "name": r["name"], "age": r["age"], "audience": r["audience"],
                "audience_ru": AUDIENCES.get(r["audience"]), "language": r["language"],
                "language_ru": LANGUAGES.get(r["language"]), "course": course, "level": r["level"],
                "level_ru": LEVELS.get(r["level"]), "goals": r["goals"], "teacher_wishes": r["teacher_wishes"],
                "comment": r["comment"], "budget": r["budget"], "budget_ru": BUDGETS.get(r["budget"]),
                "schedule": r["schedule"], "status": r["status"], "created_at": r["created_at"],
                "proposals": r.get("proposals", 0)}

    def public_requests(self) -> dict[str, Any]:
        return {**self.market_meta(), "requests": [self._public(r) for r in self.storage.market_requests("open")]}

    def _owned(self, request_id: str, key: str | None) -> dict[str, Any]:
        r = self.storage.market_request(request_id)
        if not r or not key or hash_token(key) != r["owner_hash"]:
            raise PortalError(404, "заявка не найдена – проверьте ссылку")
        return r

    def owner_view(self, request_id: str, key: str | None) -> dict[str, Any]:
        r = self._owned(request_id, key)
        proposals = [{"id": p["id"], "teacher": p["teacher_name"] or self.teacher_name(p["teacher_id"]),
                      "bio": p["bio"], "languages": p["languages"], "specialties": p["specialties"],
                      "message": p["message"], "price": p["price"], "status": p["status"],
                      "created_at": p["created_at"]} for p in self.storage.proposals(request_id)]
        data = {**self._public(r), "proposals": proposals, "links": None}
        if r["status"] == "matched" and r["pair_id"]:
            data["links"] = self._pair_links(r["pair_id"], r["audience"])
        return data

    def propose(self, viewer: Viewer, request_id: str, body: Any) -> dict[str, Any]:
        self._require_teacher(viewer)
        r = self.storage.market_request(request_id)
        if not r:
            raise PortalError(404, "заявка не найдена")
        if r["status"] != "open":
            raise PortalError(409, "ученик уже выбрал преподавателя")
        if not isinstance(body, dict):
            raise PortalError(400, "нужен JSON-объект")
        message = _field(body, "message", 1000, required=True)
        price = body.get("price")
        if not isinstance(price, int) or isinstance(price, bool) or not 300 <= price <= 20000:
            raise PortalError(400, "цена – от 300 до 20 000 ₽ за урок")
        result, incident_id = self.assistant.moderate_chat_message(f"market:{request_id}", viewer.user_id,
                                                                   self.teacher_name(viewer.user_id), message,
                                                                   role=Role.TUTOR)
        if result.is_violation:
            self.portal.notify_admin(f"🚨 Нарушение #{incident_id or '—'} (отклик на бирже #{request_id}): "
                                     f"{result.summary}\nПреподаватель id {viewer.user_id}\nТекст:\n{message[:1500]}")
            raise PortalError(422, "в отклике не должно быть контактов: " + result.summary
                              + ". Нарушение передано администратору школы.")
        if not self.storage.get_teacher(viewer.user_id):
            self.storage.upsert_teacher(viewer.user_id, self.teacher_name(viewer.user_id), status="approved")
        proposal_id = self.storage.add_proposal(request_id, viewer.user_id, message, price)
        return {"id": proposal_id, "request_id": request_id}

    # == обратная связь команде платформы ===============================================
    FEEDBACK_KINDS = {"idea": "💡 Идея", "bug": "🐞 Ошибка", "praise": "❤️ Спасибо", "other": "✉️ Другое"}

    def feedback(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        body = body if isinstance(body, dict) else {}
        kind = body.get("kind") if body.get("kind") in self.FEEDBACK_KINDS else "other"
        text = body.get("text")
        if not isinstance(text, str) or not 5 <= len(text.strip()) <= 3000:
            raise PortalError(400, "напишите пару слов – от 5 до 3000 символов")
        acc = self.storage.get_account(viewer.user_id) if viewer.user_id.startswith("a_") else None
        name, role = (acc["name"], acc["role"]) if acc else (None, None)
        fid = self.storage.add_feedback(viewer.user_id, name, role, kind, text.strip())
        who = f"{name} ({role}, {acc['email']})" if acc else f"пользователь {viewer.user_id}"
        self.portal.notify_admin(f"{self.FEEDBACK_KINDS[kind]} – обратная связь #{fid} от {who}:\n{text.strip()[:1500]}")
        return {"id": fid}

    def support(self, body: Any, viewer: Viewer | None, ip: str | None) -> dict[str, Any]:
        """Окно помощи: вопрос из любого места сайта, в том числе до входа. Приходит админу в Telegram и на почту поддержки."""
        import time as _time

        body = body if isinstance(body, dict) else {}
        if body.get("website"):  # ловушка для ботов
            return {"id": None}
        text = body.get("text")
        if not isinstance(text, str) or not 5 <= len(text.strip()) <= 3000:
            raise PortalError(400, "опишите вопрос в двух словах (от 5 символов)")
        acc = self.storage.get_account(viewer.user_id) if viewer and viewer.user_id.startswith("a_") else None
        contact = (acc["email"] if acc else _field(body, "contact", 120)) or ""
        if not acc and not re.search(r"\S+@\S+\.\S+|@\w{3,}|\d{6,}", contact):
            raise PortalError(400, "оставьте почту или @ник в Telegram, чтобы мы могли ответить")
        key = ip or "-"
        now = _time.monotonic()
        hits = [t for t in self._support_hits.get(key, []) if now - t < 3600]
        if len(hits) >= 8:
            raise PortalError(429, "вы уже отправили несколько обращений, мы ответим на них, подождите немного")
        self._support_hits[key] = hits + [now]
        kind = body.get("kind") if body.get("kind") in ("help", "bug", "payment", "idea") else "help"
        page = _field(body, "page", 120) or ""
        name, role = (acc["name"], acc["role"]) if acc else (_field(body, "name", 60), None)
        fid = self.storage.add_feedback(viewer.user_id if viewer else "anon", name, role, f"help:{kind}", text.strip(), contact)
        label = {"help": "Вопрос", "bug": "Ошибка", "payment": "Оплата", "idea": "Идея"}[kind]
        who = f"{name or 'аноним'} ({role or 'не вошёл'}), {contact}"
        message = f"{label} #{fid}\nОт: {who}\nСтраница: {page or '—'}\n\n{text.strip()[:2500]}"
        self.portal.notify_admin("🆘 " + message)
        self.portal.mailer.send(self.settings.support_email, f"[{self.settings.school_name}] {label} #{fid}", message,
                                reply_to=contact if "@" in contact and " " not in contact else None)
        if "@" in contact and " " not in contact:
            self.portal.mailer.send(contact, f"{self.settings.school_name}: мы получили ваше обращение",
                                    f"Здравствуйте! Мы получили сообщение №{fid} и ответим на эту почту, обычно в течение дня.\n\n"
                                    f"Ваш вопрос:\n{text.strip()[:1000]}", reply_to=self.settings.support_email)
        return {"id": fid, "email": self.settings.support_email}

    def feedback_list(self, viewer: Viewer) -> dict[str, Any]:
        self._admin(viewer)
        return {"feedback": self.storage.feedback_list()}

    def my_proposals(self, viewer: Viewer) -> dict[str, Any]:
        return {"proposals": self.storage.proposals_by_teacher(viewer.user_id),
                "status": self.teacher_status(viewer)}

    def choose(self, request_id: str, key: str | None, proposal_id: Any) -> dict[str, Any]:
        r = self._owned(request_id, key)
        if r["status"] != "open":
            raise PortalError(409, "преподаватель уже выбран")
        proposal = next((p for p in self.storage.proposals(request_id) if p["id"] == proposal_id), None)
        if not proposal:
            raise PortalError(404, "отклик не найден")
        teacher_id = proposal["teacher_id"]
        teacher = proposal["teacher_name"] or self.teacher_name(teacher_id)
        # Анонимная пара в боте: преподаватель привязан сразу, ученику – ссылка-приглашение
        pair = self.relay.create_pair(teacher, r["name"], created_by="market")
        self.storage.bind_pair_user(pair.id, TUTOR, teacher_id)
        self.storage.update_market_request(request_id, status="matched", chosen_proposal=proposal_id, pair_id=pair.id)
        for p in self.storage.proposals(request_id):
            self.storage.set_proposal_status(p["id"], "accepted" if p["id"] == proposal_id else "declined")
        self.portal.telegram(teacher_id, f"🎉 Ученик «{r['name']}» выбрал вас на бирже (заявка #{request_id}, "
                                         f"{proposal['price']} ₽ за урок). Пара {pair.id} создана – как только ученик "
                                         "подключится, бот сообщит. Пишите ему через бота.")
        self.portal.notify_admin(f"🤝 Биржа: заявка #{request_id} → преподаватель «{teacher}» ({proposal['price']} ₽). "
                                 f"Пара {pair.id}. Связь с учеником: {r['contact']}")
        return {"status": "matched", "links": self._pair_links(pair.id, r["audience"])}

    def _pair_links(self, pair_id: str, audience: str) -> dict[str, str | None]:
        """Ссылки ученику и родителю: на сайт (Telegram есть не у всех) и, если настроен бот, в Telegram."""
        pair = self.relay.get(pair_id)
        if not pair:
            return {"student": None, "parent": None, "site_student": None, "site_parent": None}
        site = self.settings.site_url or ""
        invite = next(iter(self.storage.invites_for(pair.id, "student")), None)
        if not invite:
            self.storage.add_invite(secrets.token_urlsafe(10), "student", pair.id, pair.tutor_user_id or "market")
            invite = self.storage.invites_for(pair.id, "student")[0]
        kid = audience == "kid"
        parent_code = self._parent_code(pair) if kid else None
        links = {"site_student": f"{site}/#/join?code={invite['code']}",
                 "site_parent": f"{site}/#/join?code={parent_code}" if kid else None,
                 "student": None, "parent": None}
        if self.settings.bot_username:
            _, s_payload = self.relay.invite_payloads(pair)
            base = f"https://t.me/{self.settings.bot_username}?start="
            links["student"] = base + s_payload
            links["parent"] = base + "p_" + parent_code if kid else None
        return links

    def _parent_code(self, pair) -> str:
        row = self.storage._one("SELECT code FROM parent_invites WHERE chat_id=? ORDER BY rowid LIMIT 1", (pair.chat_id,))
        if row:
            return row["code"]
        return self.assistant.create_parent_invite(pair.chat_id, pair.student_alias, created_by="market")

    def close_request(self, request_id: str, key: str | None) -> dict[str, Any]:
        r = self._owned(request_id, key)
        if r["status"] == "open":
            self.storage.update_market_request(request_id, status="closed")
        return {"status": "closed" if r["status"] == "open" else r["status"]}

    def admin_requests(self, viewer: Viewer) -> dict[str, Any]:
        self._admin(viewer)
        rows = self.storage.market_requests(None)
        return {"requests": [{**self._public(r), "contact": r["contact"], "pair_id": r["pair_id"]} for r in rows]}

    # == кабинет родителя ======================================================================
    def parent_overview(self, viewer: Viewer) -> dict[str, Any]:
        children = []
        for a in self.portal.accesses(viewer):
            if a.role != PARENT:
                continue
            lessons = [x for x in self.storage.lessons_for_chats([a.chat_id], limit=100) if x["status"] == "finished"
                       and (self.storage.report_published(x["id"]) or self.storage.get_report(x["id"]) is None)]
            last = self.storage.get_report(lessons[0]["id"]) if lessons else None
            words = 0
            if lessons:
                words = len(self.storage.all_words(self.assistant.owner_for(lessons[0])))
            children.append({
                "chat_id": a.chat_id, "name": a.title, "lessons": len(lessons), "words": words,
                "last": None if not last else {
                    "lesson_id": lessons[0]["id"], "date": last.date, "topic": last.topic,
                    "summary": last.parent.summary, "homework": [h.text for h in last.homework_teacher]
                    or [h.text for h in last.homework[:3]],
                    "attention": last.parent.attention[:3], "achievements": last.parent.achievements[:3],
                },
            })
        return {"children": children}


