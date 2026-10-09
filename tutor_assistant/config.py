"""Настройки ассистента.

Все параметры читаются из переменных окружения (и необязательного файла `.env`),
чтобы один и тот же код без правок работал в консоли, Telegram-боте и HTTP API.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULT_MODEL = "claude-opus-5-5"


def load_dotenv(path: str | os.PathLike[str] = ".env") -> None:
    """Минимальный загрузчик .env: KEY=VALUE, комментарии через #.

    Уже заданные переменные окружения не перезаписываются.
    """
    p = Path(path)
    if not p.is_file():
        return
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key.startswith("export "):
            key = key[len("export "):].strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key, value)


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _env_bool(name: str, default: bool) -> bool:
    value = _env(name)
    if not value:
        return default
    return value.lower() in {"1", "true", "yes", "on", "да"}


def _env_int(name: str, default: int) -> int:
    value = _env(name)
    try:
        return int(value) if value else default
    except ValueError:
        return default


def _env_list(name: str) -> tuple[str, ...]:
    return tuple(x.strip() for x in _env(name).split(",") if x.strip())


@dataclass(frozen=True)
class Settings:
    # Хранилище
    db_path: str = "tutor_assistant.sqlite3"
    timezone: str = "Europe/Moscow"

    # Язык обучения и язык объяснений
    target_language: str = "en"  # изучаемый язык (en, de, fr, es, it, ...)
    native_language: str = "ru"  # язык ученика / конспекта

    # LLM (Claude). mode: auto — включить, если есть ключ; on — всегда; off — только офлайн.
    llm_mode: str = "auto"
    llm_model: str = DEFAULT_MODEL
    llm_fallbacks: bool = True
    llm_timeout: float = 300.0

    # Контроль контактов
    block_contacts: bool = True  # скрывать сообщения с контактами
    allowed_emails: tuple[str, ...] = ()  # официальные адреса школы
    allowed_handles: tuple[str, ...] = ()  # официальные @аккаунты школы
    allowed_domains: tuple[str, ...] = ()  # домены школы и разрешённые сайты
    allowed_phones: tuple[str, ...] = ()  # телефоны поддержки школы (только цифры)
    split_window_seconds: int = 180  # окно склейки номера, разбитого на сообщения
    relay_media: bool = True  # анонимный мост: пересылать фото/файлы/голосовые (их содержимое не проверяется)

    # Интеграции
    telegram_token: str = ""
    admin_chat_id: str = ""  # куда слать уведомления о нарушениях
    admin_user_ids: tuple[str, ...] = ()
    api_token: str = ""  # Bearer-токен HTTP API (пусто — без авторизации, только для локальной разработки)
    api_host: str = "127.0.0.1"
    api_port: int = 8080

    @classmethod
    def from_env(cls, dotenv: str | None = ".env") -> Settings:
        if dotenv:
            load_dotenv(dotenv)
        return cls(
            db_path=_env("TUTOR_DB_PATH", cls.db_path),
            timezone=_env("TUTOR_TIMEZONE", cls.timezone),
            target_language=_env("TUTOR_TARGET_LANGUAGE", cls.target_language).lower(),
            native_language=_env("TUTOR_NATIVE_LANGUAGE", cls.native_language).lower(),
            llm_mode=_env("TUTOR_LLM", cls.llm_mode).lower(),
            llm_model=_env("TUTOR_LLM_MODEL", cls.llm_model),
            llm_fallbacks=_env_bool("TUTOR_LLM_FALLBACKS", cls.llm_fallbacks),
            llm_timeout=float(_env_int("TUTOR_LLM_TIMEOUT", int(cls.llm_timeout))),
            block_contacts=_env_bool("TUTOR_BLOCK_CONTACTS", cls.block_contacts),
            allowed_emails=tuple(x.lower() for x in _env_list("TUTOR_ALLOWED_EMAILS")),
            allowed_handles=tuple(x.lower().lstrip("@") for x in _env_list("TUTOR_ALLOWED_HANDLES")),
            allowed_domains=tuple(x.lower() for x in _env_list("TUTOR_ALLOWED_DOMAINS")),
            allowed_phones=tuple("".join(c for c in x if c.isdigit()) for x in _env_list("TUTOR_ALLOWED_PHONES")),
            split_window_seconds=_env_int("TUTOR_SPLIT_WINDOW_SECONDS", cls.split_window_seconds),
            relay_media=_env_bool("TUTOR_RELAY_MEDIA", cls.relay_media),
            telegram_token=_env("TELEGRAM_BOT_TOKEN"),
            admin_chat_id=_env("TUTOR_ADMIN_CHAT_ID"),
            admin_user_ids=_env_list("TUTOR_ADMIN_USER_IDS"),
            api_token=_env("TUTOR_API_TOKEN"),
            api_host=_env("TUTOR_API_HOST", cls.api_host),
            api_port=_env_int("TUTOR_API_PORT", cls.api_port),
        )

    @property
    def tz(self) -> ZoneInfo:
        try:
            return ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError):
            return ZoneInfo("UTC")

    @property
    def llm_enabled(self) -> bool:
        if self.llm_mode in {"off", "0", "false", "no"}:
            return False
        if self.llm_mode in {"on", "1", "true", "yes"}:
            return True
        return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))
