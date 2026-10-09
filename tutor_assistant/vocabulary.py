"""Выписывание новых слов с урока.

Три источника, в порядке надёжности:

1. Объявленный список — «Новые слова сегодня: apple — яблоко, pear — груша»,
   «Запишите слова:» и следующие за этим строки-пункты, «New words: …».
2. Пары в речи преподавателя — «apple переводится как яблоко»,
   «яблоко по-английски apple», «слово brave — смелый».
3. Автопоиск — слова изучаемого языка в речи преподавателя, которых нет в
   словаре ученика и в списке самых частотных слов (кандидаты, «звучали на уроке»).
"""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Iterable

from .models import Utterance, VocabItem, word_key
from .textnorm import has_cyrillic, has_latin

ANNOUNCE_RE = re.compile(
    r"(?:нов(?:ые|ое|ых)\s+слов(?:а|о|ечки|ами)?|нов(?:ая|ую)\s+лексик[аи]|слова\s+(?:на\s+)?сегодня|сегодняшние\s+слова"
    r"|слова\s+(?:урока|дня)|запиши(?:те)?\s+(?:себе\s+)?(?:новые\s+)?слова|выпиши(?:те)?\s+(?:новые\s+)?слова"
    r"|словарик|словарь\s+урока|лексика\s+урока|ключевые\s+слова|new\s+words|today'?s\s+words|word\s*list"
    r"|vocabulary|key\s+words|words\s+of\s+the\s+day)"
    r"(?:\s+(?:на\s+)?(?:сегодня|урока|дня|today|for\s+today|of\s+the\s+lesson))?"
    r"\s*(?P<sep>[:\-—–]|\n)\s*(?P<list>.*)",
    re.IGNORECASE | re.DOTALL,
)
# «Запишите новые слова.» — объявление, а сам список придёт следующими сообщениями.
ANNOUNCE_NO_LIST_RE = re.compile(
    r"(?:запиши(?:те)?|выпиши(?:те)?|записываем|выписываем)\s+(?:себе\s+)?(?:новые\s+)?слова\b"
    r"|(?:вот|теперь)\s+новые\s+слова\b|(?:let'?s\s+)?write\s+down\s+(?:the\s+)?(?:new\s+)?words"
    r"|^\s*(?:новые\s+слова(?:\s+на)?\s+сегодня|new\s+words(?:\s+for\s+today)?)\s*[.!]?\s*$",
    re.IGNORECASE,
)

_BULLET_RE = re.compile(r"^\s*(?:[-*•·–—]+|\d{1,2}\s*[.)]|[a-zа-я]\))\s*", re.IGNORECASE)
_TRANSCRIPTION_RE = re.compile(r"\s*(\[[^\]\n]{1,40}\]|/[^/\n]{1,40}/)\s*")
_PAIR_SEP_RE = re.compile(r"\s*(?:—|–|=|->|→|:)\s*|\s+-\s+")
_PAREN_RE = re.compile(r"^(?P<a>[^()]+?)\s*\((?P<b>[^)]+)\)\s*$")

_FREE_PAIR_PATTERNS = [
    # apple переводится как яблоко / apple означает яблоко / apple — это яблоко
    re.compile(r"(?P<w>[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\-]*(?:\s+[A-Za-zÀ-ÿ'’\-]+){0,3})\s*(?:—|–|-)?\s*"
               r"(?:переводится\s+как|означает|значит|это\s+значит|—\s*это|–\s*это|-\s*это|это)\s+"
               r"[«\"]?(?P<t>[а-яёА-ЯЁ][а-яёА-ЯЁ\-]*(?:\s+[а-яёА-ЯЁ\-]+){0,3})"),
    # яблоко по-английски apple / яблоко на английском будет apple
    re.compile(r"(?P<t>[а-яёА-ЯЁ][а-яёА-ЯЁ\-]*(?:\s+[а-яёА-ЯЁ\-]+){0,2})\s+"
               r"(?:по-английски|по-немецки|по-французски|по-испански|по-итальянски|на\s+английском|на\s+немецком"
               r"|на\s+французском|на\s+испанском|на\s+итальянском)\s+(?:будет\s+|—\s+|звучит\s+как\s+)?"
               r"[«\"]?(?P<w>[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\-]*(?:\s+[A-Za-zÀ-ÿ'’\-]+){0,3})"),
    # слово brave — смелый
    re.compile(r"слов[оа]\s+[«\"]?(?P<w>[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\-]*(?:\s+[A-Za-zÀ-ÿ'’\-]+){0,2})[»\"]?\s*(?:—|–|-|:)\s*"
               r"(?:это\s+)?[«\"]?(?P<t>[а-яёА-ЯЁ][а-яёА-ЯЁ\-]*(?:\s+[а-яёА-ЯЁ\-]+){0,3})"),
]
_RU_STOP_TAIL = {"а", "но", "и", "или", "то", "да", "же", "ли", "вот", "так", "это", "потому", "что", "когда", "если"}

# Самые частотные слова: служебные и базовые — не считаем «новыми».
STOPWORDS = {
    "en": set("""
a about above after again against all almost also always am an and any are aren't around as ask at away back be
because been before being below between big both but by can can't come could couldn't day did didn't do does doesn't
doing don't down during each even ever every few find first for from get give go goes going gone good got great
had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's
i i'd i'll i'm i've if in into is isn't it it's its itself just know last let let's like little long look lot made
make many may me might more most much must mustn't my myself need never new next no nor not now of off often oh ok okay
old on once one only or other our ours ourselves out over own people please put really right said same say see
shall shan't she she'd she'll she's should shouldn't so some something still such sure take tell than thank thanks
that that's the their theirs them themselves then there there's these they they'd they'll they're they've thing
think this those through time to today too try two under until up us use very want was wasn't way we we'd we'll
we're we've well went were weren't what what's when when's where where's which while who who's whom why why's will
with won't word words work would wouldn't yeah yes yet you you'd you'll you're you've your yours yourself yourselves
hello hi bye goodbye sorry fine three four five six seven eight nine ten lesson teacher student example examples
answer question sentence repeat read write listen speak translate correct exercise page number next again another
""".split()),
    "de": set("""der die das ein eine einen einem einer und oder aber ich du er sie es wir ihr ist sind bin bist war
waren hat habe haben nicht kein keine mit von zu im in am an auf aus bei für ja nein gut sehr auch noch schon was wie
wo wer wann warum dann den dem des""".split()),
    "fr": set("""le la les un une des et ou mais je tu il elle nous vous ils elles est sont suis es a ai avons ont pas
ne de du au aux en dans sur avec pour par oui non bien très aussi que qui quoi comment où quand pourquoi""".split()),
    "es": set("""el la los las un una unos unas y o pero yo tú él ella nosotros vosotros ellos es son soy eres está
están no sí de del al en con por para muy bien también que quien qué cómo dónde cuándo por qué""".split()),
    "it": set("""il lo la i gli le un una e o ma io tu lui lei noi voi loro è sono sei ho hai ha non di da in con su
per sì no molto bene anche che chi cosa come dove quando perché""".split()),
}

# Грамматические термины и самые базовые слова уровня A1 — не «новая лексика».
STOPWORDS["en"] |= set("""
present past future perfect simple continuous progressive tense tenses verb verbs noun nouns adjective adverb
pronoun preposition article articles form forms participle infinitive gerund passive active voice modal
irregular regular plural singular grammar vocabulary sentence sentences question questions negative positive
affirmative conditional subject object clause phrase phrasal comparative superlative auxiliary
man woman child children boy girl friend family mother father brother sister home house room flat school
city country world water food bread milk tea coffee morning evening night week month year yesterday tomorrow
monday tuesday wednesday thursday friday saturday sunday january february march april may june july august
september october november december red blue green yellow black white small large nice bad happy sad hot cold
eat drink sleep play run walk open close start stop live love hate help call ask answer learn study teach show
book pen table chair door window car bus train street shop money name age hour minute today tonight here there
cat dog apple ball phone game music film movie picture photo bed kitchen
""".split()) - {"kitchen", "flat"}

_LATIN_WORD_RE = re.compile(r"(?<![\w@/.])[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’]*[A-Za-zÀ-ÿ](?![\w@])")


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip(" \t.,;:!?\"'«»")


def _lemma_en(word: str) -> str:
    w = word.lower().replace("’", "'")
    w = re.sub(r"'s$", "", w)
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 4 and re.search(r"(?:ch|sh|x|ss|z)es$", w):
        return w[:-2]
    if len(w) > 3 and w.endswith("s") and not re.search(r"(?:ss|us|is|ous)$", w):
        return w[:-1]
    return w


def parse_item(raw: str) -> VocabItem | None:
    """«apple [ˈæpl] — яблоко», «яблоко — apple», «to run (бегать)», «apple»."""
    text = _BULLET_RE.sub("", raw.strip())
    text = _clean(text)
    if not text or len(text) > 120:
        return None
    transcription = None
    m = _TRANSCRIPTION_RE.search(text)
    if m:
        transcription = m.group(1)
        text = text[: m.start()] + " " + text[m.end():]
        text = re.sub(r"(?:\s*(?:—|–|=|:|\s-\s)\s*){2,}", " — ", text)
        text = _clean(text).strip(" —–-")

    word, translation = text, None
    parts = _PAIR_SEP_RE.split(text, maxsplit=1)
    if len(parts) == 2 and parts[0].strip() and parts[1].strip():
        word, translation = parts[0], parts[1]
    else:
        pm = _PAREN_RE.match(text)
        if pm:
            word, translation = pm.group("a"), pm.group("b")
    word, translation = _clean(word), _clean(translation) if translation else None

    # Иностранное слово — слева. Если слева кириллица, а справа латиница — меняем местами.
    if translation and has_cyrillic(word) and not has_latin(word) and has_latin(translation):
        word, translation = translation, word
    if not word or (has_cyrillic(word) and not has_latin(word)):
        return None
    if len(word.split()) > 6:
        return None
    return VocabItem(word=word, translation=translation or None, transcription=transcription, source="teacher_list")


def split_list(list_text: str) -> list[str]:
    """Делит перечисление на пункты: строки, «;», запятые между парами."""
    items: list[str] = []
    for line in list_text.split("\n"):
        line = line.strip()
        if not line:
            continue
        for chunk in re.split(r"\s*;\s*", line):
            pieces = [p for p in re.split(r"\s*,\s*", chunk) if p.strip()]
            for piece in pieces:
                # «run — бегать, бежать»: кусок без латиницы — дополнительный перевод предыдущего слова.
                if items and not has_latin(piece) and has_cyrillic(piece) and _PAIR_SEP_RE.search(items[-1]):
                    items[-1] += ", " + piece
                else:
                    items.append(piece)
    return items


def is_list_line(text: str) -> bool:
    """Похожа ли реплика на продолжение списка слов (пункт или короткое перечисление)."""
    t = text.strip()
    if not t or len(t) > 300 or not has_latin(t):
        return False
    lines = [ln for ln in t.split("\n") if ln.strip()]
    def one(ln: str) -> bool:
        ln = _BULLET_RE.sub("", ln.strip())
        if _PAIR_SEP_RE.search(ln) and len(ln.split()) <= 10:
            return True
        return len(ln.split()) <= 4 and not re.search(r"[.!?]$", ln)
    return all(one(ln) for ln in lines)


def extract_announced(text: str) -> tuple[list[VocabItem], bool]:
    """Слова из объявления в одной реплике.

    Возвращает (слова, ожидать_продолжение) — второе значение True, если
    объявлен список, но сами слова придут в следующих репликах.
    """
    m = ANNOUNCE_RE.search(text or "")
    if m:
        list_text = m.group("list").strip()
        items = [it for it in (parse_item(x) for x in split_list(list_text)) if it]
        return items, not items
    if ANNOUNCE_NO_LIST_RE.search(text or ""):
        return [], True
    return [], False


def extract_pairs(text: str) -> list[VocabItem]:
    found: list[VocabItem] = []
    for rx in _FREE_PAIR_PATTERNS:
        for m in rx.finditer(text or ""):
            w = _clean(m.group("w"))
            t_words = _clean(m.group("t")).split()
            while t_words and t_words[-1].lower() in _RU_STOP_TAIL:
                t_words.pop()
            cut = [i for i, x in enumerate(t_words) if x.lower() in {"а", "но"}]
            if cut:
                t_words = t_words[: cut[0]]
            t = " ".join(t_words)
            if t[:1].isupper() and t[1:].islower():
                t = t[0].lower() + t[1:]
            if w and t and len(w.split()) <= 4:
                found.append(VocabItem(word=w, translation=t, source="pair"))
    return found


class VocabularyCollector:
    """Собирает слова по ходу урока (используется и для живого чата, и для транскрипта)."""

    def __init__(self, target_language: str = "en"):
        self.target_language = target_language
        self.items: dict[str, VocabItem] = {}
        self._awaiting_list = False

    def add(self, item: VocabItem) -> bool:
        key = item.key
        if not key:
            return False
        existing = self.items.get(key)
        if existing is None:
            self.items[key] = item
            return True
        # Дополняем недостающие поля, источник «teacher_list» главнее.
        for field in ("translation", "transcription", "part_of_speech", "example"):
            if not getattr(existing, field) and getattr(item, field):
                setattr(existing, field, getattr(item, field))
        if item.source == "teacher_list":
            existing.source = "teacher_list"
        return False

    def feed_tutor_message(self, text: str) -> list[VocabItem]:
        """Обработать реплику преподавателя; вернуть только что добавленные слова."""
        added: list[VocabItem] = []
        announced, awaiting = extract_announced(text)
        if announced or awaiting:
            self._awaiting_list = awaiting
            for it in announced:
                if self.add(it):
                    added.append(it)
        elif self._awaiting_list and is_list_line(text):
            for raw in split_list(text):
                it = parse_item(raw)
                if it and self.add(it):
                    added.append(it)
        else:
            self._awaiting_list = False
        for it in extract_pairs(text):
            if self.add(it):
                added.append(it)
        return added

    def stop_awaiting(self) -> None:
        self._awaiting_list = False

    @property
    def words(self) -> list[VocabItem]:
        return list(self.items.values())


def auto_candidates(
    utterances: Iterable[Utterance],
    target_language: str = "en",
    known: Iterable[str] = (),
    limit: int = 12,
) -> list[VocabItem]:
    """Слова изучаемого языка из речи преподавателя, вероятно новые для ученика."""
    stop = STOPWORDS.get(target_language, set())
    known_keys = {word_key(k) for k in known}
    known_lemmas = {_lemma_en(k) for k in known_keys}
    counts: Counter[str] = Counter()
    surface: dict[str, Counter[str]] = {}
    explained: set[str] = set()
    student_used: set[str] = set()
    examples: dict[str, str] = {}

    for u in utterances:
        sentences = re.split(r"(?<=[.!?])\s+|\n", u.text)
        for sent in sentences:
            mixed = has_cyrillic(sent) and has_latin(sent)
            for m in _LATIN_WORD_RE.finditer(sent):
                w = m.group(0).replace("’", "'")
                lw = w.lower()
                if len(lw) < 3 or lw in stop or (w.isupper() and len(w) > 1):
                    continue
                lemma = _lemma_en(lw) if target_language == "en" else lw
                if lemma in stop or lemma in known_keys or lemma in known_lemmas:
                    continue
                if u.is_tutor:
                    counts[lemma] += 1
                    surface.setdefault(lemma, Counter())[lw] += 1
                    if mixed:
                        explained.add(lemma)
                    if lemma not in examples and not has_cyrillic(sent) and 4 <= len(sent.split()) <= 20:
                        examples[lemma] = sent.strip()
                else:
                    student_used.add(lemma)

    # cleaned → clean, moving → move: сливаем формы с уже найденной основой.
    for lemma in list(counts):
        for suffix, repl in (("ed", ""), ("ed", "e"), ("d", ""), ("ing", ""), ("ing", "e")):
            base = lemma[: -len(suffix)] + repl if lemma.endswith(suffix) else None
            if base and base != lemma and (base in counts or base in stop or base in known_keys):
                if base in counts:
                    counts[base] += counts[lemma]
                    surface[base].update(surface.get(lemma, Counter()))
                    if lemma in explained:
                        explained.add(base)
                del counts[lemma]
                break

    scored = []
    for lemma, n in counts.items():
        score = n + (2 if lemma in explained else 0) + (1 if lemma in student_used else 0)
        if score >= 2:
            scored.append((score, lemma))
    scored.sort(key=lambda x: (-x[0], x[1]))
    out = []
    for _, lemma in scored[:limit]:
        form = lemma if lemma in surface[lemma] else surface[lemma].most_common(1)[0][0]
        out.append(VocabItem(word=form, example=examples.get(lemma), source="auto"))
    return out


def attach_examples(items: Iterable[VocabItem], utterances: Iterable[Utterance]) -> None:
    """Подбирает пример употребления из речи на уроке (предложение без кириллицы)."""
    sentences = []
    for u in utterances:
        for s in re.split(r"(?<=[.!?])\s+|\n", u.text):
            s = s.strip()
            if s and not has_cyrillic(s) and has_latin(s) and 3 <= len(s.split()) <= 25:
                sentences.append(s)
    for it in items:
        if it.example:
            continue
        rx = re.compile(r"(?<![\w])" + re.escape(it.key) + r"(?:s|es|ed|ing|d)?(?![\w])", re.IGNORECASE)
        for s in sentences:
            if rx.search(s) and word_key(s) != it.key:
                it.example = s
                break
