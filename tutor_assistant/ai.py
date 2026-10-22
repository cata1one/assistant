"""ИИ для конструктора занятий.

Порядок: OpenAI-совместимый сервис из настроек (бесплатно — Ollama на своём сервере,
бесплатные модели OpenRouter, Groq) → Claude, если задан ключ Anthropic → нет ИИ
(тогда занятие собирается из слов и текста преподавателя без ИИ).
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

from .config import Settings

log = logging.getLogger(__name__)

try:  # необязательная зависимость
    import anthropic
except ImportError:  # pragma: no cover
    anthropic = None  # type: ignore[assignment]


class AIClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.last_error: str | None = None
        self._timeout = settings.ai_timeout

    @property
    def provider(self) -> str | None:
        s = self.settings
        if s.ai_url and s.ai_model:
            return "openai"
        if s.llm_enabled and anthropic is not None:
            return "claude"
        return None

    def complete(self, system: str, user: str, timeout: float | None = None) -> str | None:
        """Ответ модели текстом или None (ошибка — в last_error)."""
        self.last_error = None
        self._timeout = timeout or self.settings.ai_timeout
        try:
            if self.provider == "openai":
                return self._openai(system, user)
            if self.provider == "claude":
                return self._claude(system, user)
        except Exception as exc:  # сеть, лимиты, неверный ключ
            self.last_error = str(exc)[:300]
            log.warning("ИИ недоступен: %s", self.last_error)
        return None

    def _openai(self, system: str, user: str) -> str | None:
        s = self.settings
        body = json.dumps({"model": s.ai_model, "temperature": 0.4,
                           "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]})
        headers = {"Content-Type": "application/json"}
        if s.ai_key:
            headers["Authorization"] = f"Bearer {s.ai_key}"
        req = urllib.request.Request(f"{s.ai_url}/chat/completions", data=body.encode(), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as r:  # noqa: S310 — адрес задаёт администратор
                data = json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"сервис ИИ ответил {exc.code}: {exc.read()[:200].decode('utf-8', 'replace')}") from None
        return data["choices"][0]["message"]["content"]

    def _claude(self, system: str, user: str) -> str | None:
        client = anthropic.Anthropic(timeout=self._timeout, max_retries=1)
        msg = client.messages.create(model=self.settings.llm_model, max_tokens=8000, system=system,
                                     messages=[{"role": "user", "content": user}])
        return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
