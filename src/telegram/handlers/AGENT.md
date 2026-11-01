# 🤖 Инструкция для Агента: Директория `src/telegram/handlers`

## Назначение
Директория `src/telegram/handlers` содержит специализированные обработчики событий бота, сгруппированные по типу взаимодействия.

## Файлы
- [`commandHandlers.js`](file:///home/fulliton/work/tg-shopper-bot/src/telegram/handlers/commandHandlers.js):
  - `/start` — приветственное сообщение и главное меню.
  - `/help` и кнопка `ℹ️ Помощь` — справка по возможностям бота.
  - `/list` и кнопка `📦 Мои товары` — отображение интерактивного каталога товаров с пагинацией (`renderProductListPage`).
  - `/check` и кнопка `🔄 Проверить цены` — принудительный запуск сканирования цен через Puppeteer с непрерывным статусом `typing`.
  - `/settings` и кнопка `⚙️ Настройки` — интерактивные тумблеры фильтрации.
- [`messageHandlers.js`](file:///home/fulliton/work/tg-shopper-bot/src/telegram/handlers/messageHandlers.js):
  - Перехватывает текстовые сообщения.
  - Обрабатывает ввод желаемой цены (состояние `target_price`).
  - Проверяет через `isOzonUrl()`, является ли текст ссылкой на Ozon.
  - Оборачивает парсинг в `withChatAction('typing')`, отображает статус и итоговую премиум-карточку.
- [`actionHandlers.js`](file:///home/fulliton/work/tg-shopper-bot/src/telegram/handlers/actionHandlers.js):
  - Пагинация каталога: `list_page:<page>`.
  - Просмотр карточки на лету: `view_prod:<productId>:<page>` и возврат: `back_to_list:<page>`.
  - Мгновенный перепарсинг товара на лету: `refresh_prod:<productId>:<page>`.
  - Обработка графика цен с индикатором `upload_photo`: `chart:<productId>`.
  - Задание и сброс порога цены: `target:<productId>`, `target_clear:<productId>`.
  - Отписка: `unsub:<productId>`.
  - Переключение настроек: `toggle_drops`, `toggle_card`.
- [`index.js`](file:///home/fulliton/work/tg-shopper-bot/src/telegram/handlers/index.js): Функция `registerHandlers(bot)`, подключающая все обработчики к боту.

## Правила для Агента
1. Каждый тип обработчиков хранится в своем файле. Не смешивайте обработку inline-кнопок и команд в одном месте.
2. При длительных операциях (парсинг страницы, опрос товаров, генерация графиков) обязательно используйте `withChatAction` для постоянного отображения статуса в заголовке чата.
3. Все переходы внутри каталога товаров и карточек выполняйте на лету через `safeEditMessage` без отправки новых сообщений.
