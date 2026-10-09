FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 TUTOR_DB_PATH=/data/tutor_assistant.sqlite3
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY tutor_assistant ./tutor_assistant
VOLUME ["/data"]

# По умолчанию — Telegram-бот. Для API: docker run ... tutor-assistant api --host 0.0.0.0
ENTRYPOINT ["python", "-m", "tutor_assistant"]
CMD ["bot"]
