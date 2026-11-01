# 🤖 Инструкция для Агента: Директория `src/utils`

## Назначение
Директория `src/utils` содержит чистые вспомогательные функции без побочных эффектов: форматирование валюты и дат, валидацию и парсинг URL Ozon, экранирование HTML.

## Файлы
- [`urlParser.js`](file:///home/fulliton/work/tg-shopper-bot/src/utils/urlParser.js):
  - `isOzonUrl(text)`: Проверяет регулярным выражением, относится ли ссылка к Ozon (`ozon.ru`, `ozon.onelink.me`).
  - `extractUrlFromText(text)`: Извлекает первый валидный URL из произвольного текста пользователя.
  - `resolveRedirectUrl(url)`: Раскрывает короткие ссылки (`ozon.ru/t/...`, `onelink.me`) через HTTP HEAD/GET редиректы.
  - `extractOzonSku(url)`: Извлекает уникальный артикул (SKU) товара и строит канонический URL вида `https://www.ozon.ru/product/<sku>/`.
- [`formatters.js`](file:///home/fulliton/work/tg-shopper-bot/src/utils/formatters.js):
  - `formatPrice(price)`: Форматирует число в строку вида `1 440 ₽`.
  - `formatPriceDiff(oldPrice, newPrice)`: Рассчитывает абсолютную и относительную разницу в ценах со стрелочками (`📉` / `📈`).
  - `formatDate(date)`: Форматирует дату в локализованный читаемый вид (`DD.MM.YYYY HH:mm:ss`).
  - `escapeHtml(text)`: Безопасное экранирование спецсимволов HTML (`&`, `<`, `>`, `"`, `'`).
- [`keywordExtractor.js`](file:///home/fulliton/work/tg-shopper-bot/src/utils/keywordExtractor.js):
  - `extractSearchKeywords(title, maxWords)`: Очищает спам-заголовки от маркетинговых стоп-слов («скидка», «новинка», «подарок», «хит») и извлекает компактную поисковую суть для нахождения аналогов.
- [`index.js`](file:///home/fulliton/work/tg-shopper-bot/src/utils/index.js): Экспорт всех утилит.

## Правила для Агента
1. Функции в `src/utils` должны оставаться чистыми и не иметь зависимостей от базы данных, репозиториев или сервисов.
2. При добавлении новых форматов ссылок Ozon тестируйте регулярные выражения в `urlParser.js` через `test/testParser.js`.
