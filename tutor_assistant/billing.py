"""Тарифы и доступ: пробный период, оплата, реферальная скидка.

* Новый преподаватель или школа получают 3 дня со всеми функциями.
* «Преподаватель» — 300 ₽ в месяц, всё без ограничений. «Онлайн-школа» — 500 ₽ в месяц за
  преподавателя (кабинет школы, контроль контактов, общая база). Оплата на 3 и 12 месяцев — дешевле.
* Преподаватель школы работает по тарифу школы. Ученики и родители не платят.
* Пригласите коллегу: когда он оплатит тариф, вам — скидка 50% на следующее продление.

Онлайн-оплата пока не подключена: срок оплаты продлевает администратор платформы.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

TRIAL_DAYS = 3
PLANS: dict[str, dict[str, Any]] = {
    "teacher": {"title": "Преподаватель", "price": 300, "periods": {1: 300, 3: 810, 12: 2880}},
    "school": {"title": "Онлайн-школа", "price": 500, "per": "за преподавателя", "periods": {1: 500, 3: 1350, 12: 4800}},
}
REF_DISCOUNT = 50  # % на следующее продление за каждого коллегу, оплатившего тариф


def now() -> datetime:
    return datetime.now(timezone.utc)


def _dt(value: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(value) if value else None
    except ValueError:
        return None


def payer(storage: Any, acc: dict[str, Any]) -> dict[str, Any] | None:
    """Кто платит за аккаунт: сам преподаватель, школа (за своих преподавателей) или никто."""
    if acc.get("role") in ("student", "parent"):
        return None
    if acc.get("role") == "tutor" and acc.get("org_id"):
        org = storage.get_org(acc["org_id"])
        owner = storage.get_account(org["owner_id"]) if org else None
        return owner or acc
    return acc


def plan_state(storage: Any, acc: dict[str, Any] | None, at: datetime | None = None) -> dict[str, Any]:
    """trial — пробный период, active — оплачено, expired — нужно оплатить, free — ученик или родитель."""
    if not acc:
        return {"state": "free"}
    who = payer(storage, acc)
    if who is None:
        return {"state": "free"}
    at = at or now()
    paid, trial = _dt(who.get("paid_until")), _dt(who.get("trial_until"))
    plan = "school" if who.get("role") == "school" else "teacher"
    by_school = who["id"] != acc["id"]
    if paid and paid > at:
        return {"state": "active", "until": paid.isoformat(timespec="seconds"), "plan": plan, "by_school": by_school,
                "days_left": max(0, (paid - at).days)}
    if trial and trial > at:
        return {"state": "trial", "until": trial.isoformat(timespec="seconds"), "plan": plan, "by_school": by_school,
                "days_left": max(0, (trial - at).days), "hours_left": max(0, int((trial - at).total_seconds() // 3600))}
    return {"state": "expired", "plan": plan, "by_school": by_school}


def require_active(storage: Any, user_id: str) -> None:
    """Проверка перед платными действиями: урок, ученики, доски, задания, занятия."""
    from .portal import PortalError

    acc = storage.get_account(user_id) if user_id.startswith("a_") else None
    if not acc:
        return  # пары из Telegram-бота школы работают по договору со школой
    st = plan_state(storage, acc)
    if st["state"] == "expired":
        raise PortalError(402, "Срок тарифа закончился: школа продлевает доступ своим преподавателям."
                          if st.get("by_school") else
                          "Пробный период закончился. Оформите тариф «Преподаватель» за 300 ₽ в месяц, чтобы продолжить.")


def trial_until(days: int = TRIAL_DAYS) -> str:
    return (now() + timedelta(days=days)).isoformat(timespec="seconds")


def extend(storage: Any, acc: dict[str, Any], months: int) -> str:
    """Продлить оплату (после оплаты или вручную администратором)."""
    start = max(now(), _dt(acc.get("paid_until")) or now())
    until = (start + timedelta(days=30 * months)).isoformat(timespec="seconds")
    storage.update_account(acc["id"], paid_until=until)
    return until


def referrals(storage: Any, acc: dict[str, Any]) -> dict[str, Any]:
    invited = storage._all("SELECT paid_until FROM accounts WHERE referred_by=?", (acc["id"],))
    paid = sum(1 for r in invited if r["paid_until"])
    return {"code": acc.get("ref_code"), "invited": len(invited), "paid": paid,
            "discounts": max(0, paid - int(acc.get("ref_used") or 0)), "percent": REF_DISCOUNT}


def price(acc: dict[str, Any], months: int, storage: Any, teachers: int = 1, use_discount: bool = False) -> int:
    plan = PLANS["school" if acc.get("role") == "school" else "teacher"]
    total = plan["periods"].get(months, plan["price"] * months) * max(1, teachers)
    if use_discount and referrals(storage, acc)["discounts"] > 0:
        total = round(total * (100 - REF_DISCOUNT) / 100)
    return total
