"""Оплата тарифа через ЮKassa: карта и СБП.

Схема: сайт создаёт платёж и отправляет человека на страницу оплаты ЮKassa; после оплаты ЮKassa
шлёт уведомление на /site/v1/pay/yookassa, а человек возвращается на сайт. Уведомлениям не верим
на слово (подписи у них нет): статус платежа всегда перепроверяется запросом в API ЮKassa.
Срок тарифа продлевается один раз на платёж, даже если уведомление пришло дважды.
"""

from __future__ import annotations

import base64
import json
import logging
import secrets
import urllib.error
import urllib.request
from collections.abc import Callable
from typing import Any

from . import billing
from .portal import Portal, PortalError, Viewer

log = logging.getLogger(__name__)
API = "https://api.yookassa.ru/v3"
METHODS = {"sbp": "sbp", "card": "bank_card"}  # что показать на странице оплаты сразу; без выбора ЮKassa предложит всё сама


class YooKassa:
    """Тонкий клиент API. http подменяется в тестах: (method, url, payload, headers) -> dict."""

    def __init__(self, shop_id: str, secret_key: str, http: Callable[..., dict[str, Any]] | None = None):
        self.auth = "Basic " + base64.b64encode(f"{shop_id}:{secret_key}".encode()).decode()
        self.http = http or self._http

    @staticmethod
    def _http(method: str, url: str, payload: dict[str, Any] | None, headers: dict[str, str]) -> dict[str, Any]:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:  # noqa: S310 - адрес api.yookassa.ru зашит в коде
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:500]
            log.error("ЮKassa вернула %s: %s", exc.code, detail)
            raise PortalError(502, "платёжный сервис не принял запрос, попробуйте ещё раз или напишите в поддержку") from None
        except (urllib.error.URLError, TimeoutError, ValueError):
            raise PortalError(502, "платёжный сервис не отвечает, попробуйте через минуту") from None

    def _headers(self, idem: str | None = None) -> dict[str, str]:
        h = {"Authorization": self.auth, "Content-Type": "application/json"}
        if idem:
            h["Idempotence-Key"] = idem
        return h

    def create(self, payload: dict[str, Any], idem: str) -> dict[str, Any]:
        return self.http("POST", f"{API}/payments", payload, self._headers(idem))

    def get(self, provider_id: str) -> dict[str, Any]:
        return self.http("GET", f"{API}/payments/{provider_id}", None, self._headers())


class PlanPayments:
    def __init__(self, portal: Portal, client: YooKassa | None = None):
        self.portal = portal
        self.storage = portal.storage
        self.settings = portal.settings
        self._client = client

    @property
    def enabled(self) -> bool:
        return self._client is not None or self.settings.yookassa_enabled

    @property
    def client(self) -> YooKassa:
        if self._client is None:
            if not self.settings.yookassa_enabled:
                raise PortalError(503, "онлайн-оплата подключается: напишите в поддержку, и мы продлим доступ вручную")
            self._client = YooKassa(self.settings.yookassa_shop_id, self.settings.yookassa_secret_key)
        return self._client

    def _payer(self, viewer: Viewer) -> dict[str, Any]:
        acc = self.storage.get_account(viewer.user_id) if viewer.user_id.startswith("a_") else None
        if not acc or acc["role"] not in ("tutor", "school"):
            raise PortalError(403, "тариф оплачивают преподаватели и школы")
        if acc["role"] == "tutor" and acc.get("org_id"):
            raise PortalError(403, "за вас платит школа")
        return acc

    def _teachers(self, acc: dict[str, Any]) -> int:
        if acc["role"] == "school" and acc.get("org_id"):
            return max(1, len(self.storage.org_accounts(acc["org_id"], "tutor")))
        return 1

    # -- что показать на странице тарифа -----------------------------------------------------------
    def options(self, viewer: Viewer) -> dict[str, Any]:
        acc = self.storage.get_account(viewer.user_id) if viewer.user_id.startswith("a_") else None
        if not acc or acc["role"] not in ("tutor", "school"):
            raise PortalError(403, "доступно преподавателям и школам")
        payer = billing.payer(self.storage, acc)
        own = payer is not None and payer["id"] == acc["id"]
        quotes = [billing.quote(acc, m, self.storage, self._teachers(acc)) for m in (1, 3, 12)] if own else []
        return {"state": billing.plan_state(self.storage, acc), "quotes": quotes, "online": self.enabled and own,
                "teachers": self._teachers(acc), "can_pay": own,
                "history": [{"id": p["id"], "months": p["months"], "amount": p["amount"], "status": p["status"],
                             "created_at": p["created_at"]} for p in self.storage.payments_for(acc["id"])]}

    # -- создание платежа ----------------------------------------------------------------------------
    def pay(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        acc = self._payer(viewer)
        body = body if isinstance(body, dict) else {}
        months = body.get("months")
        if months not in (1, 3, 12):
            raise PortalError(400, "срок: 1, 3 или 12 месяцев")
        method = body.get("method")
        if method is not None and method not in METHODS:
            raise PortalError(400, "способ оплаты: sbp или card")
        client = self.client
        q = billing.quote(acc, months, self.storage, self._teachers(acc))
        if q["total"] < 1:
            raise PortalError(400, "нечего оплачивать")
        local_id = "p_" + secrets.token_hex(10)
        self.storage.add_payment(local_id, acc["id"], months, q["total"], q["reason"])
        plan = billing.PLANS["school" if acc["role"] == "school" else "teacher"]
        site = self.settings.site_url or ""
        payload: dict[str, Any] = {
            "amount": {"value": f"{q['total']:.2f}", "currency": "RUB"},
            "capture": True,
            "confirmation": {"type": "redirect", "return_url": f"{site}/#/app/plan?paid={local_id}"},
            "description": f"{self.settings.school_name}: тариф «{plan['title']}», {months} мес."[:128],
            "metadata": {"payment_id": local_id, "account_id": acc["id"]},
        }
        if method:
            payload["payment_method_data"] = {"type": METHODS[method]}
        if self.settings.yookassa_receipt:
            receipt: dict[str, Any] = {
                "customer": {"email": acc["email"]},
                "items": [{"description": f"Доступ к платформе, {months} мес."[:128], "quantity": "1.00",
                           "amount": payload["amount"], "vat_code": self.settings.yookassa_vat_code,
                           "payment_mode": "full_payment", "payment_subject": "service"}],
            }
            if self.settings.yookassa_tax_system:
                receipt["tax_system_code"] = self.settings.yookassa_tax_system
            payload["receipt"] = receipt
        try:
            res = client.create(payload, local_id)
        except PortalError:
            self.storage.update_payment(local_id, status="canceled")
            raise
        url = (res.get("confirmation") or {}).get("confirmation_url")
        if not res.get("id") or not url:
            self.storage.update_payment(local_id, status="canceled")
            raise PortalError(502, "платёжный сервис не вернул ссылку на оплату")
        self.storage.update_payment(local_id, provider_id=res["id"])
        return {"id": local_id, "url": url, "amount": q["total"]}

    # -- подтверждение -----------------------------------------------------------------------------
    def _finalize(self, local: dict[str, Any]) -> str:
        """Перепроверяет платёж в ЮKassa и, если он оплачен, один раз продлевает тариф."""
        if local["status"] == "succeeded" or not local.get("provider_id"):
            return local["status"]
        info = self.client.get(local["provider_id"])
        meta = info.get("metadata") or {}
        amount = (info.get("amount") or {}).get("value")
        if meta.get("payment_id") != local["id"]:
            raise PortalError(409, "платёж не совпадает с заказом")
        status = info.get("status")
        if status == "succeeded" and info.get("paid", True):
            try:
                same = abs(float(amount) - local["amount"]) < 0.01
            except (TypeError, ValueError):
                same = False
            if not same:
                log.error("Сумма платежа %s не совпала: %s ≠ %s", local["id"], amount, local["amount"])
                raise PortalError(409, "сумма платежа не совпала с заказом, мы разберёмся: напишите в поддержку")
            if self.storage.settle_payment(local["id"]):
                acc = self.storage.get_account(local["account_id"])
                if acc:
                    billing.extend(self.storage, acc, local["months"])
                    if local.get("reason") == "referral":
                        self.storage.update_account(acc["id"], ref_used=str(int(acc.get("ref_used") or 0) + 1))
                    self.portal.mailer.send(acc["email"], f"{self.settings.school_name}: оплата получена",
                                            f"Спасибо! Тариф продлён на {local['months']} мес. Сумма: {local['amount']} ₽.\n"
                                            f"Если нужен чек или что-то не так, ответьте на это письмо.",
                                            reply_to=self.settings.support_email)
            return "succeeded"
        if status == "canceled":
            self.storage.update_payment(local["id"], status="canceled")
            return "canceled"
        return "pending"

    def check(self, viewer: Viewer, body: Any) -> dict[str, Any]:
        """Человек вернулся со страницы оплаты: проверяем, дошли ли деньги."""
        acc = self._payer(viewer)
        pid = str((body or {}).get("id") or "")
        local = self.storage.get_payment(pid)
        if not local or local["account_id"] != acc["id"]:
            raise PortalError(404, "платёж не найден")
        status = self._finalize(local)
        return {"status": status, "billing": billing.plan_state(self.storage, acc)}

    def webhook(self, body: Any) -> dict[str, Any]:
        """Уведомление ЮKassa. Из тела берём только id платежа, всё остальное запрашиваем сами."""
        obj = body.get("object") if isinstance(body, dict) else None
        provider_id = str((obj or {}).get("id") or "")
        local = self.storage.get_payment(provider_id) if provider_id else None
        if local and self.enabled:
            try:
                self._finalize(local)
            except PortalError:
                log.exception("Не удалось подтвердить платёж %s", provider_id)
        return {"ok": True}
