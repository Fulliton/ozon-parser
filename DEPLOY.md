# Руководство по развертыванию на виртуальном сервере (VPS / Ubuntu / Debian)

На виртуальном сервере (VPS) нет физического монитора и графической оболочки (GUI). 
Так как Ozon блокирует стандартный режим `headless`, бот использует связку **Google Chrome + Xvfb** (виртуальный дисплей в оперативной памяти). Для защиты Ozon браузер выглядит как реальный компьютер с монитором 1920x1080.

---

## 1. Установка системных зависимостей

Подключитесь к VPS по SSH и установите необходимые пакеты:

```bash
sudo apt update && sudo apt upgrade -y

# 1. Установка Xvfb (виртуальный экран) и библиотек Chrome
sudo apt install -y xvfb wget curl git unzip libnss3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libxshmfence1

# 2. Установка официального Google Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb || sudo apt -f install -y
rm google-chrome-stable_current_amd64.deb

# 3. Проверка версии Chrome
google-chrome --version
```

---

## 2. Установка Node.js (v20 или v22)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

---

## 3. Развертывание проекта

Клонируйте репозиторий или скопируйте файлы на сервер (например, в `/opt/tg-shopper-bot`):

```bash
cd /opt/tg-shopper-bot
npm install --omit=dev
```

### Настройка `.env`
Создайте файл `.env`:
```env
BOT_TOKEN=ваш_токен_телеграм_бота
DATABASE_PATH=./data/tracker.db
CHECK_INTERVAL_CRON=*/30 * * * *
DEMO_MODE=false
```

---

## 4. Перенос Ozon кук сессии (`data/ozon-cookies.json`)

На сервере без экрана капчу решить интерактивно нельзя, поэтому куки сессии (с токеном `abt_data`) передаются с локального компьютера:

**Способ 1: Скопировать готовый файл с ПК на сервер (через SCP)**
```bash
scp ./data/ozon-cookies.json user@ip_сервера:/opt/tg-shopper-bot/data/
```

**Способ 2: Через команду импорта (если у вас есть строка Cookie из браузера ПК)**
```bash
npm run import-cookies "__Secure-access-token=...; abt_data=..."
```

---

## 5. Запуск в фоновом режиме (24/7)

### Вариант А: Через PM2 (рекомендуется)

```bash
sudo npm install -g pm2
pm2 start src/index.js --name tg-shopper-bot
pm2 save
pm2 startup
```

Управление ботом:
* Логи: `pm2 logs tg-shopper-bot`
* Перезапуск: `pm2 restart tg-shopper-bot`
* Статус: `pm2 status`

### Вариант Б: Через Systemd Service

Создайте файл службы:
```bash
sudo nano /etc/systemd/system/tg-shopper-bot.service
```

Вставьте конфигурацию:
```ini
[Unit]
Description=Telegram Ozon Price Tracker Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/tg-shopper-bot
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Активируйте службу:
```bash
sudo systemctl daemon-reload
sudo systemctl enable tg-shopper-bot
sudo systemctl start tg-shopper-bot
sudo journalctl -u tg-shopper-bot -f
```

---

## Как это устроено внутри

1. В коде [`src/services/ozonParserService.js`](file:///home/fulliton/work/tg-shopper-bot/src/services/ozonParserService.js) настроен автоматический детект дисплея:
   * Если переменная `$DISPLAY` отсутствует (как на VPS), библиотека `puppeteer-real-browser` автоматически поднимает виртуальный Xvfb-буфер `1920x1080x24` в оперативной памяти.
   * Google Chrome запускается внутри этого буфера с настоящим разрешением экрана, WebGL и холстом.
2. Ozon не видит признаков headless-режима и возвращает данные через быстрый `entrypoint-api` за 2-3 секунды.
