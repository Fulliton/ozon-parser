const {
  formatPrice,
  formatPriceDiff,
  escapeHtml,
  formatDate,
  formatRelativeTime,
  formatTargetProgress,
} = require('../utils/formatters');

function welcomeMessage(firstName = 'пользователь') {
  return `👋 <b>Привет, ${escapeHtml(firstName)}!</b>
━━━━━━━━━━━━━━━━━━━━━
Я твой личный бот-помощник для мониторинга цен на <b>Ozon</b>.

🎯 <b>Как мной пользоваться:</b>
1. <b>Отправь ссылку</b> на любой товар Ozon (из приложения или браузера).
2. Бот мгновенно сохранит товар и начнет отслеживать динамику стоимости.
3. Нажми <b>«🎯 Задать порог»</b>, чтобы получить алерт, когда цена упадет до желаемой.
4. Нажми <b>«📈 График цен»</b> для визуализации всей истории изменения цен.

📌 <b>Быстрые команды:</b>
/list — интерактивный каталог ваших товаров
/check — запустить ручную проверку всех цен
/settings — персональные фильтры уведомлений
/help — подробная справка`;
}

function helpMessage() {
  return `ℹ️ <b>Справка и возможности бота</b>
━━━━━━━━━━━━━━━━━━━━━
• <b>Добавление товара:</b>
  Просто отправь ссылку вида <code>https://www.ozon.ru/product/...</code> или короткую <code>https://ozon.ru/t/...</code> прямо в этот чат.

• <b>Интерактивный каталог (/list):</b>
  Все ваши товары собраны в одном сообщении с удобными кнопками страниц <code>⬅️</code> <code>➡️</code> и быстрым просмотром любого товара без спама в чат.

• <b>Обновление цены на лету:</b>
  В карточке товара доступна кнопка <b>«🔄 Обновить цену»</b> — бот моментально обратится к Ozon и обновит стоимость прямо в сообщении.

• <b>Желаемая цена (Целевой порог):</b>
  Задайте сумму, за которую готовы купить товар. Бот пришлет специальный алерт с поздравлением, как только цена достигнет или упадет ниже этой планки!

• <b>Графики стоимости:</b>
  Кнопка <b>«📈 График цен»</b> строит наглядный график динамики с историей обычной цены и цены по Ozon Карте.

• <b>Аналоги и похожие товары:</b>
  Кнопка <b>«💡 🔍 Аналоги и похожие товары»</b> в карточке товара находит варианты с лучшей ценой на маркетплейсе, рассчитывает сумму и процент выгоды и позволяет в 1 клик переключиться на более выгодное предложение.

• <b>Настройки (/settings):</b>
  Фильтр «Только снижение цен» исключает уведомления о росте стоимости, а переключатель «Ozon Карта» позволяет отслеживать скидки по фирменной карте.`;
}

function productTrackedMessage(product) {
  const priceText = formatPrice(product.currentPrice);
  const cardPriceText = product.cardPrice ? `\n💳 <b>По Ozon Карте:</b> <b>${formatPrice(product.cardPrice)}</b>` : '';
  const parsedDate = product.lastParsedAt || product.lastCheckedAt;
  const parsedText = parsedDate ? `\n🕒 <b>Синхронизировано:</b> ${formatRelativeTime(parsedDate)}` : '';
  const targetInfo = formatTargetProgress(product.cardPrice || product.currentPrice, product.targetPrice);
  const targetText = targetInfo.text ? `\n${targetInfo.text}` : '';
  const statusBadge = product.isOutOfStock ? '🔴 <b>Нет в наличии</b>' : '🟢 <b>В наличии на складе</b>';

  return `✅ <b>Товар взят на отслеживание!</b>
━━━━━━━━━━━━━━━━━━━━━
📦 <b><a href="${escapeHtml(product.url)}">${escapeHtml(product.title)}</a></b>

💰 <b>Текущая цена:</b> <b>${priceText}</b>${cardPriceText}${targetText}
🏷 <b>Статус:</b> ${statusBadge}
🆔 <b>SKU:</b> <code>${escapeHtml(product.sku)}</code>${parsedText}
━━━━━━━━━━━━━━━━━━━━━
<i>Бот регулярно проверяет цену и пришлет алерт при изменениях!</i>`;
}

function priceAlertMessage(product, oldPrice, newPrice) {
  const diffInfo = formatPriceDiff(oldPrice, newPrice);
  const isDrop = diffInfo.direction === 'down';
  const icon = isDrop ? '📉' : '📈';
  const header = isDrop ? '🔥 <b>ЦЕНА СНИЗИЛАСЬ!</b>' : '🔔 <b>ЦЕНА ИЗМЕНИЛАСЬ</b>';

  return `${icon} ${header}
━━━━━━━━━━━━━━━━━━━━━
📦 <b><a href="${escapeHtml(product.url)}">${escapeHtml(product.title)}</a></b>

💰 <b>Было:</b> <s>${formatPrice(oldPrice)}</s>
🏷 <b>Стало:</b> <b>${formatPrice(newPrice)}</b>
📊 <b>Разница:</b> ${diffInfo.text}

🕒 <i>${formatDate(new Date())}</i>`;
}

function targetReachedAlertMessage(product, targetPrice, currentPrice) {
  return `🎉 🎯 <b>ЖЕЛАЕМАЯ ЦЕНА ДОСТИГНУТА!</b>
━━━━━━━━━━━━━━━━━━━━━
📦 <b><a href="${escapeHtml(product.url)}">${escapeHtml(product.title)}</a></b>

🏷 <b>Текущая цена:</b> <b>${formatPrice(currentPrice)}</b>
🎯 <b>Ваш целевой порог:</b> <b>${formatPrice(targetPrice)}</b>

🔥 <i>Отличный момент для покупки! Товар подешевел до вашей цели или ниже.</i>

🕒 <i>${formatDate(new Date())}</i>`;
}

function productCardMessage(product) {
  const priceText = formatPrice(product.currentPrice);
  const cardPriceText = product.cardPrice ? `\n💳 <b>По Ozon Карте:</b> <b>${formatPrice(product.cardPrice)}</b>` : '';
  const parsedDate = product.lastParsedAt || product.lastCheckedAt;
  const parsedText = parsedDate ? `\n🕒 <b>Проверено:</b> ${formatRelativeTime(parsedDate)}` : '';
  const targetInfo = formatTargetProgress(product.cardPrice || product.currentPrice, product.targetPrice);
  const targetText = targetInfo.text ? `\n${targetInfo.text}` : '';
  const statusBadge = product.isOutOfStock ? '🔴 Нет в наличии' : '🟢 В наличии';

  return `📦 <b><a href="${escapeHtml(product.url)}">${escapeHtml(product.title)}</a></b>
━━━━━━━━━━━━━━━━━━━━━
💰 <b>Цена:</b> <b>${priceText}</b>${cardPriceText}${targetText}
🏷 <b>Статус:</b> ${statusBadge}
🆔 <b>SKU:</b> <code>${escapeHtml(product.sku)}</code>${parsedText}`;
}

function productListMenuMessage(products, page = 1, totalPages = 1, totalCount = 0) {
  let text = `📦 <b>Ваши отслеживаемые товары (${totalCount})</b>\n━━━━━━━━━━━━━━━━━━━━━\n`;

  products.forEach((p, index) => {
    const num = (page - 1) * 5 + (index + 1);
    const shortTitle = p.title.length > 45 ? `${escapeHtml(p.title.slice(0, 42))}...` : escapeHtml(p.title);
    const price = formatPrice(p.currentPrice);
    const cardPrice = p.cardPrice ? ` | 💳 ${formatPrice(p.cardPrice)}` : '';
    const targetTag = p.targetPrice ? ` 🎯` : '';

    text += `<b>${num}.</b> <a href="${escapeHtml(p.url)}">${shortTitle}</a>\n`;
    text += `   💰 <b>${price}</b>${cardPrice}${targetTag}\n\n`;
  });

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📄 <i>Страница ${page} из ${totalPages}</i>\n`;
  text += `<i>💡 Нажмите кнопку с номером товара ниже, чтобы открыть подробную карточку.</i>`;

  return text;
}

function chartStatsMessage(product, stats) {
  return `📈 <b>История цен:</b> <a href="${escapeHtml(product.url)}"><b>${escapeHtml(product.title)}</b></a>
━━━━━━━━━━━━━━━━━━━━━
💰 <b>Текущая цена:</b> ${formatPrice(stats.currentPrice)}
📉 <b>Минимум:</b> ${formatPrice(stats.minPrice)}
📈 <b>Максимум:</b> ${formatPrice(stats.maxPrice)}
📊 <b>Динамика:</b> ${stats.diffText}
🔢 <b>Зафиксировано замеров:</b> ${stats.pointsCount}`;
}

function settingsMessage(settings) {
  return `⚙️ <b>Настройки уведомлений</b>
━━━━━━━━━━━━━━━━━━━━━
Нажимайте на кнопки с тумблерами ниже для мгновенной настройки:

• <b>Только снижение цен:</b>
  ${settings.notifyOnlyDrops ? '🟢 <b>ВКЛЮЧЕНО</b> (без лишних уведомлений о росте цен)' : '⚪️ <b>ВЫКЛЮЧЕНО</b> (уведомлять обо всех изменениях)'}

• <b>Учитывать цену Ozon Карты:</b>
  ${settings.useOzonCard ? '🟢 <b>ВКЛЮЧЕНО</b> (отслеживание по зеленой цене карты)' : '⚪️ <b>ВЫКЛЮЧЕНО</b> (отслеживание по обычной цене)'}
━━━━━━━━━━━━━━━━━━━━━
<i>Настройки сохраняются на лету без перезапуска.</i>`;
}

function emptyListMessage() {
  return `📭 <b>Список отслеживания пока пуст!</b>
━━━━━━━━━━━━━━━━━━━━━
Отправьте мне ссылку на любой интересующий товар <b>Ozon</b>, и я моментально добавлю его в мониторинг цен.`;
}

function analogsResultMessage(originalProduct, analogs, query = '') {
  const originalPrice = originalProduct.cardPrice || originalProduct.currentPrice;
  let text = `💡 <b>Найдены более дешевые аналоги и похожие товары!</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📦 <b>Исходный товар:</b> <a href="${escapeHtml(originalProduct.url)}">${escapeHtml(originalProduct.title)}</a>\n`;
  text += `💰 <b>Цена оригинала:</b> <b>${formatPrice(originalPrice)}</b>\n`;
  if (query) {
    text += `🔍 <i>Поисковый ключ: «${escapeHtml(query)}»</i>\n`;
  }
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  analogs.forEach((item, index) => {
    const num = index + 1;
    const itemTitle = item.title.length > 50 ? `${item.title.slice(0, 47)}...` : item.title;
    const priceText = formatPrice(item.effectivePrice);
    const cardText = item.cardPrice && item.cardPrice !== item.currentPrice ? ` (💳 ${formatPrice(item.cardPrice)})` : '';

    text += `<b>${num}.</b> <a href="${escapeHtml(item.url)}">${escapeHtml(itemTitle)}</a>\n`;
    text += `   🏷 <b>Цена:</b> <b>${priceText}</b>${cardText}\n`;
    text += `   🎉 <b>Экономия:</b> <b>${formatPrice(item.savingsRub)}</b> (<b>-${item.savingsPercent}%</b>)\n\n`;
  });

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `<i>💡 Нажмите кнопку с номером ниже, чтобы открыть карточку или сразу поставить похожий товар на отслеживание!</i>`;
  return text;
}

function analogsNotFoundMessage(originalProduct, query = '') {
  const originalPrice = originalProduct.cardPrice || originalProduct.currentPrice;
  let text = `🛡 <b>У вас лучшая цена на рынке!</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📦 <b>Товар:</b> <a href="${escapeHtml(originalProduct.url)}">${escapeHtml(originalProduct.title)}</a>\n`;
  text += `💰 <b>Текущая цена:</b> <b>${formatPrice(originalPrice)}</b>\n`;
  if (query) {
    text += `🔍 <i>Поисковый ключ: «${escapeHtml(query)}»</i>\n`;
  }
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Мы просканировали предложения маркетплейса, но более дешевых аналогов и похожих товаров не найдено.\n`;
  text += `Вы уже покупаете по максимально выгодной стоимости! 🚀`;
  return text;
}

module.exports = {
  welcomeMessage,
  helpMessage,
  productTrackedMessage,
  priceAlertMessage,
  targetReachedAlertMessage,
  productCardMessage,
  productListMenuMessage,
  chartStatsMessage,
  settingsMessage,
  emptyListMessage,
  analogsResultMessage,
  analogsNotFoundMessage,
};
