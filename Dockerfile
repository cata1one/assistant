FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 TUTOR_DB_PATH=/data/tutor_assistant.sqlite3
WORKDIR /app
# WITH_SPEECH=1 — с распознаванием речи (проверка голосовых и записи урока). Модель кэшируется в /data/models.
ARG WITH_SPEECH=1
ENV TUTOR_STT_MODEL_DIR=/data/models
COPY requirements.txt requirements-speech.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && if [ "$WITH_SPEECH" = "1" ]; then pip install --no-cache-dir -r requirements-speech.txt; fi
COPY tutor_assistant ./tutor_assistant
VOLUME ["/data"]

# По умолчанию — всё вместе: Telegram-бот, сайт школы и HTTP API на порту 8080.
# Только бот: docker run ... bot; только сайт и API: docker run ... api --host 0.0.0.0
EXPOSE 8080
ENTRYPOINT ["python", "-m", "tutor_assistant"]
CMD ["serve", "--host", "0.0.0.0"]
