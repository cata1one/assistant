import json
import threading
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO

from tutor_assistant.ai import AIClient
from tutor_assistant.config import Settings


def test_spark_parallel_setting_is_bounded(monkeypatch):
    monkeypatch.setenv("TUTOR_AI_SPARK_PARALLEL", "4")
    assert Settings.from_env().ai_spark_parallel == 4
    monkeypatch.setenv("TUTOR_AI_SPARK_PARALLEL", "100")
    assert Settings.from_env().ai_spark_parallel == 16
    monkeypatch.setenv("TUTOR_AI_SPARK_PARALLEL", "0")
    assert Settings.from_env().ai_spark_parallel == 1


def test_concurrent_ai_requests_keep_own_timeout(monkeypatch):
    barrier = threading.Barrier(2)
    calls = []

    def fake_open(request, timeout):
        barrier.wait(timeout=5)
        calls.append((json.loads(request.data), timeout))
        return BytesIO(b'{"choices":[{"message":{"content":"ok"}}]}')

    monkeypatch.setattr("urllib.request.urlopen", fake_open)
    client = AIClient(Settings(ai_url="https://example.test/v1", ai_model="test"))
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(client.complete, "system", "first", 10),
                   executor.submit(client.chat, "system", [{"role": "user", "content": "second"}], 25)]
        assert [future.result(timeout=10) for future in futures] == ["ok", "ok"]
    assert sorted(timeout for _, timeout in calls) == [10, 25]


def test_cloudflare_openai_compatible_request_keeps_key_server_side(monkeypatch):
    calls = []

    def fake_open(request, timeout):
        calls.append((request.full_url, request.get_header("Authorization"), json.loads(request.data), timeout))
        return BytesIO(b'{"choices":[{"message":{"content":"Hello"}}]}')

    monkeypatch.setattr("urllib.request.urlopen", fake_open)
    client = AIClient(Settings(ai_url="https://api.cloudflare.com/client/v4/accounts/example/ai/v1",
                               ai_key="test-secret", ai_model="@cf/meta/llama-3.3-70b-instruct-fp8-fast"))
    assert client.chat("system", [{"role": "user", "content": "Hi"}], timeout=30) == "Hello"
    url, auth, body, timeout = calls[0]
    assert url.endswith("/ai/v1/chat/completions") and auth == "Bearer test-secret"
    assert body["model"].startswith("@cf/") and body["max_tokens"] == 800
    assert "test-secret" not in json.dumps(body) and timeout == 30


def test_cloudflare_error_does_not_expose_provider_response(monkeypatch):
    def fake_open(request, timeout):
        raise urllib.error.HTTPError(request.full_url, 429, "quota", {}, BytesIO(b"secret-provider-details"))

    monkeypatch.setattr("urllib.request.urlopen", fake_open)
    client = AIClient(Settings(ai_url="https://example.test/v1", ai_key="test-secret", ai_model="test"))
    assert client.chat("system", [{"role": "user", "content": "Hi"}]) is None
    assert "429" in client.last_error and "secret" not in client.last_error
