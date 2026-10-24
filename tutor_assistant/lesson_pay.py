"""Оплата занятий учеником: по желанию преподавателя или школы.

Платформа деньги не принимает и не хранит. Преподаватель (или школа) вписывает реквизиты, ученик переводит
деньги сам и нажимает «Я оплатил(а)», преподаватель подтверждает, что деньги пришли. После подтверждения
занятия попадают на баланс ученика, а каждый проведённый урок списывает одно занятие.

Настройки (всё необязательно, по умолчанию выключено):
* ``price``: цена одного занятия, ``packs``: пакеты, которые может купить ученик (1, 4, 5, 8, 10 занятий);
* ``remind``: напоминать об оплате ``before`` (когда начался урок, а занятий на балансе нет) или
  ``after`` (когда урок закончился и занятий не осталось);
* ``require_prepay``: ученик не входит в урок, пока нет оплаченного занятия;
* ``requisites``: куда переводить (карта, телефон для СБП, ссылка на оплату).
Уведомления идут письмом на почту и в Telegram, если он привязан.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from .portal import Portal, PortalError, Viewer
from .relay import Pair

PACKS = (1, 4, 5, 8, 10)
MIN_LESSON_MINUTES = 5  # короче урок считается случайным запуском и занятие не списывает
DEFAULT = {"enabled": False, "price": 0, "packs": [1, 4], "remind": "after", "require_prepay": False, "requisites": ""}


def _cfg(raw: str | None) -> dict[str, Any]:
    try:
        data = json.loads(raw or "{}")
    except ValueError:
        data = {}
    out = {**DEFAULT, **(data if isinstance(data, dict) else {})}
    out["packs"] = [p for p in out.get("packs", []) if p in PACKS] or [1]
    return out


class LessonPay:
    def __init__(self, portal: Portal):
        self.portal = portal
        self.storage = portal.storage
        self.settings = portal.settings

    # -- настройки -----------------------------------------------------------------------------------
    def _account(self, viewer: Viewer) -> dict[str, Any]:
        acc = self.storage.get_account(viewer.user_id) if viewer.user_id.startswith("a_") else None
        if not acc:
            raise PortalError(403, "этот раздел для аккаунтов сайта")
        return acc

    def payee(self, tutor: dict[str, Any] | None) -> dict[str, Any] | None:
        """Чьи настройки действуют: у преподавателя школы школьные, у частного репетитора свои."""
        if not tutor:
            return None
        if tutor.get("org_id") and tutor["role"] == "tutor":
            org = self.storage.get_org(tutor["org_id"])
            return self.storage.get_account(org["owner_id"]) if org else tutor
        return tutor

    def config_for_pair(self, pair: Pair | None) -> dict[str, Any] | None:
        """Настройки оплаты для пары или None, если оплата занятий выключена."""
        if not pair or not pair.tutor_user_id or not pair.tutor_user_id.startswith("a_"):
            return None
        payee = self.payee(self.storage.get_account(pair.tutor_user_id))
        cfg = _cfg(payee.get("pay_cfg") if payee else None)
        return cfg if cfg["enabled"] else None

    def get_config(self, viewer: Viewer) -> dict[str, Any]:
        acc = self._account(viewer)
        if acc["role"] not in ("tutor", "school"):
            raise PortalError(403, "настройки оплаты занятий для преподавателей и школ")
        own = self.payee(acc)
        return {"config": _cfg(acc.get("pay_cfg")), "inherited": own is not None and own["id"] != acc["id"],
                "packs_allowed": list(PACKS)}

    def save_config(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        acc = self._account(viewer)
        if acc["role"] not in ("tutor", "school") or (acc["role"] == "tutor" and acc.get("org_id")):
            raise PortalError(403, "настройки задаёт частный репетитор или школа")
        body = body if isinstance(body, dict) else {}
        price = body.get("price", 0)
        if not isinstance(price, int) or isinstance(price, bool) or not 0 <= price <= 100_000:
            raise PortalError(400, "цена занятия: целое число рублей")
        packs = sorted({p for p in (body.get("packs") or []) if p in PACKS})
        remind = body.get("remind") if body.get("remind") in ("off", "before", "after") else "after"
        requisites = str(body.get("requisites") or "").strip()[:500]
        enabled = bool(body.get("enabled"))
        if enabled and (price < 1 or not requisites):
            raise PortalError(400, "укажите цену занятия и реквизиты, куда переводить деньги")
        cfg = {"enabled": enabled, "price": price, "packs": packs or [1], "remind": remind,
               "require_prepay": bool(body.get("require_prepay")), "requisites": requisites}
        self.storage.update_account(acc["id"], pay_cfg=json.dumps(cfg, ensure_ascii=False))
        return {"config": cfg}

    # -- кто с кем -------------------------------------------------------------------------------------
    def _pairs_of(self, acc: dict[str, Any]) -> list[Pair]:
        if acc["role"] == "student":
            return [Pair.from_row(r) for r in self.storage.pairs_for_user(acc["id"]) if r.get("student_user_id") == acc["id"]]
        if acc["role"] == "tutor":
            return [Pair.from_row(r) for r in self.storage.tutor_pairs(acc["id"])]
        if acc["role"] == "school" and acc.get("org_id"):
            rows: list[dict[str, Any]] = []
            for t in self.storage.org_accounts(acc["org_id"], "tutor"):
                rows += self.storage.tutor_pairs(t["id"])
            return [Pair.from_row(r) for r in rows]
        return []

    def _can_manage(self, acc: dict[str, Any], pair: Pair) -> bool:
        if pair.tutor_user_id == acc["id"]:
            return True
        tutor = self.storage.get_account(pair.tutor_user_id) if pair.tutor_user_id else None
        return bool(acc["role"] == "school" and tutor and tutor.get("org_id") and tutor["org_id"] == acc.get("org_id"))

    # -- что видит человек -----------------------------------------------------------------------------
    def overview(self, viewer: Viewer) -> dict[str, Any]:
        acc = self._account(viewer)
        pairs = self._pairs_of(acc)
        items = []
        for pair in pairs:
            cfg = self.config_for_pair(pair)
            if not cfg:
                continue
            pending = self.storage.lesson_payments_for([pair.id], "pending")
            history = self.storage.lesson_payments_for([pair.id], limit=8)
            item = {"pair_id": pair.id, "chat_id": pair.chat_id, "balance": self.storage.pair_balance(pair.id),
                    "pending": pending, "history": history}
            if acc["role"] == "student":
                item.update({"tutor": pair.tutor_alias, "price": cfg["price"], "packs": cfg["packs"],
                             "requisites": cfg["requisites"], "require_prepay": cfg["require_prepay"]})
            else:
                item.update({"student": pair.student_alias, "price": cfg["price"]})
            items.append(item)
        return {"items": items, "pending_total": sum(len(i["pending"]) for i in items)}

    # -- ученик: «Я оплатил(а)» ---------------------------------------------------------------------------
    def declare(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        acc = self._account(viewer)
        body = body if isinstance(body, dict) else {}
        pair = next((p for p in self._pairs_of(acc) if p.id == body.get("pair_id")), None) if acc["role"] == "student" else None
        cfg = self.config_for_pair(pair)
        if not pair or not cfg:
            raise PortalError(404, "оплата занятий у этого преподавателя не включена")
        count = body.get("count")
        if count not in cfg["packs"]:
            raise PortalError(400, "выберите один из пакетов: " + ", ".join(map(str, cfg["packs"])))
        if len(self.storage.lesson_payments_for([pair.id], "pending")) >= 3:
            raise PortalError(409, "у вас уже есть неподтверждённые оплаты: подождите, пока преподаватель их проверит")
        amount = cfg["price"] * count
        pid = self.storage.add_lesson_payment(pair.id, count, amount)
        tutor = self.storage.get_account(pair.tutor_user_id)
        who = pair.student_alias
        text = (f"{who} сообщает об оплате: {count} {_lessons(count)} на {amount} ₽.\n"
                f"Проверьте поступление и подтвердите оплату в разделе «Оплата занятий» на сайте.")
        self.portal.notify_account(pair.tutor_user_id, "Ученик оплатил занятия", text)
        payee = self.payee(tutor)
        if payee and tutor and payee["id"] != tutor["id"]:
            self.portal.notify_account(payee["id"], "Ученик оплатил занятия", f"Преподаватель {pair.tutor_alias}: " + text)
        return {"id": pid, "amount": amount}

    # -- преподаватель: подтвердить или отклонить -----------------------------------------------------------
    def decide(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        acc = self._account(viewer)
        body = body if isinstance(body, dict) else {}
        pay = self.storage.get_lesson_payment(body["id"]) if isinstance(body.get("id"), int) else None
        pair = next((p for p in self._pairs_of(acc) if pay and p.id == pay["pair_id"]), None) if acc["role"] != "student" else None
        if not pay or not pair or not self._can_manage(acc, pair):
            raise PortalError(404, "оплата не найдена")
        action = body.get("action")
        if action not in ("confirm", "reject"):
            raise PortalError(400, "action: confirm или reject")
        note = str(body.get("note") or "").strip()[:200] or None
        if not self.storage.decide_lesson_payment(pay["id"], "confirmed" if action == "confirm" else "rejected", note):
            raise PortalError(409, "эта оплата уже обработана")
        if action == "confirm":
            balance = self.storage.add_balance(pair.id, pay["count"])
            self.portal.notify_account(pair.student_user_id, "Оплата подтверждена",
                                       f"{pair.tutor_alias} подтвердил(а) оплату: {pay['count']} {_lessons(pay['count'])}. "
                                       f"Оплаченных занятий: {balance}.")
        else:
            self.portal.notify_account(pair.student_user_id, "Оплата не найдена",
                                       f"{pair.tutor_alias} не увидел(а) перевод на {pay['amount']} ₽."
                                       + (f" Комментарий: {note}" if note else "")
                                       + " Проверьте перевод и сообщите преподавателю в чате.")
        return {"ok": True, "balance": self.storage.pair_balance(pair.id)}

    def adjust(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        """Ручная правка баланса: оплатили наличными, занятие подарили или перенесли."""
        acc = self._account(viewer)
        body = body if isinstance(body, dict) else {}
        pair = next((p for p in self._pairs_of(acc) if p.id == body.get("pair_id")), None) if acc["role"] != "student" else None
        delta = body.get("delta")
        if not pair or not self._can_manage(acc, pair):
            raise PortalError(404, "ученик не найден")
        if not isinstance(delta, int) or isinstance(delta, bool) or not -20 <= delta <= 20 or delta == 0:
            raise PortalError(400, "delta: число от -20 до 20")
        return {"balance": self.storage.add_balance(pair.id, delta)}

    # -- события урока -----------------------------------------------------------------------------------------
    def gate(self, pair: Pair | None) -> None:
        """Вход ученика в урок: если преподаватель требует предоплату, без оплаченного занятия не пускаем."""
        cfg = self.config_for_pair(pair)
        if pair and cfg and cfg["require_prepay"] and self.storage.pair_balance(pair.id) <= 0:
            raise PortalError(402, "Сначала оплатите занятие: преподаватель включил предоплату. "
                                   "Откройте главную страницу кабинета, раздел «Оплата занятий».")

    def on_start(self, pair: Pair | None) -> None:
        cfg = self.config_for_pair(pair)
        if pair and cfg and cfg["remind"] == "before" and self.storage.pair_balance(pair.id) <= 0:
            self._remind(pair, cfg, "Урок уже начался, оплаченных занятий нет")

    def on_finish(self, pair: Pair | None, started_at: str | None) -> None:
        cfg = self.config_for_pair(pair)
        if not pair or not cfg:
            return
        try:
            minutes = (datetime.now(timezone.utc) - datetime.fromisoformat(started_at or "")).total_seconds() / 60
        except ValueError:
            minutes = MIN_LESSON_MINUTES
        balance = self.storage.pair_balance(pair.id)
        if minutes >= MIN_LESSON_MINUTES:
            balance = self.storage.add_balance(pair.id, -1)
        if cfg["remind"] == "after" and balance <= 0:
            self._remind(pair, cfg, "Урок прошёл, оплаченных занятий больше нет" if balance == 0 else
                         f"Урок прошёл, за него ещё не оплачено ({-balance})")
        elif cfg["remind"] != "off" and balance == 1:
            self.portal.notify_account(pair.student_user_id, "Остаётся одно оплаченное занятие",
                                       f"С {pair.tutor_alias} оплачено ещё одно занятие. Следующее можно оплатить заранее на сайте.")

    def _remind(self, pair: Pair, cfg: dict[str, Any], lead: str) -> None:
        site = f"\nОплатить: {self.settings.site_url}/#/app" if self.settings.site_url else ""
        self.portal.notify_account(pair.student_user_id, "Напоминание об оплате занятия",
                                   f"{lead}. Цена занятия с {pair.tutor_alias}: {cfg['price']} ₽.\n"
                                   f"Реквизиты: {cfg['requisites']}\n"
                                   f"После перевода нажмите «Я оплатил(а)» в кабинете, преподаватель подтвердит." + site)


def _lessons(n: int) -> str:
    return "занятие" if n % 10 == 1 and n % 100 != 11 else "занятия" if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14) else "занятий"
