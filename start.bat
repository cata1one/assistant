@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Онлайн-школа: сайт и ассистент

where python >nul 2>nul || (
  echo Python не найден. Установите его с https://www.python.org/downloads/
  echo и при установке отметьте галочку "Add python.exe to PATH".
  pause & exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo Первый запуск: создаю окружение и устанавливаю библиотеки, это 1-2 минуты...
  python -m venv .venv || (pause & exit /b 1)
  ".venv\Scripts\python.exe" -m pip install --upgrade pip >nul
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt || (pause & exit /b 1)
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Создан файл настроек .env — сейчас он откроется в Блокноте.
  echo Для просмотра сайта на своём компьютере впишите TUTOR_SITE_URL=http://127.0.0.1:8080
  echo Сохраните файл, закройте Блокнот, и запуск продолжится.
  notepad ".env"
)

set MODE=api
findstr /r /c:"^TELEGRAM_BOT_TOKEN=..*" ".env" >nul && set MODE=serve

echo.
echo Сайт: http://127.0.0.1:8080   (остановить — Ctrl+C)
if "%MODE%"=="serve" (echo Telegram-бот тоже запущен.) else (echo Бот не запущен: в .env не задан TELEGRAM_BOT_TOKEN.)
start "" http://127.0.0.1:8080
".venv\Scripts\python.exe" -m tutor_assistant %MODE%
pause
