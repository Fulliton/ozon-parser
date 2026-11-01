# 🤖 Инструкция для Агента: Директория `src/repositories`

## Назначение
Директория `src/repositories` реализует шаблон **Repository Pattern** поверх Sequelize ORM.
Это **единственный слой** в приложении, которому разрешено выполнять чтение, вставку, изменение и удаление записей в базе данных.

## Файлы
- [`baseRepository.js`](file:///home/fulliton/work/tg-shopper-bot/src/repositories/baseRepository.js): Базовый класс, предоставляющий доступ к инстансу Sequelize и объекту моделей `models`.
- [`productRepository.js`](file:///home/fulliton/work/tg-shopper-bot/src/repositories/productRepository.js):
  - `findById(id)`: Поиск товара по первичному ключу.
  - `findBySku(sku)`: Поиск товара по артикулу Ozon.
  - `upsert(productData)`: Создает или обновляет товар, записывает снимок в `price_history` и проставляет `lastParsedAt`.
  - `updatePrice(id, newPrice, newCardPrice)`: Обновляет цену товара, создает запись в истории и обновляет `lastParsedAt`.
  - `updateLastParsed(id)`: Обновляет метку времени последнего парсинга (`lastParsedAt` и `lastCheckedAt`).
  - `getAllTracked()`: Выбирает уникальные товары с активными подписчиками через ассоциацию `subscriptions`.
  - `delete(id)`
- [`subscriptionRepository.js`](file:///home/fulliton/work/tg-shopper-bot/src/repositories/subscriptionRepository.js):
  - `subscribe(userId, productId)`: Добавляет подписку (через `findOrCreate`, исключая дубликаты).
  - `unsubscribe(userId, productId)`: Удаляет подписку пользователя.
  - `isSubscribed(userId, productId)`: Проверяет наличие подписки.
  - `getUserProducts(userId)`: Возвращает список товаров пользователя с включенными данными товара и датой подписки.
  - `getSubscribersByProductId(productId)`: Возвращает массив Telegram ID подписчиков товара.
- [`priceHistoryRepository.js`](file:///home/fulliton/work/tg-shopper-bot/src/repositories/priceHistoryRepository.js):
  - `addRecord(productId, price, cardPrice)`: Добавляет запись в историю цен.
  - `getByProductId(productId, limit)`: История цен, отсортированная от новых к старым (`order: [['id', 'DESC']]`).
- [`index.js`](file:///home/fulliton/work/tg-shopper-bot/src/repositories/index.js): Экспорт готовых синглтонов репозиториев.

## Строгие правила для Агента
1. **Всё взаимодействие с БД — ТОЛЬКО через репозитории**. Никаких прямых вызовов `Product.create()` или `sequelize.query()` вне этого каталога.
2. Методы репозиториев возвращают чистые JavaScript объекты (`toJSON()`), чтобы внешний код сервисов не зависел от инстансов моделей Sequelize.
3. При обновлении цен всегда использовать `productRepository.updatePrice` или `productRepository.updateLastParsed`, чтобы актуализировать `lastParsedAt`.
