# Bright для Android

Приложение открывает сайт https://brightplatform.online в собственном окне: те же кабинеты, уроки,
доска, слова, голосовые и Искорка. Обновлять приложение после каждого изменения сайта не нужно:
оно всегда показывает актуальную версию. Новая сборка нужна, только если поменялись иконка, название,
адрес сайта или разрешения.

Сделано на Capacitor 8: `android/` – обычный проект Android Studio.

## Как получить APK и AAB

Сборка идёт в GitHub Actions при каждом изменении папки `mobile/` (или вручную: вкладка **Actions** →
**Android app** → **Run workflow**). Готовые файлы: Actions → последняя сборка → **Artifacts** →
`bright-android` (внутри `bright.apk` и `bright.aab`).

Пока ключ подписи не добавлен, APK подписывается отладочным ключом: на телефон он ставится, а в RuStore
его загрузить нельзя.

## Ключ подписи (один раз)

1. На сервере или любом компьютере с Java: `bash mobile/make-keystore.sh`
   (если нет keytool: `sudo apt install -y openjdk-17-jre-headless`).
2. Скрипт напишет, какие четыре секрета добавить в GitHub: Settings → Secrets and variables → Actions.
3. Файл `bright.keystore` и пароль сохраните в надёжном месте. Если их потерять, обновления
   приложения в RuStore выпустить не получится.

## Публикация в RuStore

1. Зарегистрируйтесь в консоли разработчика: https://console.rustore.ru (физлицо, самозанятый или ИП).
2. Создайте приложение, имя пакета: `online.brightplatform.app`.
3. Загрузите `bright.apk` из сборки с вашим ключом.
4. Иконка 512×512: `frontend/public/icon-512.png`. Скриншоты телефона: `frontend/public/shot-phone-*.webp`
   (если консоль просит PNG или JPG, откройте файл в браузере и сохраните как PNG).
5. Политика конфиденциальности: https://brightplatform.online/#/privacy
6. Категория: «Образование». Возрастной рейтинг: 0+ или 6+.
7. После проверки модераторами (обычно 1–3 рабочих дня) скопируйте ссылку на страницу приложения
   и добавьте на сервере в `/opt/better-study/.env` строку `TUTOR_RUSTORE_URL=<ссылка>`, затем
   `systemctl restart better-study`. Кнопка «Открыть в RuStore» появится на странице «Приложение».

## APK прямо с сайта

Если положить файл на сервер рядом с базой под именем `bright.apk`
(`cp bright.apk /var/lib/better-study/bright.apk`, там же лежит файл базы),
на странице «Приложение» появится кнопка «Скачать APK».

## Новая версия

В `android/app/build.gradle` увеличьте `versionCode` на 1 и поменяйте `versionName`, сделайте коммит –
GitHub соберёт новые файлы.

## Другой адрес сайта

Поменяйте `server.url` в `capacitor.config.json` и адреса в `www/index.html`, `www/offline.html`.

## Сборка на своём компьютере

Нужны Node.js 22 и Android Studio.

```bash
cd mobile
npm ci
npx cap sync android
npx cap open android   # дальше Build → Generate Signed App Bundle / APK
```
