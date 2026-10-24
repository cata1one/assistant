"""Письма: уведомления об оплате занятий и обращения в поддержку.

Отправка идёт по SMTP в фоне, чтобы страница не ждала почтовый сервер. Если SMTP не настроен,
письмо не уходит (в журнал пишется строка), а уведомление остаётся на сайте и в Telegram.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
import threading
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from typing import Any

from .config import Settings

log = logging.getLogger(__name__)


class Mailer:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.sent: list[dict[str, Any]] = []  # последние письма (для проверки в тестах и отладки)

    @property
    def configured(self) -> bool:
        return self.settings.smtp_enabled

    def _build(self, to: str, subject: str, text: str, reply_to: str | None) -> EmailMessage:
        s = self.settings
        msg = EmailMessage()
        sender = s.smtp_from or s.smtp_user
        msg["From"] = formataddr((s.school_name, sender)) if "<" not in sender else sender
        msg["To"] = to
        msg["Subject"] = subject
        msg["Message-ID"] = make_msgid(domain=sender.rsplit("@", 1)[-1])
        if reply_to:
            msg["Reply-To"] = reply_to
        msg.set_content(text)
        return msg

    def _deliver(self, msg: EmailMessage) -> None:
        s = self.settings
        if s.smtp_port == 465:
            with smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=20, context=ssl.create_default_context()) as smtp:
                if s.smtp_user:
                    smtp.login(s.smtp_user, s.smtp_password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                if s.smtp_user:
                    smtp.login(s.smtp_user, s.smtp_password)
                smtp.send_message(msg)

    def send(self, to: str | None, subject: str, text: str, reply_to: str | None = None, wait: bool = False) -> bool:
        """True – письмо принято в работу. Ошибки почтового сервера не ломают действие пользователя."""
        if not to or "@" not in to:
            return False
        record = {"to": to, "subject": subject, "text": text}
        self.sent = (self.sent + [record])[-50:]
        if not self.configured:
            log.info("Почта не настроена, письмо не отправлено: %s → %s", subject, to)
            return False
        msg = self._build(to, subject, text, reply_to)

        def run() -> None:
            try:
                self._deliver(msg)
            except Exception:  # noqa: BLE001 - почтовый сервер недоступен: пользователь видит уведомление на сайте
                log.exception("Не удалось отправить письмо: %s → %s", subject, to)

        if wait:
            run()
        else:
            threading.Thread(target=run, daemon=True).start()
        return True
