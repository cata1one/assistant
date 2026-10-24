"""Нормализация текста.

Нарушители редко пишут контакты «в лоб»: используют латинские буквы вместо
кириллических (тeлeгрaм), разрядку (т е л е г р а м), числа словами
(восемь девятьсот ...), «собаку» вместо @ и т.п. Здесь собраны функции,
которые приводят такие тексты к каноническому виду перед проверкой.
"""

from __future__ import annotations

import re
import unicodedata

_INVISIBLE = dict.fromkeys(map(ord, "­​‌‍‎‏⁠⁡⁢⁣﻿"), None)

# Латиница, похожая на кириллицу, и наоборот (после приведения к нижнему регистру).
_LAT_TO_CYR = str.maketrans({"a": "а", "c": "с", "e": "е", "o": "о", "p": "р", "x": "х", "y": "у",
                             "k": "к", "m": "м", "t": "т", "h": "н", "b": "в", "u": "и", "3": "з"})
_CYR_TO_LAT = str.maketrans({"а": "a", "с": "c", "е": "e", "о": "o", "р": "p", "х": "x", "у": "y",
                             "к": "k", "м": "m", "т": "t", "н": "h", "в": "b", "і": "i", "ј": "j",
                             "ѕ": "s", "ԁ": "d", "ԛ": "q", "ԝ": "w"})

_CYR_RE = re.compile(r"[а-яё]")
_LAT_RE = re.compile(r"[a-z]")
_WORD_RE = re.compile(r"[^\W_]+", re.UNICODE)


def basic(text: str) -> str:
    """NFKC, нижний регистр, ё→е, удаление невидимых символов."""
    text = unicodedata.normalize("NFKC", text or "").translate(_INVISIBLE)
    return text.lower().replace("ё", "е")


def has_cyrillic(text: str) -> bool:
    return bool(_CYR_RE.search(text.lower()))


def has_latin(text: str) -> bool:
    return bool(_LAT_RE.search(text.lower()))


def _fix_word(word: str) -> str:
    cyr = len(_CYR_RE.findall(word))
    lat = len(_LAT_RE.findall(word))
    if cyr and lat:
        return word.translate(_LAT_TO_CYR) if cyr >= lat else word.translate(_CYR_TO_LAT)
    return word


def fix_homoglyphs(text: str) -> str:
    """Чинит слова, в которых смешаны кириллица и латиница (тeлeгрaм → телеграм)."""
    return _WORD_RE.sub(lambda m: _fix_word(m.group(0)), text)


# Разрядка: «т е л е г р а м», «t.e.l.e.g.r.a.m», «в-а-т-с-а-п».
_SPACED_RE = re.compile(r"(?<![^\W\d_])(?:[^\W\d_][ \t.\-_*·•|/]+){3,}[^\W\d_](?![^\W\d_])")


def collapse_spaced_letters(text: str) -> str:
    return _SPACED_RE.sub(lambda m: re.sub(r"[ \t.\-_*·•|/]+", "", m.group(0)), text)


def for_matching(text: str) -> str:
    """Канонический вид для поиска ключевых фраз."""
    text = basic(text)
    text = collapse_spaced_letters(text)
    text = fix_homoglyphs(text)
    return re.sub(r"\s+", " ", text).strip()


# ---------------------------------------------------------------------------
# Числа словами → цифры
# ---------------------------------------------------------------------------

_UNITS = {
    "ноль": 0, "нуль": 0, "один": 1, "одна": 1, "одно": 1, "два": 2, "две": 2, "три": 3,
    "четыре": 4, "пять": 5, "шесть": 6, "семь": 7, "восемь": 8, "девять": 9,
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9,
}
_TEENS = {
    "десять": 10, "одиннадцать": 11, "двенадцать": 12, "тринадцать": 13, "четырнадцать": 14,
    "пятнадцать": 15, "шестнадцать": 16, "семнадцать": 17, "восемнадцать": 18, "девятнадцать": 19,
    "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
}
_TENS = {
    "двадцать": 20, "тридцать": 30, "сорок": 40, "пятьдесят": 50, "шестьдесят": 60,
    "семьдесят": 70, "восемьдесят": 80, "девяносто": 90,
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70,
    "eighty": 80, "ninety": 90,
}
_HUNDREDS = {
    "сто": 100, "двести": 200, "триста": 300, "четыреста": 400, "пятьсот": 500,
    "шестьсот": 600, "семьсот": 700, "восемьсот": 800, "девятьсот": 900,
}
_PLUS = {"плюс", "plus"}

_LEVEL = {**{k: 0 for k in _UNITS}, **{k: 1 for k in _TEENS}, **{k: 2 for k in _TENS}, **{k: 3 for k in _HUNDREDS}}
_VALUE = {**_UNITS, **_TEENS, **_TENS, **_HUNDREDS}

_TOKEN_RE = re.compile(r"[^\W\d_]+|\d+|[^\w]+|_", re.UNICODE)


def words_to_digits(text: str) -> str:
    """«восемь девятьсот двадцать три» → «8 923»; «плюс семь» → «+7».

    Числительные объединяются в группы так, как их произносят при диктовке номера.
    Остальной текст сохраняется. Ожидает текст после :func:`basic`.
    """
    out: list[str] = []
    group_value: int | None = None
    group_level = 99  # минимальный «разряд», уже занятый в группе

    def flush() -> None:
        nonlocal group_value, group_level
        if group_value is not None:
            out.append(str(group_value))
            out.append(" ")
        group_value, group_level = None, 99

    for token in _TOKEN_RE.findall(text):
        word = token.lower()
        if word in _VALUE:
            level, value = _LEVEL[word], _VALUE[word]
            if value == 0:
                flush()
                out.extend(["0", " "])
                continue
            # Сотни принимают десятки/«-надцать»/единицы, десятки – только единицы:
            # «девятьсот двадцать три» → 923, «восемь девятьсот» → 8 900.
            if group_value is not None and ((group_level == 3 and level < 3) or (group_level == 2 and level == 0)):
                group_value += value
                group_level = level
                continue
            flush()
            group_value, group_level = value, level
            continue
        if word == "hundred" and group_value is not None and group_level == 0:
            group_value *= 100
            group_level = 3
            continue
        if word in _PLUS:
            flush()
            out.append("+")
            continue
        if group_value is not None and re.fullmatch(r"[\s,\-]+", token):
            continue  # разделитель внутри диктовки
        flush()
        out.append(token)
    flush()
    result = re.sub(r"\+\s+(?=\d)", "+", "".join(out))
    return re.sub(r"[ ]{2,}", " ", result).strip()


# ---------------------------------------------------------------------------
# Замаскированные адреса почты
# ---------------------------------------------------------------------------

MAIL_PROVIDERS = (
    "gmail", "googlemail", "yandex", "ya", "mail", "inbox", "list", "bk", "rambler", "outlook",
    "hotmail", "live", "icloud", "me", "proton", "protonmail", "yahoo", "aol", "zoho", "gmx", "web",
)

_PROVIDER_SPELLINGS = [
    (r"гм[еэа]й?л|джим[еэа]й?л|джимаил|гмаил", "gmail"),
    (r"яндекс|яндэкс", "yandex"),
    (r"м[еэа]йл|маил", "mail"),
    (r"рамблер", "rambler"),
    (r"аутлук", "outlook"),
    (r"айклауд", "icloud"),
    (r"инбокс", "inbox"),
]
_TLD_SPELLINGS = [(r"ру", "ru"), (r"ком", "com"), (r"нет", "net"), (r"орг", "org")]


def deobfuscate_email(text: str) -> str:
    """Восстанавливает адреса вида «ivan собака gmail точка com», «ivan [at] ya (dot) ru».

    Ожидает текст после :func:`basic`. Применяется только для поиска e-mail,
    поэтому агрессивные замены здесь безопасны.
    """
    t = text
    for pattern, repl in _PROVIDER_SPELLINGS:
        t = re.sub(rf"(?<![^\W\d_]){pattern}(?![^\W\d_])", repl, t)
    # Диктовка вслух: «нижнее подчёркивание», «дефис»
    t = re.sub(r"\s*(?<![^\W\d_])(?:нижнее\s+)?подчеркивани[ея](?![^\W\d_])\s*", "_", t)
    t = re.sub(r"\s*(?<![^\W\d_])(?:underscore)(?![^\W\d_])\s*", "_", t)
    # «собака», «собачка», «(at)», «[at]», «{at}», «(собака)» – всегда означают @
    t = re.sub(r"\s*[\(\[\{<]\s*(?:at|собака|собачка|эт)\s*[\)\]\}>]\s*", "@", t)
    t = re.sub(r"\s*(?<![^\W\d_])(?:собака|собачка|собачкой|собакой)(?![^\W\d_])\s*", "@", t)
    # «точка», «(dot)», « dot » – точка
    t = re.sub(r"\s*[\(\[\{<]\s*(?:dot|точка)\s*[\)\]\}>]\s*", ".", t)
    t = re.sub(r"\s*(?<![^\W\d_])(?:точка|dot)(?![^\W\d_])\s*", ".", t)
    # Голое «at»/«эт» – только перед известным почтовым доменом, иначе «look at google.com» стал бы адресом.
    providers = "|".join(MAIL_PROVIDERS)
    t = re.sub(rf"\s+(?:at|эт)\s+(?=(?:{providers})\s*\.)", "@", t)
    for pattern, repl in _TLD_SPELLINGS:
        t = re.sub(rf"(?<=\.){pattern}(?![^\W\d_])", repl, t)
    t = re.sub(r"\s*@\s*", "@", t)
    t = re.sub(r"(?<=[\w@])\s*\.\s*(?=[a-z]{2,})", ".", t)
    return t
