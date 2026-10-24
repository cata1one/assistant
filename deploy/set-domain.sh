#!/usr/bin/env bash
# Привязать сайт к домену: HTTPS-сертификат выпускается автоматически (Caddy).
#
#   bash set-domain.sh brightplatform.online
#
# Перед запуском в DNS у регистратора домена должны быть записи типа A:
#   brightplatform.online      → IP сервера
#   www.brightplatform.online  → IP сервера
# Проверить, что запись уже работает: ping brightplatform.online
set -euo pipefail
DOMAIN="${1:-}"
ENV=/opt/better-study/.env
[ -n "$DOMAIN" ] || { echo "Укажите домен: bash set-domain.sh brightplatform.online"; exit 1; }
[ "$(id -u)" = 0 ] || { echo "Запустите от root: sudo bash set-domain.sh $DOMAIN"; exit 1; }
setenv() { if grep -q "^$1=" "$ENV"; then sed -i "s|^$1=.*|$1=$2|" "$ENV"; else echo "$1=$2" >> "$ENV"; fi; }

IP="$(curl -4 -s -m 10 https://ifconfig.me || hostname -I | awk '{print $1}')"
RESOLVED="$(getent ahostsv4 "$DOMAIN" | awk '{print $1; exit}' || true)"
if [ "$RESOLVED" != "$IP" ]; then
  echo "⚠️  $DOMAIN сейчас указывает на «${RESOLVED:-нигде}», а сервер: $IP."
  echo "   Добавьте A-запись у регистратора и подождите 5–30 минут (иногда до часа). Потом запустите скрипт ещё раз."
  exit 1
fi

cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
	encode zstd gzip
	request_body {
		max_size 300MB
	}
	reverse_proxy 127.0.0.1:8080
}

www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}
CADDY
systemctl reload caddy 2>/dev/null || systemctl restart caddy

setenv TUTOR_SITE_URL "https://$DOMAIN"
# видеосвязь: TURN-сервер тоже называем по домену
if [ -f /etc/turnserver.conf ]; then sed -i "s|^realm=.*|realm=$DOMAIN|" /etc/turnserver.conf && systemctl restart coturn || true; fi
systemctl restart better-study
sleep 3
if curl -fsS -m 20 "https://$DOMAIN/" -o /dev/null; then
  echo "✅ Готово: https://$DOMAIN (камера и микрофон в уроках теперь работают)"
  echo "   Для оплаты ЮKassa укажите адрес уведомлений: https://$DOMAIN/site/v1/pay/yookassa"
else
  echo "⏳ Сертификат ещё выпускается. Подождите минуту и откройте https://$DOMAIN. Журнал: journalctl -u caddy -n 30"
fi
