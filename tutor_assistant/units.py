"""Интерактивные занятия (как на ProgressMe): из блоков разного типа.

Блоки:
* ``text`` – текст или правило;
* ``words`` – новые слова, при выдаче занятия они сразу попадают в карточки ученика;
* ``gap`` – вставить слова в текст: правильный ответ пишется в квадратных скобках,
  варианты через «|»: «I [have been|'ve been] to London»;
* ``match`` – пары: слово и определение (перевод);
* ``choice`` – тест с вариантами ответа;
* ``listening`` – аудирование: аудиофайл или озвучка текста браузером, пропуски в
  тексте (те же квадратные скобки) и вопросы с вариантами;
* ``write`` – свободный ответ (проверяет преподаватель);
* ``video`` – видео VK, YouTube или Rutube.

Ученику уходит вид без ответов; ответы проверяет сервер.
"""

from __future__ import annotations

import json
import random
import re
from typing import Any

from .learning import video_embed
from .portal import PortalError, normalize_answer
from .vocabulary import parse_item

GAP_RE = re.compile(r"\[([^\[\]\n]{1,80})\]")
BLOCK_TYPES = ("text", "words", "gap", "match", "choice", "listening", "write", "video")
MAX_BLOCKS = 30
FILE_URL_RE = re.compile(r"^/site/v1/files/[0-9a-f]{24}$")


def _s(value: Any, limit: int) -> str:
    return str(value or "").strip()[:limit]


def _questions(raw: Any) -> list[dict[str, Any]]:
    out = []
    for q in (raw or [])[:30]:
        if not isinstance(q, dict):
            continue
        options = [_s(o, 200) for o in (q.get("options") or [])[:6] if _s(o, 200)]
        answer = q.get("answer")
        if isinstance(answer, str) and answer in options:
            answer = options.index(answer)
        if len(options) < 2 or not isinstance(answer, int) or isinstance(answer, bool) or not 0 <= answer < len(options):
            continue
        out.append({"q": _s(q.get("q") or q.get("question"), 300), "options": options, "answer": answer,
                    "explain": _s(q.get("explain"), 300) or None})
    return out


def validate_blocks(raw: Any) -> list[dict[str, Any]]:
    """Очищает блоки занятия; непонятные и пустые блоки отбрасываются."""
    if not isinstance(raw, list):
        raise PortalError(400, "blocks – список блоков")
    blocks: list[dict[str, Any]] = []
    for b in raw[:MAX_BLOCKS]:
        if not isinstance(b, dict) or b.get("type") not in BLOCK_TYPES:
            continue
        t = b["type"]
        block: dict[str, Any] = {"type": t, "title": _s(b.get("title"), 120)}
        if t == "text":
            block["body"] = _s(b.get("body"), 5000)
            ok = bool(block["body"])
        elif t == "words":
            items = []
            for w in (b.get("items") or [])[:60]:
                if isinstance(w, dict) and _s(w.get("word"), 80):
                    items.append({"word": _s(w["word"], 80), "translation": _s(w.get("translation"), 120) or None})
            block["items"] = items
            ok = bool(items)
        elif t == "gap":
            block["text"] = _s(b.get("text"), 5000)
            block["bank"] = bool(b.get("bank"))
            ok = bool(GAP_RE.search(block["text"]))
        elif t == "match":
            pairs = []
            for p in (b.get("pairs") or [])[:20]:
                if isinstance(p, (list, tuple)) and len(p) == 2 and _s(p[0], 150) and _s(p[1], 200):
                    pairs.append([_s(p[0], 150), _s(p[1], 200)])
            block["pairs"] = pairs
            ok = len(pairs) >= 2
        elif t == "choice":
            block["questions"] = _questions(b.get("questions"))
            ok = bool(block["questions"])
        elif t == "listening":
            block["script"] = _s(b.get("script"), 5000)
            block["lang"] = _s(b.get("lang"), 10) or "en-US"
            audio = _s(b.get("audio"), 80)
            block["audio"] = audio if FILE_URL_RE.match(audio) else None
            block["questions"] = _questions(b.get("questions"))
            ok = bool(block["script"] or block["audio"]) and (bool(GAP_RE.search(block["script"])) or
                                                             bool(block["questions"]))
        elif t == "write":
            block["prompt"] = _s(b.get("prompt"), 2000)
            ok = bool(block["prompt"])
        else:  # video
            url = _s(b.get("url"), 500)
            block["url"], block["embed"] = url, video_embed(url)
            ok = bool(block["embed"])
        if ok:
            blocks.append(block)
    if not blocks:
        raise PortalError(400, "в занятии нет ни одного заполненного задания")
    return blocks


def _gap_answers(text: str) -> list[list[str]]:
    return [[a.strip() for a in m.group(1).split("|") if a.strip()] for m in GAP_RE.finditer(text)]


def _gap_parts(text: str) -> list[str]:
    return GAP_RE.split(text)[::2]


def _shuffled(items: list[Any], seed: str) -> list[Any]:
    out = list(items)
    random.Random(seed).shuffle(out)
    return out


def student_view(unit: dict[str, Any]) -> dict[str, Any]:
    """Занятие без правильных ответов."""
    blocks = []
    for i, b in enumerate(unit["blocks"]):
        v: dict[str, Any] = {"type": b["type"], "title": b.get("title")}
        seed = f"{unit['id']}:{i}"
        if b["type"] in ("gap", "listening"):
            text = b.get("text") if b["type"] == "gap" else b.get("script")
            if text and GAP_RE.search(text):
                v["parts"] = _gap_parts(text)
                if b.get("bank"):
                    v["bank"] = _shuffled([a[0] for a in _gap_answers(text)], seed)
            if b["type"] == "listening":
                v["audio"] = b.get("audio")
                v["lang"] = b.get("lang")
                v["speak"] = GAP_RE.sub(lambda m: m.group(1).split("|")[0], b.get("script") or "")
                v["questions"] = [{"q": q["q"], "options": q["options"]} for q in b.get("questions", [])]
        elif b["type"] == "match":
            v["left"] = [p[0] for p in b["pairs"]]
            v["right"] = _shuffled([p[1] for p in b["pairs"]], seed)
        elif b["type"] == "choice":
            v["questions"] = [{"q": q["q"], "options": q["options"]} for q in b["questions"]]
        else:
            v.update({k: b[k] for k in ("body", "items", "prompt", "url", "embed") if k in b})
        blocks.append(v)
    return {"id": unit["id"], "title": unit["title"], "language": unit.get("language"), "level": unit.get("level"),
            "blocks": blocks}


def _choice_result(questions: list[dict[str, Any]], given: Any) -> tuple[list[bool], list[int]]:
    given = given if isinstance(given, list) else []
    ok = [i < len(given) and given[i] == q["answer"] for i, q in enumerate(questions)]
    return ok, [q["answer"] for q in questions]


def grade(unit: dict[str, Any], answers: Any) -> dict[str, Any]:
    """Проверка ответов. Возвращает по каждому блоку, что верно, и правильные ответы."""
    answers = answers if isinstance(answers, dict) else {}
    score = total = 0
    out: dict[str, Any] = {}
    for i, b in enumerate(unit["blocks"]):
        given = answers.get(str(i))
        res: dict[str, Any] = {}
        if b["type"] in ("gap", "listening"):
            text = b.get("text") if b["type"] == "gap" else b.get("script")
            if text and GAP_RE.search(text):
                correct = _gap_answers(text)
                g = given.get("gaps") if isinstance(given, dict) else given
                g = g if isinstance(g, list) else []
                res["gaps"] = [i2 < len(g) and isinstance(g[i2], str) and
                               normalize_answer(g[i2]) in {normalize_answer(a) for a in alts}
                               for i2, alts in enumerate(correct)]
                res["gap_answers"] = [alts[0] for alts in correct]
            if b["type"] == "listening" and b.get("questions"):
                g = given.get("questions") if isinstance(given, dict) else None
                res["questions"], res["question_answers"] = _choice_result(b["questions"], g)
                res["script"] = GAP_RE.sub(lambda m: m.group(1).split("|")[0], b.get("script") or "")
        elif b["type"] == "match":
            g = given if isinstance(given, list) else []
            res["pairs"] = [i2 < len(g) and isinstance(g[i2], str) and normalize_answer(g[i2]) == normalize_answer(p[1])
                            for i2, p in enumerate(b["pairs"])]
            res["pair_answers"] = [p[1] for p in b["pairs"]]
        elif b["type"] == "choice":
            res["questions"], res["question_answers"] = _choice_result(b["questions"], given)
        elif b["type"] == "write":
            res["text"] = _s(given, 3000) if isinstance(given, str) else ""
        marks = [x for k in ("gaps", "pairs", "questions") for x in res.get(k, [])]
        score += sum(marks)
        total += len(marks)
        if res:
            out[str(i)] = res
    return {"blocks": out, "score": score, "total": total, "answers": answers}


def unit_words(unit: dict[str, Any]) -> list[dict[str, Any]]:
    return [w for b in unit["blocks"] if b["type"] == "words" for w in b["items"]]


# == генератор без ИИ ===========================================================================

def parse_words(text: str) -> list[dict[str, Any]]:
    """«kitchen – кухня» по строкам (или через «;») → слова."""
    out, seen = [], set()
    for line in re.split(r"[\n;]+", text or ""):
        item = parse_item(line)
        if item and item.word.lower() not in seen:
            seen.add(item.word.lower())
            out.append({"word": item.word, "translation": item.translation})
    return out[:60]


def _bracket_words(text: str, words: list[str]) -> tuple[str, int]:
    """Берёт в скобки первое вхождение каждого слова из списка."""
    count = 0
    for w in sorted(words, key=len, reverse=True):
        rx = re.compile(rf"(?<![\w\[])({re.escape(w)})(?![\w\]])", re.IGNORECASE)
        text, n = rx.subn(lambda m: f"[{m.group(1)}]", text, count=1)
        count += n
    return text, count


def generate_offline(topic: str, words_text: str, text: str = "", language: str = "en") -> dict[str, Any]:
    """Занятие из слов и текста преподавателя – работает без ИИ и без интернета."""
    words = parse_words(words_text)
    if not words and not text.strip():
        raise PortalError(400, "добавьте слова (по одному в строке: «kitchen – кухня») или текст")
    lang = "zh-CN" if language == "zh" else "en-US"
    blocks: list[dict[str, Any]] = []
    if words:
        blocks.append({"type": "words", "title": "Новые слова", "items": words})
    translated = [w for w in words if w["translation"]]
    if len(translated) >= 2:
        blocks.append({"type": "match", "title": "Соедините слово и перевод",
                       "pairs": [[w["word"], w["translation"]] for w in translated[:12]]})
    if text.strip():
        gapped, n = _bracket_words(text.strip(), [w["word"] for w in words])
        if not n:  # слов из списка в тексте нет – просто текст для чтения
            blocks.append({"type": "text", "title": "Прочитайте текст", "body": text.strip()})
        else:  # полный текст не показываем отдельно – иначе ответы видны
            blocks.append({"type": "gap", "title": "Вставьте слова в текст", "text": gapped, "bank": True})
            blocks.append({"type": "listening", "title": "Аудирование: послушайте и впишите пропущенные слова",
                           "script": gapped, "lang": lang, "questions": []})
    elif translated:
        blocks.append({"type": "gap", "title": "Напишите слово по переводу",
                       "text": "\n".join(f"{w['translation']} – [{w['word']}]" for w in translated[:15])})
    if len(translated) >= 4:
        rnd = random.Random(topic + words_text)
        qs = []
        for w in translated[:10]:
            others = [x["translation"] for x in translated if x is not w]
            options = rnd.sample(others, min(3, len(others))) + [w["translation"]]
            rnd.shuffle(options)
            qs.append({"q": f"Как переводится «{w['word']}»?", "options": options, "answer": options.index(w["translation"])})
        blocks.append({"type": "choice", "title": "Тест: выберите перевод", "questions": qs})
        say = ". ".join(w["word"] for w in translated[:6])
        qs2 = []
        for w in translated[:6]:
            others = [x["word"] for x in translated if x is not w and x["word"] not in say] or \
                     [x["word"] for x in translated if x is not w]
            options = rnd.sample(others, min(2, len(others))) + [w["word"]]
            rnd.shuffle(options)
            qs2.append({"q": f"Какое слово значит «{w['translation']}»? Послушайте запись.", "options": options,
                        "answer": options.index(w["word"])})
        blocks.append({"type": "listening", "title": "Аудирование: слова на слух", "script": say, "lang": lang,
                       "questions": qs2})
    blocks.append({"type": "write", "title": "Напишите сами",
                   "prompt": f"Напишите 3–5 предложений на тему «{topic or 'урока'}», используя новые слова."})
    return {"title": topic or "Новое занятие", "language": language, "blocks": validate_blocks(blocks)}


# == генерация с ИИ ===============================================================================

AI_PROMPT = """Ты методист онлайн-школы языков. Составь интерактивное занятие.
Верни ТОЛЬКО JSON без пояснений, формат:
{"title": "...", "level": "A2", "blocks": [ ... ]}
Типы блоков:
- {"type":"text","title":"...","body":"текст или объяснение правила"}
- {"type":"words","title":"Новые слова","items":[{"word":"kitchen","translation":"кухня"}]}
- {"type":"gap","title":"...","text":"Текст, где правильный ответ в квадратных скобках: I [have] got a cat.","bank":true}
- {"type":"match","title":"...","pairs":[["word","определение или перевод"]]}
- {"type":"choice","title":"...","questions":[{"q":"вопрос","options":["a","b","c"],"answer":0}]}
- {"type":"listening","title":"...","script":"Текст для озвучки, пропуски в [скобках]","lang":"en-US","questions":[{"q":"...","options":["..."],"answer":1}]}
- {"type":"write","title":"...","prompt":"задание на письмо или говорение"}
Требования: 6–9 блоков, от простого к сложному; ответы однозначные; задания по-русски,
языковой материал – на изучаемом языке; для китайского добавляй пиньинь в скобках.
Никаких ссылок, телефонов и контактов."""


def ai_user_prompt(topic: str, language: str, level: str, words_text: str, extra: str) -> str:
    lang = {"en": "английский", "zh": "китайский"}.get(language, language or "английский")
    return (f"Изучаемый язык: {lang}. Уровень: {level or 'A2'}. Тема: {topic}.\n"
            + (f"Обязательно используй слова:\n{words_text}\n" if words_text.strip() else "")
            + (f"Пожелания преподавателя: {extra}\n" if extra.strip() else ""))


def parse_ai_json(text: str) -> dict[str, Any] | None:
    """Достаёт JSON из ответа модели (модели иногда оборачивают его в ```)."""
    if not text:
        return None
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(text[start:end + 1])
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


# == сервис занятий ==============================================================================

class Units:
    """Занятия преподавателя и школы: свои, из библиотеки, созданные ИИ; выдача и проверка."""

    def __init__(self, learning: Any):
        from .ai import AIClient

        self.learning = learning
        self.portal = learning.portal
        self.storage = learning.storage
        self.ai = AIClient(self.portal.settings)

    def _owner(self, viewer: Any) -> dict[str, Any]:
        return self.learning._material_owner(viewer)

    def _public(self, u: dict[str, Any], acc: dict[str, Any]) -> dict[str, Any]:
        kinds: dict[str, int] = {}
        for b in u["blocks"]:
            kinds[b["type"]] = kinds.get(b["type"], 0) + 1
        return {**{k: u[k] for k in ("id", "title", "language", "level", "source", "created_at", "updated_at")},
                "blocks": u["blocks"], "kinds": kinds, "mine": u["owner_id"] == acc["id"], "shared": bool(u.get("org_id"))}

    def accessible(self, viewer: Any, unit_id: str) -> dict[str, Any]:
        acc = self._owner(viewer)
        u = self.storage.get_unit(unit_id)
        if not u or not (u["owner_id"] == acc["id"] or (u.get("org_id") and u["org_id"] == acc.get("org_id"))):
            raise PortalError(404, "занятие не найдено")
        return u

    def list(self, viewer: Any) -> dict[str, Any]:
        from .library import LIBRARY

        acc = self._owner(viewer)
        rows = self.storage.units_for(acc["id"], acc.get("org_id"))
        return {"units": [self._public(u, acc) for u in rows],
                "library": [{k: u[k] for k in ("id", "title", "language", "level", "tags")} | {"blocks": u["blocks"]}
                            for u in LIBRARY],
                "ai": self.ai.provider}

    def get(self, viewer: Any, unit_id: str) -> dict[str, Any]:
        return self._public(self.accessible(viewer, unit_id), self._owner(viewer))

    def save(self, viewer: Any, body: Any, unit_id: str | None = None) -> dict[str, Any]:
        import secrets

        acc = self._owner(viewer)
        if not isinstance(body, dict):
            raise PortalError(400, "нужен JSON-объект")
        from .billing import require_active

        require_active(self.storage, acc["id"])
        if unit_id:
            u = self.accessible(viewer, unit_id)
            if u["owner_id"] != acc["id"] and acc["role"] != "school":
                raise PortalError(403, "это занятие школы – скопируйте его к себе, чтобы изменить")
        title = _s(body.get("title"), 120) or "Занятие"
        blocks = validate_blocks(body.get("blocks"))
        shared = acc["role"] == "school" or (bool(body.get("shared")) and acc.get("org_id"))
        row = self.storage.save_unit(unit_id or secrets.token_hex(8), acc["id"], acc.get("org_id") if shared else None,
                                     title, _s(body.get("language"), 10) or None, _s(body.get("level"), 20) or None,
                                     blocks, _s(body.get("source"), 20) or "own")
        return self._public(row, acc)

    def copy_library(self, viewer: Any, lib_id: str) -> dict[str, Any]:
        from .library import library_unit

        u = library_unit(lib_id)
        if not u:
            raise PortalError(404, "занятие не найдено")
        return self.save(viewer, {**u, "source": "library"})

    def delete(self, viewer: Any, unit_id: str) -> dict[str, Any]:
        acc = self._owner(viewer)
        u = self.accessible(viewer, unit_id)
        if u["owner_id"] != acc["id"] and acc["role"] != "school":
            raise PortalError(403, "удалить можно только своё занятие")
        self.storage.delete_unit(unit_id)
        return {"ok": True}

    def generate(self, viewer: Any, body: Any) -> dict[str, Any]:
        """Черновик занятия: ИИ, если подключён, иначе – из слов и текста преподавателя. Не сохраняется."""
        self._owner(viewer)
        body = body if isinstance(body, dict) else {}
        topic = _s(body.get("topic"), 200)
        language = _s(body.get("language"), 10) or "en"
        words_text, text, extra = _s(body.get("words"), 3000), _s(body.get("text"), 5000), _s(body.get("wishes"), 1000)
        level = _s(body.get("level"), 20)
        if body.get("mode") != "offline" and self.ai.provider:
            if not topic:
                raise PortalError(400, "укажите тему занятия")
            answer = self.ai.complete(AI_PROMPT, ai_user_prompt(topic, language, level, words_text, extra)
                                      + (f"Используй этот текст:\n{text}\n" if text else ""),
                                      timeout=min(self.portal.settings.ai_timeout, 300))  # преподаватель ждёт ответа
            data = parse_ai_json(answer or "")
            if data:
                try:
                    return {"title": _s(data.get("title"), 120) or topic, "language": language,
                            "level": _s(data.get("level"), 20) or level, "blocks": validate_blocks(data.get("blocks")),
                            "generated_by": "ai"}
                except PortalError:
                    pass
            if not (words_text or text):
                raise PortalError(502, "ИИ не ответил" + (f": {self.ai.last_error}" if self.ai.last_error else "")
                                  + ". Добавьте слова или текст – соберу занятие без ИИ.")
        draft = generate_offline(topic, words_text, text, language)
        return {**draft, "level": level, "generated_by": "offline",
                "notice": "Собрано без ИИ из ваших слов и текста." if self.ai.provider is None else
                "ИИ не ответил – собрано из ваших слов и текста."}

    def from_lesson(self, viewer: Any, lesson_id: str, body: Any) -> dict[str, Any]:
        """Упражнения по пройденной теме: слова и тема урока превращаются в занятие, которое можно сразу выдать ученику."""
        lesson = self.storage.get_lesson(lesson_id)
        if not lesson or not lesson.get("chat_id"):
            raise PortalError(404, "урок не найден")
        access = self.portal._access(viewer, lesson["chat_id"])
        if access.role != "tutor":
            raise PortalError(403, "упражнения по уроку делает преподаватель")
        report = self.storage.get_report(lesson_id)
        if report is None:
            raise PortalError(404, "конспекта урока ещё нет")
        body = body if isinstance(body, dict) else {}
        words_text = "\n".join(f"{w.word} – {w.translation}" if w.translation else w.word for w in report.vocabulary)
        topic = report.topic or lesson.get("title") or "Пройденная тема"
        language = self.storage.chat_language(lesson["chat_id"]) or self.portal.settings.target_language
        wishes = "Закрепи тему урока. Ключевые мысли: " + "; ".join(report.key_points[:6]) if report.key_points else ""
        if not words_text and not (self.ai.provider and report.key_points):
            raise PortalError(400, "в конспекте нет слов для упражнений: добавьте их в поле «Слова урока»")
        draft = self.generate(viewer, {"topic": topic, "language": language, "words": words_text, "wishes": wishes})
        unit = self.save(viewer, {"title": f"Закрепление: {topic}"[:120], "language": language, "level": draft.get("level"),
                                  "blocks": draft["blocks"], "source": "lesson"})
        assigned = None
        if body.get("assign"):
            assigned = self.learning.assign(viewer, {"chat_id": lesson["chat_id"], "unit_id": unit["id"],
                                                    "text": f"Выполните упражнения по теме «{topic}»"})
        return {"unit_id": unit["id"], "title": unit["title"], "generated_by": draft.get("generated_by"),
                "assigned": assigned is not None, "assignment_id": assigned["id"] if assigned else None}

    def check(self, viewer: Any, unit_id: str, body: Any) -> dict[str, Any]:
        """Проверка в режиме предпросмотра (для преподавателя) – ничего не сохраняет."""
        return grade(self.accessible(viewer, unit_id), (body or {}).get("answers") if isinstance(body, dict) else None)

    # -- занятие в домашнем задании ----------------------------------------------------------------
    def _homework_unit(self, viewer: Any, assignment_id: int) -> tuple[dict[str, Any], dict[str, Any], Any]:
        row, access = self.learning._assignment_access(viewer, assignment_id)
        unit = self.storage.get_unit(row["unit_id"]) if row.get("unit_id") else None
        if not unit:
            raise PortalError(404, "в задании нет занятия")
        return row, unit, access

    def homework_unit(self, viewer: Any, assignment_id: int) -> dict[str, Any]:
        row, unit, access = self._homework_unit(viewer, assignment_id)
        return {"unit": student_view(unit), "result": row.get("result"), "role": access.role, "status": row["status"]}

    def submit(self, viewer: Any, assignment_id: int, body: Any) -> dict[str, Any]:
        from datetime import datetime, timezone

        from .relay import STUDENT

        row, unit, access = self._homework_unit(viewer, assignment_id)
        if access.role != STUDENT:
            raise PortalError(403, "занятие выполняет ученик")
        if row["status"] == "checked":
            raise PortalError(409, "преподаватель уже проверил задание")
        result = grade(unit, body.get("answers") if isinstance(body, dict) else None)
        self.learning._check_text(row["chat_id"], *[r.get("text") for r in result["blocks"].values()])
        self.storage.update_assignment(assignment_id, result=result, status="done",
                                       done_at=datetime.now(timezone.utc).isoformat(timespec="seconds"))
        if row["status"] != "done":
            self.portal.telegram(access.pair.tutor_user_id, f"✅ {access.pair.student_alias} выполнил занятие "
                                 f"«{unit['title']}»: {result['score']} из {result['total']}")
        return result
