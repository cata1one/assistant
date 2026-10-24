"""HTTP API для интеграции с платформой онлайн-школы (только стандартная библиотека).

Эндпоинты (JSON):

    GET  /health
    POST /v1/moderate                      {"text": "..."}
    POST /v1/lessons                       {"chat_id", "tutor_id", "tutor_name", "student_id", "student_name", "title"}
    GET  /v1/lessons/{id}
    POST /v1/lessons/{id}/messages         {"speaker_id", "speaker_name", "role", "text"}
    POST /v1/lessons/{id}/finish           {"use_llm": true}
    GET  /v1/lessons/{id}/report           ?format=json|text|markdown|student|parent|parent_markdown
    POST /v1/lessons/{id}/notes            {"text", "author_id", "author_name"} – заметка преподавателя для родителей
    POST /v1/analyze                       {"transcript", "title", "student_id", "use_llm", "save"}
    GET  /v1/students/{id}/words           ?date=today|YYYY-MM-DD
    GET  /v1/incidents                     ?lesson_id=&user_id=&limit=
    POST /v1/lessons/{id}/audio            тело – аудио (wav/ogg/webm/mp3/m4a), ?speaker_id=&speaker_name=&role=
    POST /v1/analyze/audio                 тело – запись урока целиком, ?title=&student_id=&use_llm=&save=

Авторизация: заголовок ``Authorization: Bearer <TUTOR_API_TOKEN>``.
"""

from __future__ import annotations

import hmac
import json
import logging
import re
import threading
from datetime import date, datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from . import render
from .config import Settings
from .portal import Portal, send_telegram_async
from .service import LessonNotFound, TutorAssistant
from .website import MAX_ROOM_AUDIO, MAX_SITE_BODY, Website

log = logging.getLogger(__name__)

MAX_BODY = 5 * 1024 * 1024
MAX_AUDIO_BODY = 300 * 1024 * 1024  # запись урока целиком
AUDIO_PATH_RE = re.compile(r"^/v1/(?:lessons/[\w-]+/audio|analyze/audio)$")


class ApiError(Exception):
    def __init__(self, status: HTTPStatus, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _require_text(body: dict[str, Any], key: str, max_len: int = 1_000_000) -> str:
    value = body.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ApiError(HTTPStatus.BAD_REQUEST, f"поле «{key}» обязательно и должно быть непустой строкой")
    if len(value) > max_len:
        raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, f"поле «{key}» слишком длинное")
    return value


def _opt_str(body: dict[str, Any], key: str) -> str | None:
    value = body.get(key)
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    if not isinstance(value, str):
        raise ApiError(HTTPStatus.BAD_REQUEST, f"поле «{key}» должно быть строкой")
    return value.strip() or None


class Api:
    """Маршрутизация без привязки к HTTP-серверу – удобно тестировать."""

    ROUTES = [
        ("GET", re.compile(r"^/health$"), "health"),
        ("POST", re.compile(r"^/v1/moderate$"), "moderate"),
        ("POST", re.compile(r"^/v1/lessons$"), "create_lesson"),
        ("GET", re.compile(r"^/v1/lessons/(?P<id>[\w-]+)$"), "get_lesson"),
        ("POST", re.compile(r"^/v1/lessons/(?P<id>[\w-]+)/messages$"), "add_message"),
        ("POST", re.compile(r"^/v1/lessons/(?P<id>[\w-]+)/finish$"), "finish"),
        ("GET", re.compile(r"^/v1/lessons/(?P<id>[\w-]+)/report$"), "report"),
        ("POST", re.compile(r"^/v1/lessons/(?P<id>[\w-]+)/notes$"), "add_note"),
        ("POST", re.compile(r"^/v1/analyze$"), "analyze"),
        ("GET", re.compile(r"^/v1/students/(?P<id>[\w:.@-]+)/words$"), "words"),
        ("GET", re.compile(r"^/v1/incidents$"), "incidents"),
        ("POST", re.compile(r"^/v1/lessons/(?P<id>[\w-]+)/audio$"), "lesson_audio"),
        ("POST", re.compile(r"^/v1/analyze/audio$"), "analyze_audio"),
    ]

    def __init__(self, assistant: TutorAssistant):
        self.assistant = assistant
        self.token = assistant.settings.api_token

    def authorized(self, header: str | None) -> bool:
        if not self.token:
            return True
        if not header or not header.startswith("Bearer "):
            return False
        return hmac.compare_digest(header[7:].strip(), self.token)

    def dispatch(self, method: str, path: str, query: dict[str, list[str]], body: dict[str, Any],
                 auth: str | None, raw: bytes | None = None) -> tuple[HTTPStatus, Any]:
        if path != "/health" and not self.authorized(auth):
            raise ApiError(HTTPStatus.UNAUTHORIZED, "нужен заголовок Authorization: Bearer <токен>")
        allowed_methods = []
        for m, rx, name in self.ROUTES:
            match = rx.match(path)
            if not match:
                continue
            allowed_methods.append(m)
            if m == method:
                q = {k: v[-1] for k, v in query.items()}
                return getattr(self, name)(body=body, query=q, raw=raw, **match.groupdict())
        if allowed_methods:
            raise ApiError(HTTPStatus.METHOD_NOT_ALLOWED, "метод не поддерживается")
        raise ApiError(HTTPStatus.NOT_FOUND, "не найдено")

    # -- обработчики ----------------------------------------------------------
    def health(self, **_: Any) -> tuple[HTTPStatus, Any]:
        return HTTPStatus.OK, {"status": "ok", "llm": self.assistant.llm.available,
                               "speech": self.assistant.speech_available}

    def moderate(self, body: dict[str, Any], **_: Any) -> tuple[HTTPStatus, Any]:
        return HTTPStatus.OK, self.assistant.moderate(_require_text(body, "text", 100_000)).to_dict()

    def create_lesson(self, body: dict[str, Any], **_: Any) -> tuple[HTTPStatus, Any]:
        lesson = self.assistant.start_lesson(
            chat_id=_opt_str(body, "chat_id"), tutor_id=_opt_str(body, "tutor_id"), tutor_name=_opt_str(body, "tutor_name"),
            student_id=_opt_str(body, "student_id"), student_name=_opt_str(body, "student_name"),
            title=_opt_str(body, "title"),
            require_recording=bool(body["require_recording"]) if "require_recording" in body else None)
        return HTTPStatus.CREATED, self._with_recording(lesson)

    def _with_recording(self, lesson: dict[str, Any]) -> dict[str, Any]:
        return {**lesson, "recording": {**self.assistant.recording_status(lesson["id"]),
                                        "upload_url": f"/v1/lessons/{lesson['id']}/audio",
                                        "speech_available": self.assistant.speech_available}}

    def get_lesson(self, id: str, **_: Any) -> tuple[HTTPStatus, Any]:
        return HTTPStatus.OK, self._with_recording(self.assistant.lesson(id))

    def lesson_audio(self, id: str, query: dict[str, str], raw: bytes | None, **_: Any) -> tuple[HTTPStatus, Any]:
        lesson = self.assistant.lesson(id)
        if lesson["status"] != "active":
            raise ApiError(HTTPStatus.CONFLICT, "урок уже завершён")
        if not raw:
            raise ApiError(HTTPStatus.BAD_REQUEST, "тело запроса должно содержать аудио")
        out = self.assistant.process_audio(id, query.get("speaker_id"), query.get("speaker_name"), raw,
                                           role=query.get("role"), recording=True)
        # Фрагмент принят и учтён в записи, даже если речь проверить не удалось (это видно по "checked": false).
        return HTTPStatus.OK, {**out.to_dict(), "recording": self.assistant.recording_status(id)}

    def analyze_audio(self, query: dict[str, str], raw: bytes | None, **_: Any) -> tuple[HTTPStatus, Any]:
        if not raw:
            raise ApiError(HTTPStatus.BAD_REQUEST, "тело запроса должно содержать аудиозапись урока")
        if not self.assistant.speech_available:
            raise ApiError(HTTPStatus.SERVICE_UNAVAILABLE, "распознавание речи не установлено на сервере")
        flag = lambda k, d: query.get(k, d).lower() in {"1", "true", "yes"}  # noqa: E731
        try:
            report, violations, transcript = self.assistant.analyze_audio(
                raw, title=query.get("title"), student_id=query.get("student_id"), use_llm=flag("use_llm", "true"),
                persist=flag("save", "false"))
        except RuntimeError as exc:
            raise ApiError(HTTPStatus.UNPROCESSABLE_ENTITY, str(exc)) from None
        return HTTPStatus.OK, {"report": report.model_dump(), "violations": violations,
                               "transcript": _redact_transcript(transcript, violations)}

    def add_message(self, id: str, body: dict[str, Any], **_: Any) -> tuple[HTTPStatus, Any]:
        lesson = self.assistant.lesson(id)
        if lesson["status"] != "active":
            raise ApiError(HTTPStatus.CONFLICT, "урок уже завершён")
        out = self.assistant.process_message(
            id, _opt_str(body, "speaker_id"), _opt_str(body, "speaker_name"), _require_text(body, "text", 100_000),
            role=_opt_str(body, "role"), ref=_opt_str(body, "message_id"))
        data = out.to_dict()
        data["moderation"]["related_message_ids"] = [r for r in out.moderation.related_refs]
        return HTTPStatus.OK, data

    def finish(self, id: str, body: dict[str, Any], **_: Any) -> tuple[HTTPStatus, Any]:
        lesson = self.assistant.lesson(id)
        if lesson["status"] != "active":
            report = self.assistant.storage.get_report(id)
            if report:
                return HTTPStatus.OK, report.model_dump()
        report = self.assistant.finish_lesson(id, use_llm=bool(body.get("use_llm", True)))
        return HTTPStatus.OK, report.model_dump()

    def report(self, id: str, query: dict[str, str], **_: Any) -> tuple[HTTPStatus, Any]:
        self.assistant.lesson(id)
        report = self.assistant.storage.get_report(id)
        if report is None:
            raise ApiError(HTTPStatus.NOT_FOUND, "отчёт появится после завершения урока")
        fmt = query.get("format", "json")
        if fmt == "text":
            return HTTPStatus.OK, {"text": render.render_report(report)}
        if fmt == "markdown":
            return HTTPStatus.OK, {"markdown": render.render_report_markdown(report)}
        if fmt == "student":
            return HTTPStatus.OK, {"text": render.render_student_report(report),
                                   "markdown": render.render_report_markdown(report)}
        if fmt == "parent":
            return HTTPStatus.OK, {"text": render.render_parent_report(report), "parent": report.parent.model_dump(),
                                   "progress": report.progress.model_dump() if report.progress else None}
        if fmt == "parent_markdown":
            return HTTPStatus.OK, {"markdown": render.render_parent_markdown(report)}
        if fmt != "json":
            raise ApiError(HTTPStatus.BAD_REQUEST, "format: json, text, markdown, student, parent или parent_markdown")
        return HTTPStatus.OK, report.model_dump()

    def add_note(self, id: str, body: dict[str, Any], **_: Any) -> tuple[HTTPStatus, Any]:
        lesson = self.assistant.lesson(id)
        if lesson["status"] != "active":
            raise ApiError(HTTPStatus.CONFLICT, "урок уже завершён")
        ok, result = self.assistant.add_note(id, _require_text(body, "text", 5000), _opt_str(body, "author_id"),
                                             _opt_str(body, "author_name"))
        status = HTTPStatus.CREATED if ok else HTTPStatus.UNPROCESSABLE_ENTITY
        return status, {"saved": ok, "moderation": result.to_dict(), "notes": self.assistant.lesson_notes(id)}

    def analyze(self, body: dict[str, Any], **_: Any) -> tuple[HTTPStatus, Any]:
        report, violations = self.assistant.analyze_transcript(
            _require_text(body, "transcript", 2_000_000), title=_opt_str(body, "title"),
            student_id=_opt_str(body, "student_id"), use_llm=bool(body.get("use_llm", True)),
            persist=bool(body.get("save", False)))
        return HTTPStatus.OK, {"report": report.model_dump(), "violations": violations}

    def words(self, id: str, query: dict[str, str], **_: Any) -> tuple[HTTPStatus, Any]:
        owner = f"student:{id}"
        day = query.get("date")
        if not day:
            words = self.assistant.storage.all_words(owner)
        else:
            try:
                d = datetime.now(self.assistant.settings.tz).date() if day == "today" else date.fromisoformat(day)
            except ValueError:
                raise ApiError(HTTPStatus.BAD_REQUEST, "date: today или YYYY-MM-DD") from None
            words = self.assistant.storage.words_on_day(owner, d, self.assistant.settings.tz)
        return HTTPStatus.OK, {"student_id": id, "count": len(words), "words": [w.model_dump() for w in words]}

    def incidents(self, query: dict[str, str], **_: Any) -> tuple[HTTPStatus, Any]:
        try:
            limit = max(1, min(500, int(query.get("limit", "50"))))
        except ValueError:
            raise ApiError(HTTPStatus.BAD_REQUEST, "limit должен быть числом") from None
        rows = self.assistant.storage.incidents(lesson_id=query.get("lesson_id"), user_id=query.get("user_id"),
                                                limit=limit)
        return HTTPStatus.OK, {"count": len(rows), "incidents": rows}


def _redact_transcript(transcript: str, violations: list[dict[str, Any]]) -> str:
    """Расшифровка для ответа API – без фрагментов с контактами."""
    lines = transcript.split("\n")
    for v in violations:
        for idx in [v["index"], *v.get("related_indexes", [])]:
            if 0 <= idx < len(lines) and v.get("action") == "block":
                prefix = lines[idx].split(": ", 1)[0]
                lines[idx] = f"{prefix}: {v['redacted_text'] if idx == v['index'] else '[скрыто]'}"
    return "\n".join(lines)


def make_handler(api: Api, website: Website | None = None) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        server_version = "TutorAssistant/1.0"

        def _client_ip(self) -> str:
            forwarded = self.headers.get("X-Forwarded-For")
            if forwarded and api.assistant.settings.trust_proxy:
                return forwarded.split(",")[0].strip()
            return self.client_address[0]

        def _site(self, method: str, path: str, query: str) -> None:
            raw = b""
            if method == "POST":
                length = int(self.headers.get("Content-Length") or 0)
                if length > (MAX_ROOM_AUDIO if Website.RAW_BODY_RE.match(path) else MAX_SITE_BODY):
                    self._send(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "слишком большой запрос"})
                    return
                raw = self.rfile.read(length) if length else b""
            q = {k: v[-1] for k, v in parse_qs(query).items()}
            resp = website.handle(method, path, q, raw, self.headers, self._client_ip())
            self.send_response(resp.status)
            self.send_header("Content-Type", resp.content_type)
            self.send_header("Content-Length", str(len(resp.body)))
            for k, v in resp.headers.items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(resp.body)

        def _send(self, status: HTTPStatus, payload: Any) -> None:
            data = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _handle(self, method: str) -> None:
            try:
                parsed = urlparse(self.path)
                if website is not None and Website.handles(parsed.path):
                    # «pair:…» в адресе браузер кодирует как pair%3A… – раскодируем до разбора маршрутов
                    self._site(method, unquote(parsed.path), parsed.query)
                    return
                body: dict[str, Any] = {}
                audio: bytes | None = None
                if method == "POST":
                    length = int(self.headers.get("Content-Length") or 0)
                    is_audio = bool(AUDIO_PATH_RE.match(parsed.path.rstrip("/")))
                    if length > (MAX_AUDIO_BODY if is_audio else MAX_BODY):
                        raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "слишком большой запрос")
                    raw = self.rfile.read(length) if length else b""
                    if is_audio:
                        audio = raw
                    elif raw:
                        try:
                            body = json.loads(raw.decode("utf-8"))
                        except (UnicodeDecodeError, json.JSONDecodeError):
                            raise ApiError(HTTPStatus.BAD_REQUEST, "тело запроса должно быть JSON в UTF-8") from None
                        if not isinstance(body, dict):
                            raise ApiError(HTTPStatus.BAD_REQUEST, "тело запроса должно быть JSON-объектом")
                status, payload = api.dispatch(method, parsed.path.rstrip("/") or "/", parse_qs(parsed.query), body,
                                               self.headers.get("Authorization"), raw=audio)
                self._send(status, payload)
            except ApiError as exc:
                self._send(exc.status, {"error": exc.message})
            except LessonNotFound:
                self._send(HTTPStatus.NOT_FOUND, {"error": "урок не найден"})
            except Exception:
                log.exception("Ошибка обработки запроса %s %s", method, self.path)
                self._send(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "внутренняя ошибка сервера"})

        def do_GET(self) -> None:  # noqa: N802
            self._handle("GET")

        def do_POST(self) -> None:  # noqa: N802
            self._handle("POST")

        def log_message(self, fmt: str, *args: Any) -> None:
            log.info("%s - %s", self.address_string(), fmt % args)

    return Handler


def make_server(assistant: TutorAssistant, host: str, port: int) -> ThreadingHTTPServer:
    """HTTP-сервер: сайт школы, личный кабинет и API платформы."""
    if not assistant.settings.api_token:
        log.warning("TUTOR_API_TOKEN не задан – API доступен без авторизации. Задайте токен перед запуском в сети.")
    return ThreadingHTTPServer((host, port), make_handler(Api(assistant), Website(Portal(assistant))))


def run_api(settings: Settings, host: str = "127.0.0.1", port: int = 8080) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    assistant = TutorAssistant(settings)
    if not assistant.speech_available:
        log.warning("Распознавание речи недоступно: %s", assistant.transcriber.last_error)
    server = make_server(assistant, host, port)
    stop = threading.Event()
    threading.Thread(target=recording_watchdog, args=(assistant, stop), daemon=True).start()
    log.info("Сайт и HTTP API запущены: http://%s:%s", host, port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        server.server_close()


def recording_watchdog(assistant: TutorAssistant, stop: threading.Event, interval: float = 15.0) -> None:
    """Фоновая проверка: на идущих уроках запись должна идти без долгих перерывов."""
    while not stop.wait(interval):
        try:
            for gap in assistant.check_recording_gaps():
                log.warning("Урок %s: %s", gap["lesson_id"], gap["summary"])
                st = assistant.settings
                if st.telegram_token and st.admin_chat_id:
                    send_telegram_async(st.telegram_token, st.admin_chat_id,
                                        f"🔴 Урок {gap['lesson_id']}: {gap['summary']}")
        except Exception:
            log.exception("Ошибка проверки записи уроков")
