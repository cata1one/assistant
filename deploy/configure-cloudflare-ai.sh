#!/usr/bin/env bash
# Connect Bright to Cloudflare Workers AI without putting the token in shell history or arguments.
set -euo pipefail
umask 077
ENV_FILE=/opt/better-study/.env
if [ "$(id -u)" != 0 ] || [ ! -f "$ENV_FILE" ] || [ ! -t 0 ]; then
  echo "Запустите от root в интерактивной SSH-сессии; файл $ENV_FILE должен существовать."
  exit 1
fi
read -r -p 'Cloudflare Account ID: ' BRIGHT_CF_ACCOUNT
if [[ ! "$BRIGHT_CF_ACCOUNT" =~ ^[[:xdigit:]]{32}$ ]]; then
  echo 'Неверный Account ID: ожидается 32 шестнадцатеричных символа.'
  exit 1
fi
read -r -s -p 'Cloudflare Workers AI API token (не отображается): ' BRIGHT_CF_TOKEN
echo
if [ -z "$BRIGHT_CF_TOKEN" ]; then echo 'Токен пустой.'; exit 1; fi
echo 'Модель: 1 — более сильная Llama 3.3 70B (меньше бесплатных запросов); 2 — экономная Llama 3.1 8B.'
read -r -p 'Выбор [1]: ' BRIGHT_CF_CHOICE
case "${BRIGHT_CF_CHOICE:-1}" in
  1) BRIGHT_CF_MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast' ;;
  2) BRIGHT_CF_MODEL='@cf/meta/llama-3.1-8b-instruct-fp8-fast' ;;
  *) echo 'Неизвестный вариант.'; exit 1 ;;
esac
export BRIGHT_CF_ACCOUNT BRIGHT_CF_TOKEN BRIGHT_CF_MODEL

# Validate first; leave the existing application configuration untouched on failure.
python3 - <<'PY'
import json, os, sys, urllib.error, urllib.request
base = 'https://api.cloudflare.com/client/v4/accounts/' + os.environ['BRIGHT_CF_ACCOUNT'] + '/ai/v1'
body = json.dumps({'model':os.environ['BRIGHT_CF_MODEL'],'messages':[{'role':'user','content':'Reply with OK.'}], 'max_tokens':12}).encode()
req = urllib.request.Request(base + '/chat/completions', data=body, headers={'Authorization':'Bearer ' + os.environ['BRIGHT_CF_TOKEN'], 'Content-Type':'application/json'}, method='POST')
try:
    with urllib.request.urlopen(req, timeout=45) as response:
        data = json.load(response)
    if not data['choices'][0]['message']['content'].strip():
        raise ValueError('empty answer')
except urllib.error.HTTPError as exc:
    print(f'Проверка Cloudflare не прошла: HTTP {exc.code}. Проверьте токен, права Workers AI и бесплатный план.', file=sys.stderr)
    sys.exit(1)
except Exception:
    print('Проверка Cloudflare не прошла: нет ответа. Проверьте интернет, Account ID и доступность модели.', file=sys.stderr)
    sys.exit(1)
print('Cloudflare ответил. Сохраняю настройки…')
PY

python3 - <<'PY'
import os, re, stat, tempfile, time
from pathlib import Path
p = Path('/opt/better-study/.env')
info = p.stat()
original = p.read_text(encoding='utf-8')
backup = Path('/root') / ('bright-ai-backup-' + time.strftime('%Y%m%d-%H%M%S') + '.env')
fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w', encoding='utf-8') as f:
    f.write(original)
values = {
    'TUTOR_AI_URL': 'https://api.cloudflare.com/client/v4/accounts/' + os.environ['BRIGHT_CF_ACCOUNT'] + '/ai/v1',
    'TUTOR_AI_KEY': os.environ['BRIGHT_CF_TOKEN'],
    'TUTOR_AI_MODEL': os.environ['BRIGHT_CF_MODEL'],
    'TUTOR_AI_TIMEOUT': '60',
    'TUTOR_AI_SPARK_PARALLEL': '4',
}
lines = [line for line in original.splitlines() if not re.match(r'^\s*(?:export\s+)?(?:' + '|'.join(values) + r')\s*=', line)]
lines.extend(key + '=' + value for key, value in values.items())
fd, name = tempfile.mkstemp(prefix='.bright-ai-', dir=p.parent)
try:
    os.fchmod(fd, stat.S_IMODE(info.st_mode))
    os.fchown(fd, info.st_uid, info.st_gid)
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
        f.flush()
        os.fsync(f.fileno())
    os.replace(name, p)
finally:
    if os.path.exists(name): os.unlink(name)
print('Резервная копия прежних настроек сохранена в /root.')
PY
unset BRIGHT_CF_TOKEN
systemctl restart better-study
if ! curl -fs --retry 20 --retry-delay 2 --retry-connrefused http://127.0.0.1:8080/health; then
  echo; echo 'Сервис не прошёл проверку. Проверьте better-study; прежние настройки сохранены в /root.'; exit 1
fi
echo
systemctl is-active better-study
echo 'Cloudflare AI подключён. Откройте Искорку и проверьте ответ.'
