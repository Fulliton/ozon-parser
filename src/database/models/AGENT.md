# 🤖 Инструкция для Агента: Директория `src/database/models`

## Назначение
Директория `src/database/models` содержит описание моделей **Sequelize ORM** и их связей (ассоциаций).

## Файлы
- [`product.js`](file:///home/fulliton/work/tg-shopper-bot/src/database/models/product.js): Модель товара `Product`.
  - `id`: Первичный ключ (INTEGER, autoIncrement).
  - `sku`: Уникальный артикул Ozon (STRING, unique).
  - `url`: Каноническая ссылка на товар (TEXT).
  - `title`: Название товара (STRING).
  - `currentPrice`: Актуальная цена в рублях (FLOAT, колонка `current_price`).
  - `oldPrice`: Старая цена до скидки / цена без карты (FLOAT, колонка `old_price`).
  - `cardPrice`: Специальная цена по Ozon Карте / с банками (FLOAT, колонка `card_price`).
  - `imageUrl`: Ссылка на обложку товара (TEXT, колонка `image_url`).
  - `inStock`: Флаг наличия (BOOLEAN, колонка `in_stock`).
  - `lastCheckedAt`: Время последней проверки (DATE, колонка `last_checked_at`).
  - `lastParsedAt`: Время последнего парсинга страницы Puppeteer (DATE, колонка `last_parsed_at`).
  - `createdAt`, `updatedAt`: Автоматические временные метки Sequelize.
- [`subscription.js`](file:///home/fulliton/work/tg-shopper-bot/src/database/models/subscription.js): Модель подписки `Subscription`.
  - `userId`: Telegram ID пользователя (BIGINT, колонка `user_id`).
  - `productId`: ID товара (INTEGER, колонка `product_id`).
- [`priceHistory.js`](file:///home/fulliton/work/tg-shopper-bot/src/database/models/priceHistory.js): Модель истории цен `PriceHistory`.
  - `productId`: ID товара (INTEGER, колонка `product_id`).
  - `price`: Цена на момент записи (FLOAT).
  - `cardPrice`: Цена по карте (FLOAT, nullable, колонка `card_price`).
  - `recordedAt`: Время фиксации снимка цены (DATE, колонка `recorded_at`).
- [`index.js`](file:///home/fulliton/work/tg-shopper-bot/src/database/models/index.js): Функция `initModels(sequelize)` — инициализирует все модели и настраивает ассоциации:
  - `Product.hasMany(Subscription, { as: 'subscriptions', onDelete: 'CASCADE' })`
  - `Subscription.belongsTo(Product, { as: 'product' })`
  - `Product.hasMany(PriceHistory, { as: 'priceHistory', onDelete: 'CASCADE' })`
  - `PriceHistory.belongsTo(Product, { as: 'product' })`

## Правила для Агента
1. В коде моделей и репозиториев используются camelCase свойства (`lastParsedAt`, `currentPrice`), которые автоматически маппятся на snake_case имена колонок таблицы с помощью опции `field: '...'`.
2. При добавлении или изменении полей модели обязательно создавайте соответствующий файл миграции в `src/database/migrations/`.
