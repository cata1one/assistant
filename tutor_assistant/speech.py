"""Распознавание речи: голосовые сообщения, «кружочки», запись урока.

По умолчанию используется локальная модель Whisper (пакет ``faster-whisper``):
аудио не покидает сервер школы – это важно, потому что в записи уроков есть
персональные данные. Модель скачивается один раз при первом использовании
(или кладётся в ``TUTOR_STT_MODEL_DIR`` на серверах без интернета).

Без установленного пакета ассистент работает, но голос не проверяет —
что делать с непроверенным аудио, решает настройка TUTOR_RELAY_UNCHECKED_AUDIO.
"""

from __future__ import annotations

import io
import logging
import threading
import time
import wave
from dataclasses import dataclass, field
from pathlib import Path
from typing import BinaryIO, Protocol

from .config import Settings

log = logging.getLogger(__name__)

AudioInput = bytes | bytearray | str | Path | BinaryIO

LOAD_RETRY_SECONDS = 60.0

# Подсказка модели: урок иностранного языка, речь на русском вперемешку с изучаемым языком.
INITIAL_PROMPT = ("Урок иностранного языка. Преподаватель и ученик говорят по-русски и на изучаемом языке: "
                  "English, 中文, español, français, italiano, português, العربية, српски, हिन्दी, ελληνικά. "
                  "Слова: homework, vocabulary, Present Perfect, grammar, pronunciation, listening.")


@dataclass
class Segment:
    start: float
    end: float
    text: str


@dataclass
class Transcription:
    text: str
    segments: list[Segment] = field(default_factory=list)
    language: str | None = None
    duration: float = 0.0


class Transcriber(Protocol):
    @property
    def available(self) -> bool: ...

    last_error: str | None

    def transcribe(self, audio: AudioInput, language: str | None = None) -> Transcription: ...


class UnavailableTranscriber:
    """Заглушка, когда распознавание выключено или не установлено."""

    def __init__(self, reason: str):
        self.last_error: str | None = reason

    @property
    def available(self) -> bool:
        return False

    def transcribe(self, audio: AudioInput, language: str | None = None) -> Transcription:
        raise RuntimeError(self.last_error or "распознавание речи недоступно")


class WhisperTranscriber:
    """Локальный Whisper через faster-whisper. Модель загружается лениво и одна на процесс."""

    def __init__(self, model: str = "small", device: str = "cpu", compute_type: str = "int8",
                 language: str | None = None, model_dir: str | None = None):
        from faster_whisper import WhisperModel  # noqa: F401 – проверяем, что пакет установлен

        self.model_name = model
        self.device = device
        self.compute_type = compute_type
        self.language = language or None
        self.model_dir = model_dir or None
        self.last_error: str | None = None
        self._model = None
        self._lock = threading.Lock()
        self._load_failed_at: float | None = None

    @property
    def available(self) -> bool:
        return True

    def _load(self):
        if self._model is None:
            from faster_whisper import WhisperModel

            if self._load_failed_at is not None and time.monotonic() - self._load_failed_at < LOAD_RETRY_SECONDS:
                raise RuntimeError(self.last_error or "модель распознавания речи недоступна")
            log.info("Загрузка модели распознавания речи %s (%s/%s)…", self.model_name, self.device, self.compute_type)
            try:
                self._model = WhisperModel(self.model_name, device=self.device, compute_type=self.compute_type,
                                           download_root=self.model_dir)
            except Exception as exc:
                # Не пытаемся скачать модель на каждом фрагменте – повтор не чаще раза в минуту.
                self._load_failed_at = time.monotonic()
                self.last_error = f"не удалось загрузить модель {self.model_name}: {exc}"
                raise RuntimeError(self.last_error) from exc
            self.last_error = None
        return self._model

    def transcribe(self, audio: AudioInput, language: str | None = None,
                   allowed: tuple[str, ...] | None = None) -> Transcription:
        """allowed – языки, на которых может идти речь (русский и изучаемый). Whisper на коротких фрагментах
        нередко «узнаёт» соседний язык (украинский вместо русского, немецкий вместо английского) и пишет
        бессмыслицу; поэтому язык выбираем только из разрешённых."""
        source: str | BinaryIO
        if isinstance(audio, (bytes, bytearray)):
            source = io.BytesIO(bytes(audio))
        elif isinstance(audio, Path):
            source = str(audio)
        else:
            source = audio
        with self._lock:  # модель одна; запросы выполняются по очереди
            model = self._load()
            try:
                from faster_whisper import decode_audio

                samples = decode_audio(source, sampling_rate=16000)
            except Exception:  # noqa: BLE001 – старые версии: отдаём файл как есть
                samples = source
            options = dict(
                beam_size=5, best_of=5,
                # Тишину и вдохи отбрасываем: без этого Whisper «слышит» в паузах выдуманные фразы
                vad_filter=True, vad_parameters={"min_silence_duration_ms": 500, "speech_pad_ms": 200},
                condition_on_previous_text=False, initial_prompt=INITIAL_PROMPT,
                temperature=(0.0, 0.2, 0.4), no_speech_threshold=0.5, compression_ratio_threshold=2.2,
            )
            lang = language or self.language
            segments_iter, info = model.transcribe(samples, language=lang, **options)
            if not lang and allowed and getattr(info, "language", None) not in allowed:
                probs = dict(getattr(info, "all_language_probs", None) or [])
                best = max(allowed, key=lambda code: probs.get(code, 0.0))
                if not isinstance(samples, (str, io.BytesIO)):
                    segments_iter, info = model.transcribe(samples, language=best, **options)
            segments = [Segment(float(s.start), float(s.end), s.text.strip()) for s in segments_iter if s.text.strip()]
        return Transcription(text=" ".join(s.text for s in segments).strip(), segments=segments,
                             language=getattr(info, "language", None), duration=float(getattr(info, "duration", 0.0)))


def make_transcriber(settings: Settings) -> Transcriber:
    mode = settings.stt_mode
    if mode in {"off", "0", "false", "no"}:
        return UnavailableTranscriber("распознавание речи выключено (TUTOR_STT=off)")
    try:
        return WhisperTranscriber(settings.stt_model, settings.stt_device, settings.stt_compute_type,
                                  settings.stt_language or None, settings.stt_model_dir or None)
    except ImportError:
        reason = "не установлен пакет распознавания речи (pip install -r requirements-speech.txt)"
        if mode in {"on", "1", "true", "yes"}:
            log.error("TUTOR_STT=on, но %s", reason)
        return UnavailableTranscriber(reason)


def audio_duration(audio: AudioInput) -> float:
    """Длительность фрагмента без распознавания (для учёта записи, когда речь проверить не удалось).

    WAV читается стандартной библиотекой; WebM/Ogg/MP4 из браузера – через PyAV, если он установлен
    (у записей MediaRecorder в заголовке нет длительности, поэтому считаем по последнему пакету).
    """
    if not isinstance(audio, (bytes, bytearray)):
        return 0.0
    try:
        with wave.open(io.BytesIO(bytes(audio))) as w:
            return w.getnframes() / float(w.getframerate() or 1)
    except (wave.Error, EOFError):
        pass
    try:
        import av
    except ImportError:
        return 0.0
    try:
        with av.open(io.BytesIO(bytes(audio))) as container:
            stream = next((s for s in container.streams if s.type == "audio"), None)
            if stream is None or stream.time_base is None:
                return 0.0
            end = 0
            for packet in container.demux(stream):
                if packet.pts is not None:
                    end = max(end, packet.pts + (packet.duration or 0))
            return round(float(end * stream.time_base), 2)
    except Exception:  # битый файл – длительность неизвестна
        return 0.0


def format_timestamp(seconds: float) -> str:
    total = max(0, int(seconds))
    return f"{total // 3600:02d}:{total % 3600 // 60:02d}:{total % 60:02d}"


def segments_to_transcript(segments: list[Segment], speaker: str = "Урок", max_block_seconds: float = 30.0,
                           max_block_chars: int = 400) -> str:
    """Сегменты распознавания → расшифровка «[чч:мм:сс] Говорящий: текст».

    Соседние короткие сегменты объединяются в блоки, чтобы номер телефона,
    продиктованный с паузами, не разрывался между репликами.
    """
    lines: list[str] = []
    block: list[Segment] = []

    def flush() -> None:
        if block:
            text = " ".join(s.text for s in block)
            lines.append(f"[{format_timestamp(block[0].start)}] {speaker}: {text}")
            block.clear()

    for seg in segments:
        if block and (seg.end - block[0].start > max_block_seconds
                      or sum(len(s.text) for s in block) + len(seg.text) > max_block_chars):
            flush()
        block.append(seg)
    flush()
    return "\n".join(lines)
