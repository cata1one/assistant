#!/usr/bin/env bash
# Обновить сайт до последней версии из репозитория (база и .env сохраняются).
set -euo pipefail
APP_DIR=/opt/better-study
BRANCH="${BRANCH:-claude/busy-ramanujan-h8c5ma}"
[ "$(id -u)" = 0 ] || { echo "Запустите от root: sudo bash update.sh"; exit 1; }
sqlite3 /var/lib/better-study/tutor_assistant.sqlite3 ".backup '/var/backups/better-study/before-update-$(date +%F-%H%M).sqlite3'" || true
git config --global --get-all safe.directory | grep -qx "$APP_DIR" || git config --global --add safe.directory "$APP_DIR"  # папка принадлежит school, а git запускает root
git -C "$APP_DIR" fetch -q origin "$BRANCH"
git -C "$APP_DIR" reset -q --hard "origin/$BRANCH"
REQ=requirements.txt; grep -q "^TUTOR_STT=off" "$APP_DIR/.env" || REQ=requirements-speech.txt
"$APP_DIR/.venv/bin/pip" install -q -r "$APP_DIR/$REQ"
# Точнее распознавание: на сервере от 4 ядер и 8 ГБ переходим со small/medium на large-v3-turbo
ENV="$APP_DIR/.env"
if grep -qE "^TUTOR_STT_MODEL=(small|medium)$" "$ENV" && [ "$(nproc)" -ge 4 ] && [ "$(awk '/MemTotal/ {print int($2/1024/1024)}' /proc/meminfo)" -ge 8 ]; then
  sed -i "s/^TUTOR_STT_MODEL=.*/TUTOR_STT_MODEL=large-v3-turbo/" "$ENV" && echo "Распознавание речи: модель large-v3-turbo (скачается при первом уроке, ~1.6 ГБ)"
fi
chown -R school:school "$APP_DIR"
systemctl restart better-study
sleep 3
systemctl is-active --quiet better-study && echo "✅ Обновлено и запущено" || { echo "❌ Служба не запустилась:"; journalctl -u better-study -n 40 --no-pager; exit 1; }
