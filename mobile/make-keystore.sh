#!/bin/bash
# Ключ подписи приложения Bright для RuStore. Запускается ОДИН раз на любом компьютере или сервере с Java:
#   sudo apt install -y openjdk-17-jre-headless   # если keytool не найден
#   bash make-keystore.sh
# Ключ и пароль храните в надёжном месте: без них не получится выпустить обновление приложения.
set -e
OUT="${1:-bright.keystore}"
if [ -e "$OUT" ]; then echo "Файл $OUT уже есть – не перезаписываю."; exit 1; fi
command -v keytool >/dev/null || { echo "Нет keytool: sudo apt install -y openjdk-17-jre-headless"; exit 1; }
read -r -s -p "Придумайте пароль ключа (не короче 8 символов): " PASS; echo
[ ${#PASS} -ge 8 ] || { echo "Пароль слишком короткий"; exit 1; }
keytool -genkeypair -v -keystore "$OUT" -alias bright -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=Bright, O=Bright, C=RU" >/dev/null 2>&1
base64 -w0 "$OUT" > "$OUT.base64.txt"
echo
echo "Готово: $OUT"
echo "Добавьте в GitHub → Settings → Secrets and variables → Actions → New repository secret:"
echo "  BRIGHT_KEYSTORE_BASE64   = содержимое файла $OUT.base64.txt"
echo "  BRIGHT_KEYSTORE_PASSWORD = ваш пароль"
echo "  BRIGHT_KEY_ALIAS         = bright"
echo "  BRIGHT_KEY_PASSWORD      = ваш пароль"
echo "После этого удалите $OUT.base64.txt, а сам $OUT сохраните в надёжном месте (не в репозитории)."
