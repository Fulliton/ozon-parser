# 🤖 Инструкция для Агента: Директория `src/services`

## Назначение
Директория `src/services` содержит бизнес-логику приложения. Сервисы координируют работу репозиториев, парсера Puppeteer, Telegram-бота и фонового планировщика.

## Файлы
- [`ozonParserService.js`](file:///home/fulliton/work/tg-shopper-bot/src/services/ozonParserService.js):
  - Парсер Ozon на базе `puppeteer-extra` и `puppeteer-extra-plugin-stealth`.
  - Автоматически находит установленный бинарник Google Chrome (`/usr/bin/google-chrome`).
  - Поддерживает проксирование (`PROXY_URL`) с авторизацией.
  - Извлекает: цену с Ozon Картой (зелёный бейдж), регулярную цену, название, обложку и статус наличия.
  - Содержит демо-режим `getDemoProduct()` для локального тестирования без сетевых блокировок.
  - Управляет жизненным циклом браузера (shared browser + авто-закрытие при бездействии).
- [`productService.js`](file:///home/fulliton/work/tg-shopper-bot/src/services/productService.js):
  - Метод `trackProduct(userId, text)`: валидирует ссылку Ozon, запускает парсинг Puppeteer, сохраняет товар через `productRepository.upsert`, привязывает пользователя через `subscriptionRepository.subscribe` и возвращает результат.
  - Предоставляет методы получения товаров пользователя.
- [`subscriptionService.js`](file:///home/fulliton/work/tg-shopper-bot/src/services/subscriptionService.js):
  - Управление подписками: отписка от товара, проверка статуса подписки, получение списка подписчиков.
- [`notificationService.js`](file:///home/fulliton/work/tg-shopper-bot/src/services/notificationService.js):
  - Формирует и отправляет алерты подписчикам об изменении цен в Telegram.
- [`trackingService.js`](file:///home/fulliton/work/tg-shopper-bot/src/services/trackingService.js):
  - Запускает фоновый планировщик `node-cron` по расписанию `CHECK_INTERVAL_CRON` (по умолчанию `*/30 * * * *` — раз в 30 минут).
  - Метод `checkAllProducts(bot)`: обходит все отслеживаемые товары, перепарсивает цены, обновляет `lastParsedAt`, а при изменении стоимости рассылает алерты через `notificationService`.
- [`analogueService.js`](file:///home/fulliton/work/tg-shopper-bot/src/services/analogueService.js):
  - Интеллектуальный поиск более дешевых аналогов и похожих товаров для экономии бюджета клиента.
  - Выполняет поиск напрямую по названию самого товара (с очисткой лишь технических скобок вроде SKU).
  - Рассчитывает экономию в рублях и процентах, ранжирует по максимальной выгоде.
- [`chartService.js`](file:///home/fulliton/work/tg-shopper-bot/src/services/chartService.js):
  - Генерация графиков динамики цен через QuickChart API.
- [`index.js`](file:///home/fulliton/work/tg-shopper-bot/src/services/index.js): Единая точка экспорта всех сервисов.

## Правила для Агента
1. Сервисы не обращаются к БД напрямую — только через `src/repositories`.
2. При парсинге страниц через Puppeteer всегда используйте блок `try ... finally { await page.close(); }`, чтобы не вызывать утечки памяти на сервере.
3. Обязательно передавайте текущую цену в парсер при демо-режиме, чтобы генерировать реалистичные изменения цен для тестов.
