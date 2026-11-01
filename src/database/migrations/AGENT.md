# 🤖 Инструкция для Агента: Директория `src/database/migrations`

## Назначение
Директория `src/database/migrations` содержит файлы миграций базы данных, управляемые через **Umzug** (официальный инструмент миграций для Sequelize).
Каждая миграция выполняется ровно один раз. Выполненные миграции фиксируются в служебной таблице `SequelizeMeta`.

## Файлы миграций
- [`20261101000001-create-products.js`](file:///home/fulliton/work/tg-shopper-bot/src/database/migrations/20261101000001-create-products.js): Создание таблицы `products` со всеми полями, включая `last_parsed_at`, `last_checked_at`, а также индекса по `sku`.
- [`20261101000002-create-subscriptions.js`](file:///home/fulliton/work/tg-shopper-bot/src/database/migrations/20261101000002-create-subscriptions.js): Создание таблицы `subscriptions` со внешним ключом на `products.id` (ON DELETE CASCADE) и уникальным составным индексом `(user_id, product_id)`.
- [`20261101000003-create-price-history.js`](file:///home/fulliton/work/tg-shopper-bot/src/database/migrations/20261101000003-create-price-history.js): Создание таблицы `price_history` со внешним ключом на `products.id` (ON DELETE CASCADE).

## Как создавать новые миграции
1. Имя файла должно начинаться с временной метки (timestamp), например:
   `YYYYMMDDHHMMSS-description.js`
2. Структура каждого файла миграции:
   ```javascript
   const { DataTypes } = require('sequelize');

   module.exports = {
     async up({ context: queryInterface }) {
       // Код наката миграции (createTable, addColumn, addIndex)
     },

     async down({ context: queryInterface }) {
       // Код отката миграции (dropTable, removeColumn, removeIndex)
     },
   };
   ```
3. При запуске бота функция `initDb()` автоматически сканирует эту директорию и накатывает все еще не примененные миграции.
