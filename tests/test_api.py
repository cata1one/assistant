import json
import threading
import urllib.error
import urllib.request
from http import HTTPStatus
from http.server import ThreadingHTTPServer

import pytest

from tutor_assistant.api import Api, ApiError, make_handler
from tutor_assistant.config import Settings
from tutor_assistant.service import LessonNotFound, TutorAssistant
from tutor_assistant.storage import Storage


@pytest.fixture
def api():
    settings = Settings(llm_mode="off", api_token="secret")
    return Api(TutorAssistant(settings, Storage(":memory:")))


AUTH = "Bearer secret"


def call(api, method, path, body=None, query=None, auth=AUTH):
    return api.dispatch(method, path, query or {}, body or {}, auth)


def test_auth_required(api):
    with pytest.raises(ApiError) as e:
        call(api, "POST", "/v1/moderate", {"text": "hi"}, auth=None)
    assert e.value.status == HTTPStatus.UNAUTHORIZED
    with pytest.raises(ApiError):
        call(api, "POST", "/v1/moderate", {"text": "hi"}, auth="Bearer wrong")
    assert call(api, "GET", "/health", auth=None)[0] == HTTPStatus.OK


def test_moderate(api):
    status, data = call(api, "POST", "/v1/moderate", {"text": "мой номер 89001234567"})
    assert status == HTTPStatus.OK and data["action"] == "block" and "[скрыто]" in data["redacted_text"]
    with pytest.raises(ApiError) as e:
        call(api, "POST", "/v1/moderate", {"text": ""})
    assert e.value.status == HTTPStatus.BAD_REQUEST


def test_lesson_lifecycle(api):
    status, lesson = call(api, "POST", "/v1/lessons", {"tutor_id": "t", "student_id": 7, "title": "Урок"})
    assert status == HTTPStatus.CREATED and lesson["student_id"] == "7"
    lid = lesson["id"]
    _, out = call(api, "POST", f"/v1/lessons/{lid}/messages",
                  {"speaker_id": "t", "role": "tutor", "text": "Новые слова сегодня: cat — кошка, dog — собака"})
    assert [w["word"] for w in out["new_words"]] == ["cat", "dog"]
    _, out = call(api, "POST", f"/v1/lessons/{lid}/messages",
                  {"speaker_id": "7", "role": "student", "text": "пиши мне в вотсап", "message_id": "m5"})
    assert out["moderation"]["action"] == "block" and out["incident_id"]

    _, report = call(api, "POST", f"/v1/lessons/{lid}/finish")
    assert [v["word"] for v in report["vocabulary"]] == ["cat", "dog"]
    _, again = call(api, "POST", f"/v1/lessons/{lid}/finish")  # повторный вызов идемпотентен
    assert again["vocabulary"] == report["vocabulary"]
    with pytest.raises(ApiError) as e:
        call(api, "POST", f"/v1/lessons/{lid}/messages", {"text": "hi"})
    assert e.value.status == HTTPStatus.CONFLICT

    assert "Конспект" in call(api, "GET", f"/v1/lessons/{lid}/report", query={"format": ["text"]})[1]["text"]
    assert call(api, "GET", f"/v1/lessons/{lid}/report", query={"format": ["markdown"]})[1]["markdown"].startswith("#")
    _, words = call(api, "GET", "/v1/students/7/words", query={"date": ["today"]})
    assert words["count"] == 2
    _, inc = call(api, "GET", "/v1/incidents", query={"lesson_id": [lid]})
    assert inc["count"] == 1


def test_errors(api):
    with pytest.raises(LessonNotFound):
        call(api, "GET", "/v1/lessons/unknown")
    with pytest.raises(ApiError) as e:
        call(api, "GET", "/v1/nothing")
    assert e.value.status == HTTPStatus.NOT_FOUND
    with pytest.raises(ApiError) as e:
        call(api, "GET", "/v1/moderate")
    assert e.value.status == HTTPStatus.METHOD_NOT_ALLOWED
    with pytest.raises(ApiError):
        call(api, "GET", "/v1/students/1/words", query={"date": ["31-12-2020"]})


def test_analyze(api, sample_lesson):
    _, data = call(api, "POST", "/v1/analyze", {"transcript": sample_lesson, "use_llm": False})
    assert data["report"]["vocabulary"] and len(data["violations"]) == 3


def test_real_http_server(api):
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(api))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        def request(method, path, body=None, auth=AUTH, raw=None):
            data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
            req = urllib.request.Request(base + path, data=data, method=method)
            req.add_header("Content-Type", "application/json")
            if auth:
                req.add_header("Authorization", auth)
            try:
                with urllib.request.urlopen(req, timeout=5) as resp:
                    return resp.status, json.loads(resp.read())
            except urllib.error.HTTPError as err:
                return err.code, json.loads(err.read())

        assert request("GET", "/health", auth=None)[0] == 200
        status, data = request("POST", "/v1/moderate", {"text": "ivan собака gmail точка com"})
        assert status == 200 and data["action"] == "block"
        assert request("POST", "/v1/moderate", raw=b"{not json")[0] == 400
        assert request("POST", "/v1/moderate", raw=b"[1,2]")[0] == 400
        assert request("GET", "/v1/lessons/zzz")[0] == 404
        assert request("POST", "/v1/moderate", {"text": "x"}, auth=None)[0] == 401
    finally:
        server.shutdown()
        server.server_close()
