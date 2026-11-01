const { Markup } = require('telegraf');

/**
 * Main persistent Reply Keyboard
 */
const mainMenuKeyboard = Markup.keyboard([
  ['📦 Мои товары', '🔄 Проверить цены'],
  ['⚙️ Настройки', 'ℹ️ Помощь'],
]).resize();

/**
 * Inline keyboard for paginated product list
 * @param {Array<object>} products Current page products
 * @param {number} page Current page number (1-based)
 * @param {number} totalPages Total number of pages
 */
function productListKeyboard(products, page = 1, totalPages = 1) {
  const keyboard = [];

  // Row 1: Quick select item buttons: [ 1 ], [ 2 ], [ 3 ], ...
  if (products.length > 0) {
    const itemButtons = products.map((p, index) => {
      const num = (page - 1) * 5 + (index + 1);
      return Markup.button.callback(`[ ${num} ]`, `view_prod:${p.id}:${page}`);
    });
    keyboard.push(itemButtons);
  }

  // Row 2: Pagination controls
  const navRow = [];
  if (page > 1) {
    navRow.push(Markup.button.callback('⬅️ Пред.', `list_page:${page - 1}`));
  }
  navRow.push(Markup.button.callback(`📄 ${page}/${totalPages}`, `list_page:${page}`));
  if (page < totalPages) {
    navRow.push(Markup.button.callback('След. ➡️', `list_page:${page + 1}`));
  }
  if (navRow.length > 0) {
    keyboard.push(navRow);
  }

  // Row 3: Action to check prices
  keyboard.push([Markup.button.callback('🔄 Обновить все цены', 'check_all')]);

  return Markup.inlineKeyboard(keyboard);
}

/**
 * Inline keyboard for product details card
 * @param {number} productId
 * @param {string} productUrl
 * @param {boolean} hasTargetPrice
 * @param {number} returnPage Page to return to
 */
function productDetailsKeyboard(productId, productUrl, hasTargetPrice = false, returnPage = 1) {
  return Markup.inlineKeyboard([
    [Markup.button.url('🔗 Открыть на Ozon', productUrl)],
    [Markup.button.callback('💡 🔍 Аналоги и похожие товары', `find_analogs:${productId}:${returnPage}`)],
    [Markup.button.callback('🔄 Обновить цену сейчас', `refresh_prod:${productId}:${returnPage}`)],
    [
      Markup.button.callback(
        hasTargetPrice ? '🎯 Изменить порог' : '🎯 Задать порог',
        `target:${productId}:${returnPage}`
      ),
      Markup.button.callback('📈 График цен', `chart:${productId}:${returnPage}`),
    ],
    [Markup.button.callback('❌ Удалить из отслеживания', `unsub:${productId}:${returnPage}`)],
    [Markup.button.callback('◀️ Назад к списку товаров', `back_to_list:${returnPage}`)],
  ]);
}

/**
 * Inline buttons under product card (used when tracking newly added product)
 * @param {number} productId
 * @param {string} productUrl
 * @param {boolean} hasTargetPrice
 */
function productActionsKeyboard(productId, productUrl, hasTargetPrice = false) {
  return Markup.inlineKeyboard([
    [Markup.button.url('🔗 Открыть на Ozon', productUrl)],
    [Markup.button.callback('💡 🔍 Аналоги и похожие товары', `find_analogs:${productId}:1`)],
    [
      Markup.button.callback('🔄 Обновить цену', `refresh_prod:${productId}:1`),
      Markup.button.callback('📈 График цен', `chart:${productId}:1`),
    ],
    [
      Markup.button.callback(
        hasTargetPrice ? '🎯 Изменить порог' : '🎯 Задать порог',
        `target:${productId}:1`
      ),
      Markup.button.callback('❌ Отписаться', `unsub:${productId}:1`),
    ],
  ]);
}

/**
 * Inline keyboard when prompting user for target price
 * @param {number} productId
 * @param {boolean} hasTargetPrice
 * @param {number} returnPage
 */
function targetPromptKeyboard(productId, hasTargetPrice = false, returnPage = 1) {
  const buttons = [];
  if (hasTargetPrice) {
    buttons.push([Markup.button.callback('🗑 Сбросить порог цены', `target_clear:${productId}:${returnPage}`)]);
  }
  buttons.push([Markup.button.callback('❌ Отмена', `cancel_prompt:${returnPage}`)]);
  return Markup.inlineKeyboard(buttons);
}

/**
 * Inline keyboard for user settings
 * @param {{ notifyOnlyDrops: boolean, useOzonCard: boolean }} settings
 */
function settingsKeyboard(settings) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        `📉 Только снижение: ${settings.notifyOnlyDrops ? 'ВКЛ 🟢' : 'ВЫКЛ ⚪️'}`,
        'toggle_drops'
      ),
    ],
    [
      Markup.button.callback(
        `💳 Ozon Карта: ${settings.useOzonCard ? 'ВКЛ 🟢' : 'ВЫКЛ ⚪️'}`,
        'toggle_card'
      ),
    ],
  ]);
}

/**
 * Inline button for removing a product
 * @param {number} productId
 * @param {number} returnPage
 */
function removeOnlyKeyboard(productId, returnPage = 1) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('◀️ Вернуться к списку товаров', `back_to_list:${returnPage}`)],
  ]);
}

/**
 * Inline keyboard for list of found cheaper analogues
 * @param {number} productId
 * @param {Array<Object>} analogs
 * @param {number} returnPage
 */
function analogsListKeyboard(productId, analogs = [], returnPage = 1) {
  const keyboard = [];

  analogs.forEach((a, idx) => {
    const num = idx + 1;
    keyboard.push([
      Markup.button.url(`🔗 №${num} (-${a.savingsPercent}%)`, a.url),
      Markup.button.callback(`➕ Отслеживать №${num}`, `track_analog:${a.sku}:${returnPage}:${productId}`),
    ]);
  });

  keyboard.push([Markup.button.callback('◀️ Назад к товару', `view_prod:${productId}:${returnPage}`)]);

  return Markup.inlineKeyboard(keyboard);
}

module.exports = {
  mainMenuKeyboard,
  productListKeyboard,
  productDetailsKeyboard,
  productActionsKeyboard,
  analogsListKeyboard,
  targetPromptKeyboard,
  settingsKeyboard,
  removeOnlyKeyboard,
};
