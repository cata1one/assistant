"""Сайт школы: страницы и JSON для них. Раздаётся тем же сервером, что и HTTP API.

Публично:
    GET  /                                  сайт (одностраничное приложение из папки web/)
    GET  /static/<файл>
    GET  /site/v1/catalog                   направления и курсы
    POST /site/v1/applications              заявка на пробный урок

Личный кабинет (заголовок ``X-Access-Token`` — токен из ссылки, которую выдаёт бот по /cabinet):
    GET  /site/v1/me                        пары, уроки, роль в каждой паре
    POST /site/v1/logout                    отозвать все ссылки этого человека
    GET  /site/v1/lessons/{id}              материалы урока в вашей роли
    POST /site/v1/lessons/{id}/test         {"answers": [...]} — проверка теста
    GET  /site/v1/words                     ?chat_id= — словарь
    GET  /site/v1/boards                    доски ваших пар
    POST /site/v1/boards                    {"chat_id", "title"}
    GET  /site/v1/boards/{id}/items         ?since=<id> — новые элементы (опрос раз в 1–2 секунды)
    POST /site/v1/boards/{id}/items         {"kind", "data"} — текст на доске проверяется на контакты
    GET  /site/v1/admin/applications        ?status= (администраторы)
    POST /site/v1/admin/applications/{id}   {"status"}
    POST /site/v1/admin/classroom           {"chat_id", "url"} — ссылка на класс ProgressMe
"""

from __future__ import annotations

import json
import mimetypes
import re
from http import HTTPStatus
from pathlib import Path
from typing import Any

from . import catalog
from .portal import Portal, PortalError

WEB_DIR = Path(__file__).with_name("web")
MAX_SITE_BODY = 1024 * 1024
STATIC_RE = re.compile(r"^/static/([\w.-]+)$")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": ("default-src 'self'; img-src 'self' data: blob:; style-src 'self'; "
                                "script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; "
                                "form-action 'self'"),
}


class Response:
    def __init__(self, status: HTTPStatus | int, body: bytes, content_type: str, headers: dict[str, str] | None = None):
        self.status = HTTPStatus(status)
        self.body = body
        self.content_type = content_type
        self.headers = {**SECURITY_HEADERS, **(headers or {})}


def json_response(status: HTTPStatus | int, payload: Any) -> Response:
    return Response(status, json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8"),
                    "application/json; charset=utf-8", {"Cache-Control": "no-store"})


class Website:
    ROUTES = [
        ("GET", re.compile(r"^/site/v1/catalog$"), "catalog", False),
        ("POST", re.compile(r"^/site/v1/applications$"), "apply", False),
        ("GET", re.compile(r"^/site/v1/me$"), "me", True),
        ("POST", re.compile(r"^/site/v1/logout$"), "logout", True),
        ("GET", re.compile(r"^/site/v1/lessons/(?P<id>[\w-]+)$"), "lesson", True),
        ("POST", re.compile(r"^/site/v1/lessons/(?P<id>[\w-]+)/test$"), "test", True),
        ("GET", re.compile(r"^/site/v1/words$"), "words", True),
        ("GET", re.compile(r"^/site/v1/boards$"), "boards", True),
        ("POST", re.compile(r"^/site/v1/boards$"), "create_board", True),
        ("GET", re.compile(r"^/site/v1/boards/(?P<id>[0-9a-f]+)/items$"), "board_items", True),
        ("POST", re.compile(r"^/site/v1/boards/(?P<id>[0-9a-f]+)/items$"), "add_board_item", True),
        ("GET", re.compile(r"^/site/v1/admin/applications$"), "applications", True),
        ("POST", re.compile(r"^/site/v1/admin/applications/(?P<id>\d+)$"), "application_status", True),
        ("POST", re.compile(r"^/site/v1/admin/classroom$"), "classroom", True),
    ]

    def __init__(self, portal: Portal, web_dir: Path = WEB_DIR):
        self.portal = portal
        self.web_dir = web_dir

    @staticmethod
    def handles(path: str) -> bool:
        return path in ("/", "/index.html", "/robots.txt", "/favicon.ico") or path.startswith(("/static/", "/site/"))

    def handle(self, method: str, path: str, query: dict[str, str], raw: bytes, headers: Any,
               ip: str | None) -> Response:
        if not path.startswith("/site/"):
            if method not in ("GET", "HEAD"):
                return json_response(HTTPStatus.METHOD_NOT_ALLOWED, {"error": "метод не поддерживается"})
            return self.static(path)
        try:
            body: Any = {}
            if method == "POST" and raw:
                try:
                    body = json.loads(raw.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    raise PortalError(400, "тело запроса должно быть JSON") from None
            allowed = False
            for m, rx, name, private in self.ROUTES:
                match = rx.match(path)
                if not match:
                    continue
                allowed = True
                if m != method:
                    continue
                kwargs: dict[str, Any] = {"body": body, "query": query, "ip": ip, **match.groupdict()}
                if private:
                    kwargs["viewer"] = self.portal.viewer(headers.get("X-Access-Token"))
                return json_response(HTTPStatus.OK, getattr(self, name)(**kwargs))
            if allowed:
                raise PortalError(405, "метод не поддерживается")
            raise PortalError(404, "не найдено")
        except PortalError as exc:
            return json_response(exc.status, {"error": exc.message})

    # -- статика -------------------------------------------------------------
    def static(self, path: str) -> Response:
        if path == "/robots.txt":
            return Response(200, b"User-agent: *\nDisallow: /site/\n", "text/plain; charset=utf-8")
        if path in ("/", "/index.html"):
            name = "index.html"
        elif path == "/favicon.ico":
            name = "favicon.svg"
        else:
            m = STATIC_RE.match(path)
            if not m:
                return json_response(404, {"error": "не найдено"})
            name = m.group(1)
        file = (self.web_dir / name).resolve()
        if file.parent != self.web_dir.resolve() or not file.is_file():
            return json_response(404, {"error": "не найдено"})
        ctype = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "image/svg+xml"):
            ctype += "; charset=utf-8"
        cache = "no-cache" if name == "index.html" else "public, max-age=300"
        return Response(200, file.read_bytes(), ctype, {"Cache-Control": cache})

    # -- обработчики -------------------------------------------------------------
    def catalog(self, **_: Any) -> Any:
        return catalog.catalog(self.portal.settings)

    def apply(self, body: Any, ip: str | None, **_: Any) -> Any:
        return self.portal.submit_application(body, ip)

    def me(self, viewer: Any, **_: Any) -> Any:
        return self.portal.me(viewer)

    def logout(self, viewer: Any, **_: Any) -> Any:
        self.portal.logout(viewer)
        return {"ok": True}

    def lesson(self, viewer: Any, id: str, **_: Any) -> Any:
        return self.portal.lesson(viewer, id)

    def test(self, viewer: Any, id: str, body: Any, **_: Any) -> Any:
        return self.portal.check_test(viewer, id, body.get("answers") if isinstance(body, dict) else None)

    def words(self, viewer: Any, query: dict[str, str], **_: Any) -> Any:
        return self.portal.words(viewer, query.get("chat_id") or None)

    def boards(self, viewer: Any, **_: Any) -> Any:
        return self.portal.boards(viewer)

    def create_board(self, viewer: Any, body: Any, **_: Any) -> Any:
        if not isinstance(body, dict) or not isinstance(body.get("chat_id"), str):
            raise PortalError(400, "нужно поле chat_id")
        title = body.get("title") if isinstance(body.get("title"), str) else None
        return self.portal.create_board(viewer, body["chat_id"], title)

    def board_items(self, viewer: Any, id: str, query: dict[str, str], **_: Any) -> Any:
        try:
            since = int(query.get("since", "0"))
        except ValueError:
            raise PortalError(400, "since должен быть числом") from None
        return self.portal.board_items(viewer, id, since)

    def add_board_item(self, viewer: Any, id: str, body: Any, **_: Any) -> Any:
        return self.portal.add_board_item(viewer, id, body)

    def applications(self, viewer: Any, query: dict[str, str], **_: Any) -> Any:
        return self.portal.applications(viewer, query.get("status") or None)

    def application_status(self, viewer: Any, id: str, body: Any, **_: Any) -> Any:
        return self.portal.set_application_status(viewer, int(id), body.get("status") if isinstance(body, dict)
                                                  else None)

    def classroom(self, viewer: Any, body: Any, **_: Any) -> Any:
        if not isinstance(body, dict) or not isinstance(body.get("chat_id"), str):
            raise PortalError(400, "нужно поле chat_id")
        url = body.get("url")
        if url is not None and not isinstance(url, str):
            raise PortalError(400, "url должен быть строкой")
        return self.portal.admin_set_classroom(viewer, body["chat_id"], url or None)
