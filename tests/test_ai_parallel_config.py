import json
import threading
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
