# Руководство по развертыванию на сервере (Docker / VPS / Ubuntu / Debian)

На виртуальном сервере (VPS) нет физического монитора и графической оболочки (GUI). 
Так как Ozon блокирует стандартный режим `headless`, бот использует связку **Google Chrome + Xvfb** (виртуальный дисплей в оперативной памяти). Для защиты Ozon браузер выглядит как реальный компьютер с монитором 1920x1080.

---

## 🐳 Способ 1: Развертывание в Docker (Рекомендуемый)

Docker-образ уже содержит все необходимые системные зависимости: официальный Google Chrome, виртуальный дисплей Xvfb, русские шрифты, `dumb-init` для защиты от процессов-зомби и Node.js 20.

### 1. Подготовка на сервере
Склонируйте репозиторий на сервер:
```bash
git clone <URL_РЕПОЗИТОРИЯ> /opt/tg-shopper-bot
cd /opt/tg-shopper-bot
```

### 2. Настройка окружения (`.env`)
Создайте файл `.env`:
```bash
cp .env.example .env
nano .env
```
Укажите ваш `BOT_TOKEN`:
```env
BOT_TOKEN=123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ
CHECK_INTERVAL_CRON=*/30 * * * *
DATABASE_PATH=./data/tracker.db
DEMO_MODE=false
```

### 3. Перенос Ozon кук (`data/ozon-cookies.json`)
Ozon требует сессионные куки для обхода антибот-проверки. 
Поскольку том `./data` смонтирован в контейнер, вы можете просто положить файл с куками в папку `./data/`:

* **Вариант А (Скопировать файл с локального ПК через SCP):**
  ```bash
  scp ./data/ozon-cookies.json user@ip_сервера:/opt/tg-shopper-bot/data/
  ```

* **Вариант Б (Импорт через команду из строки Cookie):**
  ```bash
  docker compose run --rm bot npm run import-cookies "__Secure-access-token=...; abt_data=..."
  ```

### 4. Сборка и запуск контейнера
```bash
# Сборка и запуск в фоновом режиме
docker compose up -d --build
```

### Полезные команды Docker:
* **Просмотр логов в реальном времени:**
  ```bash
  docker compose logs -f bot
  ```
* **Перезапуск бота:**
  ```bash
  docker compose restart bot
  ```
* **Остановка контейнера:**
  ```bash
  docker compose down
  ```
* **Обновление бота после `git pull`:**
  ```bash
  git pull
  docker compose up -d --build
  ```

---

## 💻 Способ 2: Классическое развертывание на хосте (без Docker)

Если вы предпочитаете запускать бота напрямую в системе без Docker:

### 1. Установка системных зависимостей

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

### 2. Установка Node.js (v20 или v22)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### 3. Установка зависимостей проекта

```bash
cd /opt/tg-shopper-bot
npm install --omit=dev
```

### 4. Запуск в фоновом режиме (24/7) через PM2

```bash
sudo npm install -g pm2
pm2 start src/index.js --name tg-shopper-bot
pm2 save
pm2 startup
```

---

## ⚙️ Как устроен парсинг Ozon внутри

1. В коде [`src/services/ozonParserService.js`](file:///home/fulliton/work/tg-shopper-bot/src/services/ozonParserService.js) настроен автоматический детект дисплея:
   * Если переменная `$DISPLAY` отсутствует (как на VPS / в Docker), библиотека `puppeteer-real-browser` автоматически поднимает виртуальный Xvfb-буфер `1920x1080x24` в оперативной памяти.
   * Google Chrome запускается внутри этого буфера с настоящим разрешением экрана, WebGL и холстом.
2. Ozon не видит признаков headless-режима и возвращает данные через быстрый `entrypoint-api` за 2-3 секунды.
3. База данных SQLite (`tracker.db`) и куки Ozon сохраняются в смонтированной директории `./data/`, благодаря чему данные не теряются при перезапусках контейнера.
