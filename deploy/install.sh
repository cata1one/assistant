#!/usr/bin/env bash
# Установка Better study на чистый сервер Ubuntu 22.04 / 24.04 (запускать от root).
#
#   bash install.sh --domain betterstudy.ru            # сайт с HTTPS (нужен домен, A-запись → IP сервера)
#   bash install.sh                                    # без домена: только http://IP (камера в классе не работает)
#   bash install.sh --domain betterstudy.ru --no-speech   # без распознавания речи (если памяти < 3 ГБ)
#
# Повторный запуск безопасен: .env и база не перезаписываются.
set -euo pipefail

REPO="${REPO:-https://github.com/cata1one/assistant.git}"
BRANCH="${BRANCH:-claude/busy-ramanujan-h8c5ma}"
APP_DIR=/opt/better-study
DATA_DIR=/var/lib/better-study
APP_USER=school
DOMAIN=""
SPEECH=1
TURN=1

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --no-speech) SPEECH=0; shift ;;
    --no-turn) TURN=0; shift ;;
    *) echo "Неизвестный параметр: $1"; exit 1 ;;
  esac
done

[ "$(id -u)" = 0 ] || { echo "Запустите от root: sudo bash install.sh ..."; exit 1; }
say() { printf '\n\033[1;35m▶ %s\033[0m\n' "$*"; }
IP="$(curl -4 -s -m 10 https://ifconfig.me || hostname -I | awk '{print $1}')"

grep -qi ubuntu /etc/os-release || echo "⚠️  Скрипт рассчитан на Ubuntu — продолжаю, но возможны отличия."
say "1/8 Системные пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q python3 python3-venv python3-pip git curl sqlite3 ufw debian-keyring debian-archive-keyring apt-transport-https gnupg

say "2/8 Код школы ($BRANCH)"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
git config --global --get-all safe.directory | grep -qx "$APP_DIR" || git config --global --add safe.directory "$APP_DIR"  # папка принадлежит school, а git запускает root
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch -q origin "$BRANCH" && git -C "$APP_DIR" checkout -q "$BRANCH" && git -C "$APP_DIR" reset -q --hard "origin/$BRANCH"
else
  git clone -q -b "$BRANCH" "$REPO" "$APP_DIR"
fi
mkdir -p "$DATA_DIR/models"

say "3/8 Python-окружение (несколько минут)"
python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install -q --upgrade pip
"$APP_DIR/.venv/bin/pip" install -q -r "$APP_DIR/requirements.txt"
SPEECH_OK=0
if [ "$SPEECH" = 1 ]; then
  # Для самых новых версий Python у библиотеки распознавания может ещё не быть готовых сборок —
  # тогда сайт и бот всё равно ставятся, а расшифровка выключается с предупреждением.
  if "$APP_DIR/.venv/bin/pip" install -q -r "$APP_DIR/requirements-speech.txt"; then
    SPEECH_OK=1
  else
    echo "⚠️  Распознавание речи не установилось для $(python3 --version). Сайт и бот работают, расшифровка выключена."
    SPEECH=0
  fi
fi

say "4/8 Настройки (.env)"
ENV="$APP_DIR/.env"
[ -f "$ENV" ] || cp "$APP_DIR/.env.example" "$ENV"
setenv() {  # setenv KEY VALUE — заменить или дописать строку в .env
  if grep -q "^$1=" "$ENV"; then sed -i "s|^$1=.*|$1=$2|" "$ENV"; else echo "$1=$2" >> "$ENV"; fi
}
getenv() { grep "^$1=" "$ENV" | head -1 | cut -d= -f2-; }
SITE="http://$IP"; [ -n "$DOMAIN" ] && SITE="https://$DOMAIN"
setenv TUTOR_SITE_URL "$SITE"
setenv TUTOR_DB_PATH "$DATA_DIR/tutor_assistant.sqlite3"
setenv TUTOR_STT_MODEL_DIR "$DATA_DIR/models"
setenv TUTOR_API_HOST 127.0.0.1
setenv TUTOR_API_PORT 8080
setenv TUTOR_TRUST_PROXY 1
[ "$SPEECH" = 1 ] || setenv TUTOR_STT off
case "$(getenv TUTOR_API_TOKEN)" in ""|change-me*) setenv TUTOR_API_TOKEN "$(openssl rand -hex 24)" ;; esac

if [ "$TURN" = 1 ]; then
  say "5/8 TURN-сервер для видеосвязи (coturn)"
  apt-get install -y -q coturn
  TURN_PASS="$(getenv TUTOR_TURN_PASSWORD)"; [ -n "$TURN_PASS" ] || TURN_PASS="$(openssl rand -hex 16)"
  setenv TUTOR_TURN_PASSWORD "$TURN_PASS"
  REALM="${DOMAIN:-$IP}"
  cat > /etc/turnserver.conf <<CONF
listening-port=3478
fingerprint
lt-cred-mech
user=school:$TURN_PASS
realm=$REALM
external-ip=$IP
min-port=49160
max-port=49200
no-cli
no-tlsv1
no-tlsv1_1
no-multicast-peers
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
CONF
  sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn 2>/dev/null || true
  systemctl enable -q coturn && systemctl restart coturn
  setenv TUTOR_ICE_SERVERS "[{\"urls\":\"stun:$IP:3478\"},{\"urls\":[\"turn:$IP:3478?transport=udp\",\"turn:$IP:3478?transport=tcp\"],\"username\":\"school\",\"credential\":\"$TURN_PASS\"}]"
else
  say "5/8 TURN пропущен (--no-turn)"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$DATA_DIR"
chmod 600 "$ENV"

say "6/8 Служба (автозапуск и перезапуск при сбое)"
cat > /etc/systemd/system/better-study.service <<UNIT
[Unit]
Description=Better study: сайт, онлайн-класс, Telegram-бот и API
After=network-online.target
Wants=network-online.target

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/.venv/bin/python -m tutor_assistant serve --host 127.0.0.1 --port 8080
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=$APP_DIR $DATA_DIR

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable -q better-study

say "7/8 Веб-сервер Caddy (HTTPS-сертификат выпускается автоматически)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q && apt-get install -y -q caddy
fi
SITE_ADDR="${DOMAIN:-:80}"
cat > /etc/caddy/Caddyfile <<CADDY
$SITE_ADDR {
	encode zstd gzip
	request_body {
		max_size 300MB
	}
	reverse_proxy 127.0.0.1:8080
}
CADDY
[ -n "$DOMAIN" ] && cat >> /etc/caddy/Caddyfile <<CADDY

www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}
CADDY
systemctl enable -q caddy && systemctl reload caddy 2>/dev/null || systemctl restart caddy

say "8/8 Брандмауэр и резервные копии"
ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
if [ "$TURN" = 1 ]; then ufw allow 3478 >/dev/null; ufw allow 49160:49200/udp >/dev/null; fi
ufw --force enable >/dev/null
mkdir -p /var/backups/better-study
cat > /etc/cron.daily/better-study-backup <<'CRON'
#!/bin/sh
# Ежедневная копия базы, хранится 14 дней
sqlite3 /var/lib/better-study/tutor_assistant.sqlite3 ".backup '/var/backups/better-study/db-$(date +%F).sqlite3'"
find /var/backups/better-study -name 'db-*.sqlite3' -mtime +14 -delete
CRON
chmod +x /etc/cron.daily/better-study-backup

say "Проверка связи с Telegram"
if curl -s -m 10 -o /dev/null https://api.telegram.org; then
  echo "✅ Telegram доступен напрямую — прокси не нужен."
else
  echo "⚠️  api.telegram.org недоступен с этого сервера. Впишите прокси в $ENV: TELEGRAM_PROXY=http://адрес:порт"
fi

echo
if grep -q "^TELEGRAM_BOT_TOKEN=.\+" "$ENV"; then
  systemctl restart better-study
  echo "✅ Готово. Сайт: $SITE"
else
  echo "✅ Установка завершена. Осталось вписать токен бота и id администраторов:"
  echo "   nano $ENV      (TELEGRAM_BOT_TOKEN, TUTOR_BOT_USERNAME, TUTOR_ADMIN_CHAT_ID, TUTOR_ADMIN_USER_IDS)"
  echo "   systemctl restart better-study"
  echo "   Сайт: $SITE"
fi
[ "$SPEECH_OK" = 1 ] || echo "ℹ️  Расшифровка речи выключена (TUTOR_STT=off). Напишите разработчику — подберём вариант."
echo "Журнал: journalctl -u better-study -f    Обновление: bash $APP_DIR/deploy/update.sh"
