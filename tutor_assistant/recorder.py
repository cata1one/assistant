"""Запись занятия: звук записывается фрагментами и сразу отправляется на расшифровку и проверку.

Фрагмент (по умолчанию 15 секунд) уходит либо в HTTP API школы
(``POST /v1/lessons/{id}/audio``), либо обрабатывается на этом же компьютере.
Если продиктовать номер, почту или ник, нарушение фиксируется через несколько
секунд, а администратор получает уведомление. Если запись остановить посреди
урока, сервер заметит перерыв (TUTOR_RECORDING_GAP_SECONDS) и тоже сообщит.

Что записывается: устройство ввода компьютера (микрофон). Чтобы записать обоих
собеседников звонка, выберите устройство, которое захватывает звук системы
(«Стерео микшер» в Windows, BlackHole в macOS, monitor-источник в Linux),
или используйте серверную запись платформы видеосвязи школы.
"""

from __future__ import annotations

import io
import json
import logging
import queue
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import wave
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from typing import Any

log = logging.getLogger(__name__)

SAMPLE_RATE = 16000
MAX_PENDING = 40  # сколько фрагментов держать в очереди при обрыве сети (~10 минут при 15 с)


def pcm16_to_wav(pcm: bytes, sample_rate: int = SAMPLE_RATE, channels: int = 1) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)
    return buf.getvalue()


def iter_file_chunks(path: str, chunk_seconds: float) -> Iterator[bytes]:
    """Готовая запись → WAV-фрагменты (для загрузки записи «как будто вживую» и для проверки системы)."""
    try:
        from faster_whisper import decode_audio
    except ImportError as exc:
        raise RuntimeError("для чтения аудиофайлов установите requirements-speech.txt") from exc
    import numpy as np

    samples = decode_audio(path, sampling_rate=SAMPLE_RATE)
    step = int(chunk_seconds * SAMPLE_RATE)
    for start in range(0, len(samples), step):
        part = np.clip(samples[start:start + step], -1.0, 1.0)
        yield pcm16_to_wav((part * 32767).astype("<i2").tobytes())


def iter_microphone_chunks(chunk_seconds: float, stop: threading.Event, device: int | str | None = None) -> Iterator[bytes]:
    """Микрофон → WAV-фрагменты. Останавливается по ``stop``; последний неполный фрагмент тоже отдаётся."""
    try:
        import sounddevice as sd
    except (ImportError, OSError) as exc:
        raise RuntimeError("для записи с микрофона установите requirements-recorder.txt "
                           "(pip install sounddevice numpy)") from exc
    frames: queue.Queue[bytes] = queue.Queue()

    def callback(indata, _frames, _time, status) -> None:  # вызывается из потока аудио
        if status:
            log.warning("Аудио: %s", status)
        frames.put(bytes(indata))

    target = int(chunk_seconds * SAMPLE_RATE) * 2  # байт в фрагменте (16 бит, моно)
    with sd.RawInputStream(samplerate=SAMPLE_RATE, channels=1, dtype="int16", device=device, callback=callback):
        buf = bytearray()
        while not stop.is_set():
            try:
                buf += frames.get(timeout=0.5)
            except queue.Empty:
                continue
            if len(buf) >= target:
                yield pcm16_to_wav(bytes(buf[:target]))
                del buf[:target]
        while not frames.empty():
            buf += frames.get_nowait()
        if len(buf) >= SAMPLE_RATE:  # хотя бы секунда звука
            yield pcm16_to_wav(bytes(buf))


def list_devices() -> str:
    try:
        import sounddevice as sd
    except (ImportError, OSError) as exc:
        raise RuntimeError("установите requirements-recorder.txt (pip install sounddevice numpy)") from exc
    return str(sd.query_devices())


@dataclass
class Speaker:
    speaker_id: str | None = None
    speaker_name: str | None = None
    role: str | None = None


class ApiUploader:
    """Отправка фрагментов в HTTP API школы."""

    def __init__(self, base_url: str, lesson_id: str, speaker: Speaker, token: str | None = None, timeout: float = 120):
        self.url = base_url.rstrip("/") + f"/v1/lessons/{urllib.parse.quote(lesson_id)}/audio"
        params = {k: v for k, v in (("speaker_id", speaker.speaker_id), ("speaker_name", speaker.speaker_name),
                                    ("role", speaker.role)) if v}
        if params:
            self.url += "?" + urllib.parse.urlencode(params)
        self.token = token
        self.timeout = timeout

    def __call__(self, wav: bytes) -> dict[str, Any]:
        req = urllib.request.Request(self.url, data=wav, method="POST", headers={"Content-Type": "audio/wav"})
        if self.token:
            req.add_header("Authorization", f"Bearer {self.token}")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as err:
            body = err.read()
            try:
                data = json.loads(body)
            except ValueError:
                data = {"error": body.decode("utf-8", "replace")}
            if err.code in (400, 401, 403, 404, 409, 413):
                raise PermanentUploadError(data.get("error") or str(err)) from None
            if isinstance(data, dict) and "checked" in data:
                return data  # фрагмент принят сервером, хотя речь и не проверена
            raise


class LocalUploader:
    """Обработка фрагментов на этом же компьютере (без сервера)."""

    def __init__(self, assistant: Any, lesson_id: str, speaker: Speaker):
        self.assistant = assistant
        self.lesson_id = lesson_id
        self.speaker = speaker

    def __call__(self, wav: bytes) -> dict[str, Any]:
        out = self.assistant.process_audio(self.lesson_id, self.speaker.speaker_id, self.speaker.speaker_name, wav,
                                           role=self.speaker.role, recording=True)
        return out.to_dict()


class PermanentUploadError(RuntimeError):
    """Ошибка, которую бессмысленно повторять (урок завершён, нет доступа)."""


def run_recording(chunks: Iterator[bytes], upload: Callable[[bytes], dict[str, Any]],
                  report: Callable[[str], None] = print, retry_delays: tuple[float, ...] = (2, 4, 8, 16)) -> int:
    """Отправлять фрагменты по мере записи. Возвращает число нарушений.

    При обрыве сети фрагменты копятся в очереди (до MAX_PENDING) и отправляются позже —
    запись не теряется. Ошибка доступа или завершённый урок останавливают запись.
    """
    pending: list[bytes] = []
    state = {"violations": 0, "sent": 0}

    def flush() -> bool:
        """Отправить очередь. False – нет связи (фрагменты остаются в очереди)."""
        while pending:
            result = None
            for delay in (0, *retry_delays):
                if delay:
                    time.sleep(delay)
                try:
                    result = upload(pending[0])
                    break
                except (urllib.error.URLError, OSError, TimeoutError) as exc:
                    log.warning("Не удалось отправить фрагмент: %s", exc)
            if result is None:
                return False
            pending.pop(0)
            state["sent"] += 1
            state["violations"] += _report_result(result, state["sent"], report)
        return True

    try:
        for chunk in chunks:
            pending.append(chunk)
            if len(pending) > MAX_PENDING:
                pending.pop(0)
                report("⚠️ Нет связи с сервером слишком долго – самый старый фрагмент записи отброшен.")
            if not flush():
                report(f"⚠️ Нет связи с сервером, фрагментов в очереди: {len(pending)}. Запись продолжается.")
        if pending and not flush():
            report(f"⚠️ Не удалось отправить последние фрагменты записи: {len(pending)}.")
    except PermanentUploadError as exc:
        report(f"⛔ Запись остановлена: {exc}")
    return state["violations"]


def _report_result(result: dict[str, Any], n: int, report: Callable[[str], None]) -> int:
    if result.get("checked") is False:
        report(f"🔴 Фрагмент {n}: записан, но речь не проверена ({result.get('error') or 'распознавание недоступно'})")
        return 0
    moderation = result.get("moderation") or {}
    if moderation.get("action") == "block":
        report(f"🚫 Фрагмент {n}: в речи обнаружены контактные данные ({moderation.get('summary')}). "
               "Нарушение передано администратору школы.")
        return 1
    if moderation.get("action") == "warn":
        report(f"⚠️ Фрагмент {n}: {moderation.get('summary')}. {moderation.get('warning') or ''}".strip())
        return 1
    words = ", ".join(w["word"] for w in result.get("new_words") or [])
    report(f"🔴 Фрагмент {n}: ок" + (f" – записаны слова: {words}" if words else ""))
    return 0
