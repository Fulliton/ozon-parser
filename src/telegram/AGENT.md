# 🤖 Инструкция для Агента: Директория `src/telegram`

## Назначение
Директория `src/telegram` содержит код взаимодействия с пользователем через Telegram Bot API на базе библиотеки `telegraf`.

## Файлы
- [`bot.js`](file:///home/fulliton/work/tg-shopper-bot/src/telegram/bot.js): Инициализирует экземпляр `Telegraf`, регистрирует глобальные обработчики ошибок и подключает обработчики событий.
- [`keyboards.js`](file:///home/fulliton/work/tg-shopper-bot/src/telegram/keyboards.js): Главное меню (Reply Keyboard), интерактивная пагинация каталога товаров, карточка товара с возвратом назад, кнопки поиска аналогов (`find_analogs`) и тумблеры настроек.
- [`messages.js`](file:///home/fulliton/work/tg-shopper-bot/src/telegram/messages.js): HTML-шаблоны приветствия, справки, каталога товаров с пагинацией, карточки товара (с разделителями, бейджами, прогрессом до порога и временем парсинга), результаты поиска более дешевых аналогов и расчет выгоды.
- [`utils/chatActions.js`](file:///home/fulliton/work/tg-shopper-bot/src/telegram/utils/chatActions.js): Утилиты циклического поддержания статуса активности (`withChatAction`) и безопасного редактирования сообщений (`safeEditMessage`).
- `handlers/`: Папка с разделенными обработчиками команд, текстовых сообщений и callback-кнопок.
- [`index.js`](file:///home/fulliton/work/tg-shopper-bot/src/telegram/index.js): Экспорт функции `createBot` и сопутствующих модулей.

## Правила для Агента
1. Обработчики не должны выполнять сложную логику — они делегируют выполнение задач соответствующим сервисам из `src/services`.
2. Все сообщения с форматированием используют `parse_mode: 'HTML'`.
3. В шаблонах сообщений обязательно экранируйте пользовательский ввод через `escapeHtml()`.
4. В карточках товаров обязательно выводите дату последнего парсинга (`product.lastParsedAt || product.lastCheckedAt`) в относительном формате (`formatRelativeTime`).
5. Для предотвращения спама в чате используйте редактирование сообщений на лету через `safeEditMessage` вместо отправки новых сообщений.
6. Длительные операции (парсинг, графики, проверка цен) обязательно оборачивайте в `withChatAction(ctx, 'typing' | 'upload_photo', ...)`.
