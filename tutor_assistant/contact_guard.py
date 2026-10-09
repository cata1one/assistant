"""Контроль обмена контактами между репетитором и учеником.

Задача онлайн-школы: не допустить, чтобы преподаватель (или ученик) передал
личные контакты и увёл общение/оплату за пределы платформы.

Проверка многоуровневая:

1. Прямые данные — телефон, e-mail, @ник, ссылки на мессенджеры и соцсети,
   номера банковских карт (с проверкой Луна).
2. Замаскированные данные — числа словами («восемь девятьсот…»), «собака»
   вместо @, разрядка, латиница вместо кириллицы, номер по частям в нескольких
   сообщениях подряд.
3. Намерения — «мой телефон», «напиши мне в телегу», «давай заниматься
   напрямую», «плати на карту», «школа забирает половину» и т.п.

Итог — :class:`ModerationResult` с действием ``allow`` / ``warn`` / ``block``,
текстом со скрытыми данными и списком находок для журнала нарушений.

Фразы на изучаемом языке («What's your phone number?») — обычная часть урока
английского, поэтому английские фразы-намерения сами по себе не блокируют
сообщение, а только фиксируются. Реальные номера и адреса блокируются всегда.
"""

from __future__ import annotations

import re
import time
from collections import deque
from collections.abc import Hashable
from dataclasses import dataclass, field
from enum import Enum, IntEnum
from typing import Any

from . import textnorm
from .config import Settings


class Severity(IntEnum):
    NONE = 0
    LOW = 1  # фиксируем, не мешаем уроку
    MEDIUM = 2  # предупреждаем, фиксируем
    HIGH = 3  # скрываем сообщение, уведомляем администратора


class Kind(str, Enum):
    PHONE = "phone"
    EMAIL = "email"
    HANDLE = "handle"
    MESSENGER_LINK = "messenger_link"
    CARD = "payment_card"
    URL = "url"
    MESSENGER = "messenger_mention"
    CONTACT_REQUEST = "contact_request"
    OFF_PLATFORM = "off_platform"


KIND_TITLES = {
    Kind.PHONE: "номер телефона",
    Kind.EMAIL: "адрес электронной почты",
    Kind.HANDLE: "ник/аккаунт в мессенджере",
    Kind.MESSENGER_LINK: "ссылка на мессенджер или соцсеть",
    Kind.CARD: "номер банковской карты",
    Kind.URL: "внешняя ссылка",
    Kind.MESSENGER: "упоминание мессенджера/соцсети",
    Kind.CONTACT_REQUEST: "просьба обменяться контактами",
    Kind.OFF_PLATFORM: "предложение заниматься или платить в обход школы",
}

DATA_KINDS = {Kind.PHONE, Kind.EMAIL, Kind.HANDLE, Kind.MESSENGER_LINK, Kind.CARD}

REDACTED = "[скрыто]"
REDACTED_MESSAGE = "[сообщение скрыто: обнаружены контактные данные]"

WARNING_BLOCK = ("⚠️ Обмен личными контактами и общение/оплата вне платформы запрещены правилами школы. "
                 "Сообщение скрыто, информация передана администратору.")
WARNING_WARN = ("ℹ️ Напоминаем: всё общение и оплата занятий — только через платформу школы. "
                "Личные контакты передавать нельзя.")


@dataclass
class Finding:
    kind: Kind
    severity: Severity
    value: str
    reason: str
    span: tuple[int, int] | None = None  # позиция в исходном тексте, если её можно определить

    def to_dict(self) -> dict[str, Any]:
        return {"kind": self.kind.value, "severity": self.severity.name.lower(), "value": self.value,
                "reason": self.reason, "span": list(self.span) if self.span else None}


@dataclass
class ModerationResult:
    original_text: str
    redacted_text: str
    severity: Severity
    action: str  # allow | warn | block
    findings: list[Finding] = field(default_factory=list)
    related_refs: list[Hashable] = field(default_factory=list)  # прошлые сообщения, которые тоже надо скрыть

    @property
    def blocked(self) -> bool:
        return self.action == "block"

    @property
    def is_violation(self) -> bool:
        return self.severity >= Severity.MEDIUM

    @property
    def warning(self) -> str | None:
        if self.action == "block":
            return WARNING_BLOCK
        if self.action == "warn":
            return WARNING_WARN
        return None

    @property
    def summary(self) -> str:
        seen: list[str] = []
        for f in sorted(self.findings, key=lambda f: -f.severity):
            title = KIND_TITLES[f.kind]
            if title not in seen:
                seen.append(title)
        return ", ".join(seen)

    def to_dict(self) -> dict[str, Any]:
        return {
            "action": self.action,
            "severity": self.severity.name.lower(),
            "redacted_text": self.redacted_text,
            "warning": self.warning,
            "summary": self.summary,
            "findings": [f.to_dict() for f in self.findings],
        }


# ---------------------------------------------------------------------------
# Словари и шаблоны
# ---------------------------------------------------------------------------

_B = r"(?<![^\W_])"  # начало слова (буквы/цифры)
_E = r"(?![^\W_])"  # конец слова

MESSENGERS: dict[str, str] = {
    "Telegram": r"телеграм\w*|телеграмм\w*|телег[аеиуо]й?|телегр\w*|тележк[аеу]|тг|тгк|тлг|tg|telegram\w*|telega|teleg",
    "WhatsApp": r"в[ао]тс?[ао]пп?\w*|в[ао]цапп?\w*|ватсап\w*|вотсап\w*|ватс[еу]?|whats?app\w*|whatsap\w*|watsapp\w*|вацап\w*",
    "Viber": r"вайбер\w*|вибер\w*|viber\w*",
    "ВКонтакте": r"вк|вконтакт\w*|vk|vkontakte",
    "Instagram": r"инстаграм\w*|инст[аеуы]|инстаг\w*|instagram\w*|insta|инсту",
    "Discord": r"дискорд\w*|discord\w*",
    "Skype": r"скайп\w*|skype\w*",
    "Zoom": r"зум[еау]?|zoom",
    "Facebook": r"фейсбук\w*|фб|facebook",
    "Signal": r"сигнал[еау]?\s+мессенджер\w*",
    "Max": r"мессенджер\w*\s+max|мессенджер\w*\s+макс\w*",
    "личные сообщения": r"личк[аеуи]|в лс|в личные сообщения|в директ|директ[еу]?|dm",
}
_MESSENGER_RE = {name: re.compile(_B + rf"(?:{p})" + _E) for name, p in MESSENGERS.items()}
_ANY_MESSENGER = "|".join(f"(?:{p})" for p in MESSENGERS.values())

# Мессенджеры/соцсети/видеосвязь — ссылка на них = контакт.
MESSENGER_DOMAINS = (
    "t.me", "telegram.me", "telegram.dog", "telegram.org", "wa.me", "whatsapp.com", "vk.com", "vk.me",
    "vk.ru", "m.vk.com", "instagram.com", "instagr.am", "facebook.com", "fb.me", "fb.com", "m.me",
    "discord.gg", "discord.com", "discordapp.com", "viber.com", "invite.viber.com", "skype.com",
    "join.skype.com", "zoom.us", "us02web.zoom.us", "meet.google.com", "teams.microsoft.com",
    "telemost.yandex.ru", "ok.ru", "max.ru", "tiktok.com", "snapchat.com", "linkedin.com",
)
SHORTENER_DOMAINS = ("bit.ly", "clck.ru", "tinyurl.com", "goo.su", "cutt.ly", "is.gd", "vk.cc", "t.ly", "rb.gy",
                     "shorturl.at", "u.to", "lnkd.in")

_URL_SCHEMES = r"(?:https?://|www\.|tg://|viber://|whatsapp://|skype:)"
_URL_RE = re.compile(
    rf"(?:{_URL_SCHEMES}[^\s<>\"']+)"
    r"|(?<![@\w.])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:ru|com|me|net|org|io|su|рф|link|ly|gg|to|app"
    r"|site|online|pro|info|biz|us|cc|at|in|am|dog|ws|xyz|club|tv)(?:/[^\s<>\"']*)?(?![\w@])",
    re.IGNORECASE,
)
_EMAIL_RE = re.compile(r"(?<![\w.+-])[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
                       r"(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,24}(?![\w-])", re.IGNORECASE)
_HANDLE_RE = re.compile(r"(?<![\w@.])@([a-z][a-z0-9_]{3,31})(?![\w@])", re.IGNORECASE)
_DIGIT_RUN_RE = re.compile(r"\+?\d[\d \t\-()]{4,}\d")

_PHONE_CONTEXT_RE = re.compile(
    _B + r"(?:тел\w*|номер\w*|звон\w*|позвон\w*|набер\w*|набир\w*|мобил\w*|сотов\w*|смс|sms|phone|number|call"
    r"|cell|mobile|мой|моя|мою|мои|запиш\w*|whats?app|ватсап\w*|вотсап\w*|вайбер\w*|viber|telegram|телеграм\w*|тг)" + _E
)

_HANDLE_TRIGGER_RE = re.compile(
    _B + rf"(?:{_ANY_MESSENGER}|ник\w*|никнейм\w*|логин\w*|username|юзернейм\w*|юзер|аккаунт\w*|акк|профил\w*)" + _E
    + r"\s*(?:[:\-—–=]\s*)?(?:(?:мой|моя|мое|меня|там|тоже|это|как|:)\s+){0,2}@?([a-z][a-z0-9_.]{3,31})" + _E
)

# Английские слова, которые не считаем ником после «telegram/ник …».
_COMMON_EN = {
    "please", "thanks", "thank", "later", "today", "tomorrow", "there", "where", "maybe", "about", "message",
    "write", "chat", "group", "channel", "account", "profile", "words", "lesson", "homework", "teacher",
    "student", "school", "platform", "online", "video", "call", "audio", "voice", "number", "phone",
    "email", "address", "contact", "contacts", "hello", "sorry", "okay", "great", "first", "second",
}

_P_POSS = r"(?:мой|мою|моя|мое|мои|моего|моей|свой|свою|свои|свое|своего|своей|твой|твою|твоя|твое|твои|твоего|твоей|ваш|вашу|ваша|ваше|ваши|вашего|вашей)"
_P_CONTACT_OBJ = (r"(?:номер\w*|телефон\w*|тел|мобильн\w*|сотов\w*|почт\w*|e-?mail\w*|имейл\w*|емейл\w*|мейл\w*"
                  r"|электронк\w*|ящик\w*|контакт\w*|ник|никнейм\w*|логин\w*|аккаунт\w*|акк|данные для связи"
                  rf"|{_ANY_MESSENGER})")
_P_SEND = (r"(?:скинь|скиньте|скинешь|скинете|дай|дайте|дашь|дадите|оставь|оставьте|пришли|пришлите|продиктуй"
           r"|продиктуйте|кинь|киньте|отправь|отправьте|запиши|запишите|сохрани|сохраните|черкни|черкните)")
_P_REACH = (r"(?:напиши|напишите|пиши|пишите|написать|звони|звоните|позвони|позвоните|позвонить|набери|наберите"
            r"|добавь|добавьте|добавлю|найди|найдите|стучи|стучись|постучись|постучитесь|маякни|маякните|черкани"
            r"|свяжись|свяжитесь|связаться|свяжемся|спишемся|созвонимся|списаться|созвониться|переходи|переходите"
            r"|перейдем|перейди|перейдите|пообщаемся|общаться|продолжим|продолжить)")

# (шаблон, тип, серьёзность, язык)
INTENT_PATTERNS: list[tuple[str, Kind, Severity, str]] = [
    # ---- просьбы обменяться контактами
    (rf"{_P_POSS}\s+(?:\w+\s+)?{_P_CONTACT_OBJ}", Kind.CONTACT_REQUEST, Severity.MEDIUM, "ru"),
    (rf"{_P_SEND}\s+(?:мне\s+|пожалуйста\s+)*(?:{_P_POSS}\s+)?{_P_CONTACT_OBJ}", Kind.CONTACT_REQUEST, Severity.MEDIUM, "ru"),
    (rf"{_P_REACH}\s+(?:\w+\s+){{0,2}}(?:в|во|на|по)\s+(?:{_ANY_MESSENGER}|почту|телефон|номер\w*|мобильн\w*|личк\w*|лс)",
     Kind.CONTACT_REQUEST, Severity.HIGH, "ru"),
    (r"(?:позвони|позвоните|звони|звоните|набери|наберите)\s+мне", Kind.CONTACT_REQUEST, Severity.MEDIUM, "ru"),
    (r"(?:добавь|добавьте|найди|найдите)\s+меня", Kind.CONTACT_REQUEST, Severity.MEDIUM, "ru"),
    (r"как\s+(?:с\s+тобой|с\s+вами|тебе|вам|тебя|вас)\s+(?:можно\s+)?(?:связаться|написать|позвонить|найти|набрать)",
     Kind.CONTACT_REQUEST, Severity.MEDIUM, "ru"),
    (r"(?:где|как)\s+(?:тебя|вас)\s+(?:найти|искать)", Kind.CONTACT_REQUEST, Severity.MEDIUM, "ru"),
    (r"(?:есть|у\s+тебя\s+есть|у\s+вас\s+есть)\s+(?:ли\s+)?(?:у\s+(?:тебя|вас)\s+)?" + rf"(?:{_ANY_MESSENGER})\s*\?",
     Kind.CONTACT_REQUEST, Severity.MEDIUM, "ru"),
    (r"(?:вне|за\s+пределами)\s+(?:урок\w*|заняти\w*)\s+(?:пиши|пишите|звони|звоните|на\s+связи)",
     Kind.CONTACT_REQUEST, Severity.MEDIUM, "ru"),
    # ---- обход школы / оплата напрямую
    (r"(?:заниматься|заниматся|занимайся|занимайтесь|учиться|работать|общаться|созваниваться|продолжить|продолжим"
     r"|перейти|перейдем|переходим|уйти|уйдем|встречаться|видеться)\s+(?:\w+\s+){0,3}(?:напрямую|лично"
     r"|частно|без\s+школы|без\s+платформы|без\s+посредник\w*|минуя\s+\w+|вне\s+(?:школы|платформы)|в\s+обход\s+\w+)",
     Kind.OFF_PLATFORM, Severity.HIGH, "ru"),
    (r"(?:минуя|в\s+обход|вне|без)\s+(?:школ\w*|платформ\w*|сайт\w*|приложени\w*|посредник\w*|комисси\w*)",
     Kind.OFF_PLATFORM, Severity.MEDIUM, "ru"),
    (r"(?:плати|платить|платите|оплати|оплатите|оплачивай|оплачивайте|оплачивать|заплати|заплатите|скинь|скиньте"
     r"|переведи|переведите|перечисли|перечислите|кинь|киньте|отправь|отправьте|перевод|оплата|оплату|деньги)"
     r"\s+(?:\w+\s+){0,2}(?:напрямую|наличн\w*|налом|на\s+(?:мою\s+|мне\s+на\s+)?карт[уы]|на\s+сбер\w*|на\s+тинькофф\w*"
     r"|на\s+т-?банк\w*|на\s+альф\w*|по\s+сбп|через\s+сбп|по\s+номеру\s+(?:телефона|карты)|на\s+(?:мой\s+)?(?:счет|кошел\w*))",
     Kind.OFF_PLATFORM, Severity.HIGH, "ru"),
    (r"(?:номер\s+карты|реквизит\w*|сбп)", Kind.OFF_PLATFORM, Severity.MEDIUM, "ru"),
    (r"(?:дешевле|выгоднее|скидк\w*|бесплатно)\s+(?:\w+\s+){0,3}(?:напрямую|без\s+школы|без\s+платформы|без\s+комисси\w*"
     r"|лично|со\s+мной|у\s+меня)", Kind.OFF_PLATFORM, Severity.HIGH, "ru"),
    (r"(?:частн\w*|индивидуальн\w*|личн\w*|отдельн\w*)\s+(?:урок\w*|заняти\w*)\s+(?:\w+\s+){0,2}(?:у\s+меня|со\s+мной|напрямую)",
     Kind.OFF_PLATFORM, Severity.HIGH, "ru"),
    (r"(?:у\s+меня|со\s+мной)\s+(?:\w+\s+){0,2}(?:урок\w*|заняти\w*)\s+(?:\w+\s+){0,2}(?:дешевле|выгоднее)",
     Kind.OFF_PLATFORM, Severity.HIGH, "ru"),
    (r"(?:дешевле|выгоднее)\s*,?\s*(?:чем\s+)?(?:в|на|у|через)\s+(?:школ\w*|платформ\w*|сайт\w*)",
     Kind.OFF_PLATFORM, Severity.HIGH, "ru"),
    (r"(?:школ\w*|платформ\w*|сайт\w*)\s+(?:\w+\s+){0,2}(?:берет|забирает|берут|забирают|отнимает|снимает)\s+(?:\w+\s+){0,2}"
     r"(?:процент\w*|комисси\w*|половин\w*|деньг\w*|част\w*)", Kind.OFF_PLATFORM, Severity.HIGH, "ru"),
    (r"(?:не\s+говори|не\s+говорите|не\s+рассказывай|не\s+рассказывайте|не\s+сообщай|не\s+сообщайте|только\s+никому"
     r"|между\s+нами)\s*(?:\w+\s+){0,3}(?:школ\w*|администрац\w*|менеджер\w*|куратор\w*|модератор\w*|поддержк\w*)",
     Kind.OFF_PLATFORM, Severity.HIGH, "ru"),
    # ---- английский (часть урока — только фиксируем)
    (r"(?:my|your)\s+(?:phone|number|cell|mobile|e-?mail|telegram|whats?app|instagram|insta|contacts?|nickname|handle|username)",
     Kind.CONTACT_REQUEST, Severity.LOW, "en"),
    (r"(?:text|call|message|dm|add|find|contact|ping)\s+me\s+(?:on|at|in|via)", Kind.CONTACT_REQUEST, Severity.LOW, "en"),
    (r"(?:outside|off)\s+(?:of\s+)?(?:the\s+)?(?:platform|school)|pay\s+me\s+directly|without\s+the\s+(?:school|platform)"
     r"|private\s+lessons\s+with\s+me", Kind.OFF_PLATFORM, Severity.MEDIUM, "en"),
]
_INTENT_RE = [(re.compile(_B + p + _E), kind, sev, lang) for p, kind, sev, lang in INTENT_PATTERNS]


# ---------------------------------------------------------------------------
# Вспомогательные проверки
# ---------------------------------------------------------------------------

def _digits(s: str) -> str:
    return "".join(c for c in s if c.isdigit())


def luhn_valid(number: str) -> bool:
    digits = [int(c) for c in number if c.isdigit()]
    if len(digits) < 13:
        return False
    total = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def _is_progression(groups: list[str]) -> bool:
    """«12 13 14 15 16», «1998 1999 2000» — номера страниц/упражнений/годы, а не телефон."""
    nums = [int(g) for g in groups if g]
    if len(nums) < 3:
        return False
    diffs = {b - a for a, b in zip(nums, nums[1:], strict=False)}
    return len(diffs) == 1 and diffs.pop() in (1, -1, 2, 5, 10)


def _is_trivial_sequence(digits: str) -> bool:
    return digits in "01234567890123456789" or digits in "98765432109876543210" or len(set(digits)) == 1


def looks_like_strict_phone(raw: str) -> bool:
    """Номер, похожий на телефон без всякого контекста (RU-мобильный или международный с +)."""
    d = _digits(raw)
    if raw.strip().startswith("+"):
        return 10 <= len(d) <= 15
    if len(d) == 11 and d[0] in "78":
        return True
    return len(d) == 10 and d[0] == "9"


def _phone_candidates(text: str) -> list[tuple[str, tuple[int, int]]]:
    # Шаблон начинается с «+»/цифры и заканчивается цифрой, поэтому span точный.
    return [(m.group(0), m.span()) for m in _DIGIT_RUN_RE.finditer(text)]


def _digit_view(text: str) -> str:
    """Числа словами → цифры, буквы «о/O» и «l/I» внутри номера → 0/1."""
    t = textnorm.words_to_digits(textnorm.basic(text))
    for _ in range(4):
        new = re.sub(r"(?<=\d)[oо](?=[\d\s\-oо]|$)|(?<=[\s\-])[oо](?=\d)|(?<=\d)[lі|](?=\d)", lambda m: "0" if m.group(0) in "oо" else "1", t)
        if new == t:
            break
        t = new
    return t


def _domain_of(url: str) -> str:
    u = re.sub(r"^(?:https?://|tg://|viber://|whatsapp://|skype:)", "", url.lower())
    u = re.sub(r"^www\.", "", u)
    return re.split(r"[/?#:]", u, maxsplit=1)[0].rstrip(".")


def _domain_in(domain: str, domains: tuple[str, ...]) -> bool:
    return any(domain == d or domain.endswith("." + d) for d in domains)


# ---------------------------------------------------------------------------
# Проверка одного сообщения
# ---------------------------------------------------------------------------

class ContactGuard:
    """Проверка одного сообщения на контакты и попытки увести ученика."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or Settings()

    # -- белые списки -------------------------------------------------------
    def _allowed_email(self, email: str) -> bool:
        email = email.lower()
        domain = email.rsplit("@", 1)[-1]
        return email in self.settings.allowed_emails or _domain_in(domain, self.settings.allowed_domains)

    def _allowed_handle(self, handle: str) -> bool:
        return handle.lower().lstrip("@") in self.settings.allowed_handles

    def _allowed_phone(self, digits: str) -> bool:
        return any(p and digits[-10:] == p[-10:] for p in self.settings.allowed_phones)

    # -- детекторы ------------------------------------------------------------
    def _find_emails(self, text: str) -> list[Finding]:
        found = []
        for m in _EMAIL_RE.finditer(text):
            if not self._allowed_email(m.group(0)):
                found.append(Finding(Kind.EMAIL, Severity.HIGH, m.group(0), "адрес электронной почты", m.span()))
        return found

    def _find_urls(self, text: str, taken: list[tuple[int, int]]) -> list[Finding]:
        found = []
        for m in _URL_RE.finditer(text):
            if _overlaps(m.span(), taken):
                continue
            url = m.group(0).rstrip(".,;:!?)»\"'")
            domain = _domain_of(url)
            if not domain or _domain_in(domain, self.settings.allowed_domains):
                continue
            span = (m.start(), m.start() + len(url))
            if _domain_in(domain, MESSENGER_DOMAINS) or url.lower().startswith(("tg://", "viber://", "whatsapp://", "skype:")):
                found.append(Finding(Kind.MESSENGER_LINK, Severity.HIGH, url, f"ссылка на {domain}", span))
            elif _domain_in(domain, SHORTENER_DOMAINS):
                found.append(Finding(Kind.URL, Severity.MEDIUM, url, "сокращённая ссылка (может скрывать контакт)", span))
            else:
                found.append(Finding(Kind.URL, Severity.LOW, url, "внешняя ссылка", span))
        return found

    def _find_handles(self, text: str, taken: list[tuple[int, int]]) -> list[Finding]:
        found = []
        for m in _HANDLE_RE.finditer(text):
            if _overlaps(m.span(), taken) or self._allowed_handle(m.group(1)):
                continue
            found.append(Finding(Kind.HANDLE, Severity.HIGH, m.group(0), "ник в мессенджере", m.span()))
        return found

    def _find_phones_and_cards(self, text: str, context: bool, taken: list[tuple[int, int]]) -> list[Finding]:
        found = []
        for raw, span in _phone_candidates(text):
            if _overlaps(span, taken):
                continue
            digits = _digits(raw)
            groups = re.split(r"[^\d]+", raw)
            if 13 <= len(digits) <= 19 and luhn_valid(digits) and not raw.startswith("+"):
                found.append(Finding(Kind.CARD, Severity.HIGH, raw, "номер банковской карты", span))
                continue
            if re.fullmatch(r"\d{4}(?:[ \-]?\d{4}){3}\d{0,3}", raw):
                found.append(Finding(Kind.CARD, Severity.MEDIUM, raw, "похоже на номер банковской карты", span))
                continue
            if len(digits) < 7 or len(digits) > 15 or _is_progression(groups) or _is_trivial_sequence(digits):
                continue
            if self._allowed_phone(digits):
                continue
            if looks_like_strict_phone(raw) or (context and len(digits) >= 7):
                found.append(Finding(Kind.PHONE, Severity.HIGH, raw, "номер телефона", span))
            elif len(digits) >= 10:
                found.append(Finding(Kind.PHONE, Severity.MEDIUM, raw, "похоже на номер телефона", span))
        return found

    def _find_messengers(self, norm: str) -> list[Finding]:
        found = []
        for name, rx in _MESSENGER_RE.items():
            m = rx.search(norm)
            if m:
                found.append(Finding(Kind.MESSENGER, Severity.LOW, name, f"упоминание: {name}"))
        return found

    def _find_intents(self, norm: str) -> list[tuple[Finding, str]]:
        found = []
        for rx, kind, sev, lang in _INTENT_RE:
            m = rx.search(norm)
            if m:
                found.append((Finding(kind, sev, m.group(0), KIND_TITLES[kind]), lang))
        return found

    def _find_obfuscated(self, text: str, norm: str, context: bool, known: set[str]) -> list[Finding]:
        """Контакты, которые видны только после нормализации (без позиции в исходном тексте)."""
        found: list[Finding] = []
        # e-mail: «собака», «точка», «гмейл», разрядка
        for source in {textnorm.basic(text), norm}:
            for m in _EMAIL_RE.finditer(textnorm.deobfuscate_email(source)):
                email = m.group(0).lower()
                if email not in known and not self._allowed_email(email):
                    known.add(email)
                    found.append(Finding(Kind.EMAIL, Severity.HIGH, email, "замаскированный адрес почты"))
        # телефон: числа словами, буквы вместо цифр
        dview = _digit_view(text)
        for raw, _span in _phone_candidates(dview):
            digits = _digits(raw)
            if digits in known or len(digits) < 7 or len(digits) > 15:
                continue
            if _is_progression(re.split(r"[^\d]+", raw)) or _is_trivial_sequence(digits) or self._allowed_phone(digits):
                continue
            if looks_like_strict_phone(raw) or (context and len(digits) >= 10):
                known.add(digits)
                found.append(Finding(Kind.PHONE, Severity.HIGH, raw, "номер телефона, записанный в замаскированном виде"))
        # ник после «телеграм:», «ник —», «мой инст …»
        for m in _HANDLE_TRIGGER_RE.finditer(norm):
            handle = m.group(1).strip(".")
            if handle in known or handle in _COMMON_EN or self._allowed_handle(handle):
                continue
            explicit = bool(re.search(r"[\d_]", handle)) or bool(re.search(r"(?:ник|логин|username|юзер|акк)", m.group(0)))
            explicit = explicit or ":" in m.group(0) or "@" in m.group(0)
            if explicit and len(handle) >= 4:
                known.add(handle)
                found.append(Finding(Kind.HANDLE, Severity.HIGH, handle, "ник/аккаунт после названия мессенджера"))
        return found

    # -- основной метод -------------------------------------------------------
    def check(self, text: str) -> ModerationResult:
        text = text or ""
        norm = textnorm.for_matching(text)
        context = bool(_PHONE_CONTEXT_RE.search(norm))

        findings: list[Finding] = []
        findings += self._find_emails(text)
        taken = [f.span for f in findings if f.span]
        findings += self._find_urls(text, taken)
        taken = [f.span for f in findings if f.span]
        findings += self._find_handles(text, taken)
        taken = [f.span for f in findings if f.span]
        findings += self._find_phones_and_cards(text, context, taken)

        known: set[str] = set()
        for f in findings:
            known.add(f.value.lower())
            known.add(_digits(f.value))
            if f.kind == Kind.HANDLE:
                known.add(f.value.lower().lstrip("@"))
        known.discard("")
        findings += self._find_obfuscated(text, norm, context, known)

        messengers = self._find_messengers(norm)
        intents = self._find_intents(norm)
        findings += messengers
        findings += [f for f, _ in intents]

        severity = max((f.severity for f in findings), default=Severity.NONE)

        # Комбинации усиливают друг друга.
        ru_intents = [f for f, lang in intents if lang == "ru"]
        en_intents = [f for f, lang in intents if lang == "en"]
        if ru_intents and messengers:
            severity = max(severity, Severity.HIGH)
        if len({f.kind for f in ru_intents if f.severity >= Severity.MEDIUM}) >= 2:
            severity = max(severity, Severity.HIGH)
        if en_intents and messengers:
            severity = max(severity, Severity.MEDIUM)
        if any(f.kind in DATA_KINDS and f.severity == Severity.MEDIUM for f in findings) and (ru_intents or messengers):
            severity = max(severity, Severity.HIGH)

        return self._finalize(text, findings, severity)

    def _finalize(self, text: str, findings: list[Finding], severity: Severity) -> ModerationResult:
        if severity >= Severity.HIGH and self.settings.block_contacts:
            action = "block"
        elif severity >= Severity.MEDIUM:
            action = "warn"
        else:
            action = "allow"
        redacted = text
        if action == "block":
            data = [f for f in findings if f.kind in DATA_KINDS or f.kind == Kind.URL]
            if any(f.span is None and f.severity >= Severity.HIGH for f in data) or not any(f.span for f in data):
                redacted = REDACTED_MESSAGE
            else:
                redacted = mask_spans(text, [f.span for f in data if f.span and f.severity >= Severity.MEDIUM])
        return ModerationResult(text, redacted, severity, action, findings)


def _overlaps(span: tuple[int, int], spans: list[tuple[int, int]]) -> bool:
    return any(span[0] < b and a < span[1] for a, b in spans)


def mask_spans(text: str, spans: list[tuple[int, int]]) -> str:
    if not spans:
        return text
    merged: list[list[int]] = []
    for a, b in sorted(spans):
        if merged and a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    out, pos = [], 0
    for a, b in merged:
        out.append(text[pos:a])
        out.append(REDACTED)
        pos = b
    out.append(text[pos:])
    return "".join(out)


# ---------------------------------------------------------------------------
# Проверка диалога: номер, разбитый на несколько сообщений
# ---------------------------------------------------------------------------

@dataclass
class _Fragment:
    ts: float
    text: str
    ref: Hashable | None


class ConversationGuard:
    """Проверяет сообщения в контексте диалога.

    Ловит контакты, разбитые на части: «8 900» → «123» → «45 67» или
    «ivan» → «собака» → «gmail.com». Хранит несколько последних коротких
    сообщений каждого участника в пределах временного окна.
    """

    MAX_FRAGMENTS = 6
    MAX_FRAGMENT_LEN = 40

    def __init__(self, guard: ContactGuard | None = None, window_seconds: int | None = None):
        self.guard = guard or ContactGuard()
        self.window = window_seconds if window_seconds is not None else self.guard.settings.split_window_seconds
        self._buffers: dict[Hashable, deque[_Fragment]] = {}

    def reset(self, speaker: Hashable | None = None) -> None:
        if speaker is None:
            self._buffers.clear()
        else:
            self._buffers.pop(speaker, None)

    def check(self, speaker: Hashable, text: str, ts: float | None = None, ref: Hashable | None = None) -> ModerationResult:
        ts = time.time() if ts is None else ts
        result = self.guard.check(text)
        buf = self._buffers.setdefault(speaker, deque(maxlen=self.MAX_FRAGMENTS))
        while buf and ts - buf[0].ts > self.window:
            buf.popleft()

        stripped = (text or "").strip()
        if result.blocked:
            buf.clear()
            return result
        if not stripped or len(stripped) > self.MAX_FRAGMENT_LEN:
            return result

        buf.append(_Fragment(ts, stripped, ref))
        if len(buf) < 2:
            return result

        joined = " ".join(f.text for f in buf)
        combined = self.guard.check(joined)
        new_data = [f for f in combined.findings if f.kind in DATA_KINDS and f.severity >= Severity.HIGH]
        if not new_data:
            return result
        # Номер по частям — только строгий формат, чтобы ответы вида «1990», «1812» не путались с телефоном.
        strict = [f for f in new_data if f.kind != Kind.PHONE or looks_like_strict_phone(f.value)]
        if not strict:
            return result
        refs = [f.ref for f in list(buf)[:-1] if f.ref is not None]
        buf.clear()
        findings = result.findings + [
            Finding(f.kind, Severity.HIGH, f.value, f"{f.reason} (передан по частям в нескольких сообщениях)")
            for f in strict
        ]
        final = self.guard._finalize(text, findings, Severity.HIGH)
        final.redacted_text = REDACTED_MESSAGE if final.blocked else final.redacted_text
        final.related_refs = refs
        return final
