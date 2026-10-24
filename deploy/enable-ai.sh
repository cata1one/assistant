#!/usr/bin/env bash
# Включить бесплатный ИИ на своём сервере (Ollama): конспект урока по расшифровке и конструктор занятий.
#
#   bash enable-ai.sh            # модель подбирается по объёму памяти
#   bash enable-ai.sh qwen2.5:7b # своя модель
#   bash enable-ai.sh --off      # выключить ИИ (Ollama остаётся, сайт перестаёт к ней обращаться)
#
# ИИ необязателен: без него конспект собирается офлайн-алгоритмом, а занятия – из слов преподавателя.
set -euo pipefail
ENV=/opt/better-study/.env
[ "$(id -u)" = 0 ] || { echo "Запустите от root: sudo bash enable-ai.sh"; exit 1; }
setenv() { if grep -q "^$1=" "$ENV"; then sed -i "s|^$1=.*|$1=$2|" "$ENV"; else echo "$1=$2" >> "$ENV"; fi; }

if [ "${1:-}" = "--off" ]; then
  sed -i '/^TUTOR_AI_URL=/d;/^TUTOR_AI_MODEL=/d' "$ENV"
  systemctl restart better-study && echo "✅ ИИ выключен" && exit 0
fi

MEM_GB=$(( $(awk '/MemTotal/ {print $2}' /proc/meminfo) / 1024 / 1024 ))
MODEL="${1:-}"
if [ -z "$MODEL" ]; then
  # Qwen 2.5 хорошо понимает русский, английский и китайский
  if [ "$MEM_GB" -ge 14 ]; then MODEL=qwen2.5:14b
  elif [ "$MEM_GB" -ge 7 ]; then MODEL=qwen2.5:7b
  elif [ "$MEM_GB" -ge 4 ]; then MODEL=qwen2.5:3b; echo "⚠️  Памяти ${MEM_GB} ГБ – ставлю небольшую модель, конспекты будут проще. Для 7b нужно от 8 ГБ."
  else echo "❌ Памяти ${MEM_GB} ГБ – мало для ИИ на сервере. Нужно от 4 ГБ (лучше 8), или подключите OpenRouter (см. README)."; exit 1
  fi
fi

if ! command -v ollama >/dev/null; then
  echo "▶ Устанавливаю Ollama"
  curl -fsSL https://ollama.com/install.sh | sh
fi
# Окно 16K токенов – чтобы влезала расшифровка урока; слушать только локально
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/better.conf <<'EOF'
[Service]
Environment="OLLAMA_CONTEXT_LENGTH=16384"
Environment="OLLAMA_HOST=127.0.0.1:11434"
Environment="OLLAMA_KEEP_ALIVE=10m"
EOF
systemctl daemon-reload && systemctl enable --now ollama && systemctl restart ollama
sleep 3
echo "▶ Скачиваю модель $MODEL (несколько ГБ, это может занять время)"
ollama pull "$MODEL"

setenv TUTOR_AI_URL "http://127.0.0.1:11434/v1"
setenv TUTOR_AI_MODEL "$MODEL"
systemctl restart better-study
sleep 3
systemctl is-active --quiet better-study && echo "✅ ИИ включён: $MODEL. Конспект после урока готовится в фоне за несколько минут." \
  || { journalctl -u better-study -n 30 --no-pager; exit 1; }
