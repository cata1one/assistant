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

    # LLM (Claude). mode: auto – включить, если есть ключ; on – всегда; off – только офлайн.
    llm_mode: str = "auto"
    llm_model: str = DEFAULT_MODEL
    llm_fallbacks: bool = True
    llm_timeout: float = 300.0

    # ИИ для конструктора занятий: любой OpenAI-совместимый сервис, в том числе бесплатный —
    # Ollama на своём сервере (http://127.0.0.1:11434/v1), OpenRouter (бесплатные модели), Groq и т. п.
    ai_url: str = ""
    ai_key: str = ""
    ai_model: str = ""
    ai_timeout: float = 1200.0  # конспект урока на процессоре без видеокарты может готовиться 10–15 минут

    # Контроль контактов
    block_contacts: bool = True  # скрывать сообщения с контактами
    allowed_emails: tuple[str, ...] = ()  # официальные адреса школы
    allowed_handles: tuple[str, ...] = ()  # официальные @аккаунты школы
    allowed_domains: tuple[str, ...] = ()  # домены школы и разрешённые сайты
    allowed_phones: tuple[str, ...] = ()  # телефоны поддержки школы (только цифры)
    split_window_seconds: int = 180  # окно склейки номера, разбитого на сообщения
    relay_media: bool = True  # анонимный мост: пересылать фото/файлы (их содержимое не проверяется)

    # Распознавание речи (голосовые, запись урока). mode: auto – если установлен faster-whisper; on; off.
    stt_mode: str = "auto"
    stt_model: str = "small"  # tiny | base | small | medium | large-v3 – чем больше, тем точнее и медленнее
    stt_language: str = ""  # пусто – определять автоматически (урок обычно смешанный: ru + изучаемый язык)
    stt_device: str = "cpu"  # cpu | cuda
    stt_compute_type: str = "int8"
    stt_model_dir: str = ""  # папка с моделями (для серверов без доступа в интернет)
    relay_unchecked_audio: bool = False  # пересылать голосовые, если распознавание недоступно
    # Запись урока
    require_recording: bool = False  # урок без записи → нарушение «запись не включена»
    recording_gap_seconds: int = 90  # перерыв в записи дольше этого → уведомление администратору
    alert_webhook_url: str = ""  # POST JSON о каждом нарушении (для платформы школы)

    # Интеграции
    telegram_token: str = ""
    telegram_proxy: str = ""  # прокси для связи с Telegram: http://host:port или socks5://user:pass@host:port
    admin_chat_id: str = ""  # куда слать уведомления о нарушениях
    admin_user_ids: tuple[str, ...] = ()
    api_token: str = ""  # Bearer-токен HTTP API (пусто – без авторизации, только для локальной разработки)
    api_host: str = "127.0.0.1"
    api_port: int = 8080

    # Сайт школы (раздаётся тем же сервером, что и API)
    school_name: str = "Bright"
    site_url: str = ""  # публичный адрес сайта, например https://myschool.ru – для ссылок в личный кабинет
    bot_username: str = ""  # имя Telegram-бота школы без @ – кнопки «Написать в Telegram» на сайте
    classroom_domains: tuple[str, ...] = ("progressme.ru",)  # где проходят уроки: ссылки на класс только отсюда
    access_token_days: int = 30  # срок действия ссылки в личный кабинет
    # Онлайн-класс (видеосвязь WebRTC в браузере). JSON-список ICE-серверов; для учеников за строгим NAT
    # нужен свой TURN-сервер, например [{"urls":"turn:turn.myschool.ru:3478","username":"u","credential":"p"}]
    ice_servers: str = ""
    demo_reviews: bool = False  # показывать примеры отзывов с пометкой «пример», пока нет настоящих
    market_fee_percent: int = 20  # комиссия школы с занятий, найденных через биржу (показывается преподавателям)
    trust_proxy: bool = False  # сайт за nginx: брать IP посетителя из X-Forwarded-For (для защиты от спама)

    # Почта: письма об оплате занятий, обращения в поддержку. Без SMTP письма не уходят (остаются уведомления на сайте и в Telegram)
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""  # от чьего имени; по умолчанию как smtp_user
    support_email: str = "monework@mail.ru"  # сюда приходят обращения из окна помощи
    # Приложение для телефона: ссылка на страницу в RuStore и на APK. Если APK лежит рядом с базой
    # под именем bright.apk, сайт отдаёт его сам по адресу /bright.apk
    rustore_url: str = ""
    apk_url: str = ""
    legal_name: str = ""  # оператор персональных данных для политики: ФИО или ИП и ИНН

    # Оплата тарифа через ЮKassa (карты, СБП). Пока ключи не заданы, оплата отключена, а срок продлевает администратор
    yookassa_shop_id: str = ""
    yookassa_secret_key: str = ""
    yookassa_receipt: bool = False  # слать чек (54-ФЗ) вместе с платежом: нужно, если вы самозанятый или ИП на УСН
    yookassa_tax_system: int = 0  # код системы налогообложения для чека, 0 – не указывать (берётся из настроек магазина)
    yookassa_vat_code: int = 1  # 1 – без НДС

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
            stt_mode=_env("TUTOR_STT", cls.stt_mode).lower(),
            stt_model=_env("TUTOR_STT_MODEL", cls.stt_model),
            stt_language=_env("TUTOR_STT_LANGUAGE", cls.stt_language).lower(),
            stt_device=_env("TUTOR_STT_DEVICE", cls.stt_device),
            stt_compute_type=_env("TUTOR_STT_COMPUTE_TYPE", cls.stt_compute_type),
            stt_model_dir=_env("TUTOR_STT_MODEL_DIR", cls.stt_model_dir),
            relay_unchecked_audio=_env_bool("TUTOR_RELAY_UNCHECKED_AUDIO", cls.relay_unchecked_audio),
            require_recording=_env_bool("TUTOR_REQUIRE_RECORDING", cls.require_recording),
            recording_gap_seconds=_env_int("TUTOR_RECORDING_GAP_SECONDS", cls.recording_gap_seconds),
            alert_webhook_url=_env("TUTOR_ALERT_WEBHOOK_URL", cls.alert_webhook_url),
            telegram_token=_env("TELEGRAM_BOT_TOKEN"),
            telegram_proxy=_env("TELEGRAM_PROXY"),
            admin_chat_id=_env("TUTOR_ADMIN_CHAT_ID"),
            admin_user_ids=_env_list("TUTOR_ADMIN_USER_IDS"),
            api_token=_env("TUTOR_API_TOKEN"),
            api_host=_env("TUTOR_API_HOST", cls.api_host),
            api_port=_env_int("TUTOR_API_PORT", cls.api_port),
            school_name=_env("TUTOR_SCHOOL_NAME", cls.school_name),
            site_url=_env("TUTOR_SITE_URL").rstrip("/"),
            bot_username=_env("TUTOR_BOT_USERNAME").lstrip("@"),
            classroom_domains=tuple(x.lower() for x in _env_list("TUTOR_CLASSROOM_DOMAINS")) or cls.classroom_domains,
            access_token_days=_env_int("TUTOR_ACCESS_TOKEN_DAYS", cls.access_token_days),
            trust_proxy=_env_bool("TUTOR_TRUST_PROXY", cls.trust_proxy),
            demo_reviews=_env_bool("TUTOR_DEMO_REVIEWS", cls.demo_reviews),
            market_fee_percent=_env_int("TUTOR_MARKET_FEE", cls.market_fee_percent),
            ice_servers=_env("TUTOR_ICE_SERVERS"),
            ai_url=_env("TUTOR_AI_URL").rstrip("/"),
            ai_key=_env("TUTOR_AI_KEY"),
            ai_model=_env("TUTOR_AI_MODEL"),
            ai_timeout=float(_env_int("TUTOR_AI_TIMEOUT", int(cls.ai_timeout))),
            smtp_host=_env("TUTOR_SMTP_HOST"),
            smtp_port=_env_int("TUTOR_SMTP_PORT", cls.smtp_port),
            smtp_user=_env("TUTOR_SMTP_USER"),
            smtp_password=_env("TUTOR_SMTP_PASSWORD"),
            smtp_from=_env("TUTOR_SMTP_FROM"),
            support_email=_env("TUTOR_SUPPORT_EMAIL", cls.support_email),
            rustore_url=_env("TUTOR_RUSTORE_URL"),
            apk_url=_env("TUTOR_APK_URL"),
            legal_name=_env("TUTOR_LEGAL_NAME"),
            yookassa_shop_id=_env("YOOKASSA_SHOP_ID"),
            yookassa_secret_key=_env("YOOKASSA_SECRET_KEY"),
            yookassa_receipt=_env_bool("YOOKASSA_RECEIPT", cls.yookassa_receipt),
            yookassa_tax_system=_env_int("YOOKASSA_TAX_SYSTEM", cls.yookassa_tax_system),
            yookassa_vat_code=_env_int("YOOKASSA_VAT_CODE", cls.yookassa_vat_code),
        )

    @property
    def tz(self) -> ZoneInfo:
        try:
            return ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError):
            return ZoneInfo("UTC")

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_host and (self.smtp_from or self.smtp_user))

    @property
    def yookassa_enabled(self) -> bool:
        return bool(self.yookassa_shop_id and self.yookassa_secret_key)

    @property
    def llm_enabled(self) -> bool:
        if self.llm_mode in {"off", "0", "false", "no"}:
            return False
        if self.llm_mode in {"on", "1", "true", "yes"}:
            return True
        return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))
