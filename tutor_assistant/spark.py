"""Помощник «Искорка» внутри платформы: отвечает преподавателю, ученику, родителю и школе.

* Пишут текстом или голосом: голосовое расшифровывается тем же распознаванием речи, что и уроки.
* Отвечает бесплатный ИИ на своём сервере (Ollama) или другой ИИ из настроек. Ответ готовится в фоне:
  на процессоре без видеокарты это занимает от нескольких секунд до пары минут, страница опрашивает сервер.
* Искорка знает только то, что человек и так видит в кабинете: своих учеников, слова, домашку, уроки.
* Без ИИ Искорка всё равно помогает: подсказывает, где что находится, и проверяет слова из карточек.
"""

from __future__ import annotations

import logging
import random
import re
import threading
from datetime import datetime, timedelta, timezone
from typing import Any

from .ai import AIClient
from .portal import Portal, PortalError, Viewer

log = logging.getLogger(__name__)

NAME = "Искорка"
PER_HOUR = 40  # сообщений в час от одного человека: ИИ на сервере один на всех
MAX_TEXT = 2000
MAX_VOICE = 3 * 1024 * 1024

SYSTEM = (
    "Ты – Искорка, помощник на платформе Bright для уроков иностранных языков. "
    "Отвечай по-русски, тепло и по делу, обычно 3–8 предложений. Без таблиц и сложного оформления, "
    "списки – короткими строками. Не придумывай факты о человеке: используй только сведения ниже. "
    "Если просят сделать что-то в интерфейсе (начать урок, оплатить, выдать домашку), коротко подскажи, где кнопка. "
    "Если просят потренировать язык, веди диалог на изучаемом языке, после каждой реплики мягко исправляй ошибки "
    "и давай перевод трудных слов. Не используй тире «—», только короткое «–»."
)
ROLE_RULES = {
    "tutor": "Собеседник – преподаватель. Помогай готовить уроки: план занятия, упражнения с ответами, объяснения "
             "грамматики простыми словами, идеи для доски, письма родителям, ответы на трудные вопросы учеников.",
    "school": "Собеседник – владелец онлайн-школы. Помогай с работой школы: как вести преподавателей, как удерживать "
              "учеников, тексты для родителей и объявлений.",
    "student": "Собеседник – ученик. Объясняй понятно, с примерами. Домашнее задание за ученика не делай: дай подсказку, "
               "разбери похожий пример, проверь его ответ. Хвали за успехи.",
    "parent": "Собеседник – родитель ученика. Объясняй, как помочь ребёнку дома, что значат темы уроков, "
              "как устроена платформа. Оценки преподавателю не ставь.",
}
UI_HINTS = (
    "Где что на сайте: «Сегодня» – главная; урок начинает преподаватель кнопкой «Начать урок» у ученика, ученик входит "
    "кнопкой «Войти в урок»; «Домашка» – задания; «Слова» – карточки; «Материалы» – файлы, учебники и готовые занятия; "
    "«Сообщения» – переписка, можно отправить голосовое; «Оплата» – оплата занятий; «Профиль» – фото, оформление, пароль."
)

# Без ИИ: короткие ответы на частые вопросы
OFFLINE = [
    (r"урок|звон|войти|начать", "Урок начинает преподаватель: «Ученики» → «Начать урок». Ученику придёт уведомление, "
                                "а на его главной появится кнопка «Войти в урок». Разрешите браузеру камеру и микрофон."),
    (r"домашк|задани|дз", "Домашка – в разделе «Домашка». Ответ можно написать, а к письменной работе приложить фото."),
    (r"оплат|деньг|плат", "Оплата занятий – в разделе «Оплата». Преподаватель указывает цену и реквизиты, ученик "
                          "переводит и нажимает «Я оплатил(а)», преподаватель подтверждает."),
    (r"парол", "Забыли пароль? На странице входа нажмите «Забыли пароль?» – придёт письмо со ссылкой."),
    (r"материал|учебник|pdf", "Материалы – в разделе «Материалы»: загрузите PDF учебника, листайте страницы и "
                              "кладите любую на доску одним нажатием."),
    (r"голос|гс|микрофон", "Голосовое можно отправить в «Сообщениях»: нажмите на микрофон, скажите и отпустите. "
                           "Под голосовым появится расшифровка."),
]


class Spark:
    def __init__(self, portal: Portal, learning: Any, accounts: Any):
        self.portal = portal
        self.storage = portal.storage
        self.settings = portal.settings
        self.assistant = portal.assistant
        self.learning = learning
        self.accounts = accounts
        self.ai = AIClient(portal.settings)
        self._busy = threading.Semaphore(1)  # ИИ на процессоре: по одному ответу за раз

    # -- кто спрашивает --------------------------------------------------------------------------------
    def _who(self, viewer: Viewer) -> tuple[str, str]:
        acc = self.storage.get_account(viewer.user_id) if viewer.user_id.startswith("a_") else None
        if acc:
            return acc["role"], acc["name"]
        roles = {a.role for a in self.portal.accesses(viewer)}
        return ("tutor" if "tutor" in roles else "parent" if "parent" in roles and "student" not in roles else "student"), ""

    def _context(self, viewer: Viewer, role: str, name: str) -> str:
        lines = [f"Имя: {name.split()[0] if name else 'не указано'}."]
        try:
            me = self.portal.me(viewer)
            if role == "tutor":
                studs = self.accounts.students(viewer)["students"] if viewer.user_id.startswith("a_") else []
                if studs:
                    lines.append("Ученики: " + "; ".join(
                        f"{s['name']} ({s['language']}{', ещё не подключился' if not s['joined'] else ''}"
                        f"{', оплачено занятий: ' + str(s.get('balance')) if s.get('balance') else ''})" for s in studs[:25]))
                hw = self.learning.homework(viewer)["homework"]
                sent = [h for h in hw if h.get("status") == "done"]
                if sent:
                    lines.append(f"Домашек ждут проверки: {len(sent)}.")
            if role in ("student", "parent"):
                tutors = [c["title"] for c in me["chats"] if c["role"] == role]
                if tutors:
                    lines.append("Преподаватели: " + ", ".join(tutors) + ".")
                langs = sorted({c.get("language") for c in me["chats"] if c.get("language")})
                if langs:
                    lines.append("Изучаемые языки (коды): " + ", ".join(langs) + ".")
            if role == "student":
                hw = [h for h in self.learning.homework(viewer)["homework"] if h.get("status") == "open"]
                if hw:
                    lines.append("Открытая домашка: " + " | ".join(h["text"][:160] for h in hw[:3]))
                words = self.learning.word_list(viewer)[:30]
                if words:
                    lines.append("Слова ученика: " + ", ".join(
                        f"{w['word']} – {w['translation']}" if w.get("translation") else w["word"] for w in words))
            done = [x["title"] for x in me["lessons"] if x["status"] == "finished"][:5]
            if done:
                lines.append("Последние уроки: " + "; ".join(done) + ".")
        except PortalError:
            pass
        return "\n".join(lines)

    # -- переписка --------------------------------------------------------------------------------------
    def history(self, viewer: Viewer) -> dict[str, Any]:
        rows = self.storage.spark_messages(viewer.user_id)
        return {"name": NAME, "ai": self.ai.provider is not None,
                "messages": [{k: r[k] for k in ("id", "role", "text", "status", "created_at")} | {"voice": bool(r["voice"])}
                             for r in rows]}

    def clear(self, viewer: Viewer) -> dict[str, Any]:
        self.storage.clear_spark(viewer.user_id)
        return self.history(viewer)

    def ask(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        text = (body or {}).get("text") if isinstance(body, dict) else None
        if not isinstance(text, str) or not text.strip():
            raise PortalError(400, "напишите вопрос")
        return self._ask(viewer, text.strip()[:MAX_TEXT], voice=False)

    def ask_voice(self, viewer: Viewer, raw: bytes | None) -> dict[str, Any]:
        if not raw or len(raw) < 200:
            raise PortalError(400, "голосовое пустое: запишите ещё раз")
        if len(raw) > MAX_VOICE:
            raise PortalError(413, "голосовое слишком длинное: до 3 минут")
        langs = tuple(dict.fromkeys([self.settings.native_language, self.settings.target_language]))
        transcription, error = self.assistant.transcribe(raw, languages=langs)
        if transcription is None:
            raise PortalError(503, "не получилось распознать голос: " + (error or "распознавание недоступно")
                              + ". Напишите текстом")
        if not transcription.text.strip():
            raise PortalError(422, "в записи не слышно слов: попробуйте ещё раз поближе к микрофону")
        return self._ask(viewer, transcription.text.strip()[:MAX_TEXT], voice=True)

    def _ask(self, viewer: Viewer, text: str, voice: bool) -> dict[str, Any]:
        hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(timespec="seconds")
        if self.storage.spark_count_since(viewer.user_id, hour_ago) >= PER_HOUR:
            raise PortalError(429, "Искорка устала: слишком много вопросов за час. Попробуйте чуть позже")
        role, name = self._who(viewer)
        if role == "parent" and not viewer.user_id.startswith("a_"):
            role = "parent"
        self.storage.add_spark(viewer.user_id, "user", text, voice=voice)
        if self.ai.provider is None:
            self.storage.add_spark(viewer.user_id, "spark", self._offline(viewer, role, text))
            return self.history(viewer)
        pending = self.storage.add_spark(viewer.user_id, "spark", "Думаю…", status="pending")
        system = "\n\n".join([SYSTEM, ROLE_RULES.get(role, ROLE_RULES["student"]), UI_HINTS,
                              "Сведения о собеседнике:\n" + self._context(viewer, role, name)])
        dialog = [{"role": "assistant" if r["role"] == "spark" else "user", "content": r["text"]}
                  for r in self.storage.spark_messages(viewer.user_id, limit=13)
                  if r["status"] == "done" and r["id"] != pending][-12:]
        threading.Thread(target=self._answer, args=(pending, system, dialog), daemon=True).start()
        return self.history(viewer)

    def _answer(self, pending: int, system: str, dialog: list[dict[str, str]]) -> None:
        with self._busy:
            reply = self.ai.chat(system, dialog, timeout=min(self.settings.ai_timeout, 600))
        if reply and reply.strip():
            self.storage.update_spark(pending, _clean(reply), "done")
        else:
            self.storage.update_spark(pending, "Не получилось ответить: ИИ на сервере не отвечает. Попробуйте ещё раз "
                                               "через минуту.", "error")
            log.warning("Искорка не ответила: %s", self.ai.last_error)

    def _offline(self, viewer: Viewer, role: str, text: str) -> str:
        low = text.lower()
        if role == "student" and re.search(r"провер|слов|карточ|тест|quiz", low):
            words = [w for w in self.learning.word_list(viewer) if w.get("translation")]
            if words:
                sample = random.sample(words, min(5, len(words)))
                quiz = "\n".join(f"{i + 1}. {w['word']} – ?" for i, w in enumerate(sample))
                answers = ", ".join(f"{w['word']} – {w['translation']}" for w in sample)
                return f"Давай проверим слова! Переведи:\n{quiz}\n\nОтветы (не подглядывай 🙂): {answers}"
        for pattern, answer in OFFLINE:
            if re.search(pattern, low):
                return answer
        return ("Пока я умею отвечать только на вопросы о платформе и проверять слова из карточек: ИИ на сервере ещё "
                "не включён. Спросите, например: «как начать урок», «где домашка», «проверь мои слова».")


def _clean(text: str) -> str:
    text = text.replace("—", "–").strip()
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)  # жирный markdown в чате не нужен
    return re.sub(r"^#+\s*", "", text, flags=re.M)[:6000]
