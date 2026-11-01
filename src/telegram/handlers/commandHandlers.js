const { productService, trackingService, subscriptionService, analogueService } = require('../../services');
const {
  welcomeMessage,
  helpMessage,
  emptyListMessage,
  settingsMessage,
  productListMenuMessage,
  analogsResultMessage,
  analogsNotFoundMessage,
} = require('../messages');
const { mainMenuKeyboard, settingsKeyboard, productListKeyboard, analogsListKeyboard } = require('../keyboards');
const { withChatAction, safeEditMessage } = require('../utils/chatActions');
const { formatPrice, escapeHtml } = require('../../utils/formatters');
const { isOzonUrl, extractOzonSku, extractUrlFromText } = require('../../utils/urlParser');

const ITEMS_PER_PAGE = 5;

/**
 * Renders or in-place edits the user's paginated product list
 * @param {import('telegraf').Context} ctx
 * @param {number} userId
 * @param {number} page
 * @param {boolean} isEdit
 */
async function renderProductListPage(ctx, userId, page = 1, isEdit = false) {
  const products = await productService.getUserProducts(userId);

  if (products.length === 0) {
    if (isEdit) {
      return safeEditMessage(ctx, emptyListMessage(), {
        parse_mode: 'HTML',
      });
    }
    return ctx.reply(emptyListMessage(), {
      parse_mode: 'HTML',
      ...mainMenuKeyboard,
    });
  }

  const totalPages = Math.max(1, Math.ceil(products.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageProducts = products.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const text = productListMenuMessage(pageProducts, currentPage, totalPages, products.length);
  const keyboard = productListKeyboard(pageProducts, currentPage, totalPages);

  if (isEdit) {
    return safeEditMessage(ctx, text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  }

  return ctx.reply(text, {
    parse_mode: 'HTML',
    ...keyboard,
  });
}

/**
 * Registers all bot command handlers
 * @param {import('telegraf').Telegraf} bot
 */
function registerCommandHandlers(bot) {
  // /start
  bot.start(async (ctx) => {
    const name = ctx.from?.first_name || 'друг';
    await ctx.reply(welcomeMessage(name), {
      parse_mode: 'HTML',
      ...mainMenuKeyboard,
    });
  });

  // /help
  bot.help(async (ctx) => {
    await ctx.reply(helpMessage(), {
      parse_mode: 'HTML',
      ...mainMenuKeyboard,
    });
  });

  bot.hears('ℹ️ Помощь', async (ctx) => {
    await ctx.reply(helpMessage(), {
      parse_mode: 'HTML',
    });
  });

  // /settings and "⚙️ Настройки"
  const handleSettings = async (ctx) => {
    const userId = ctx.from.id;
    const settings = await subscriptionService.getUserSettings(userId);
    await ctx.reply(settingsMessage(settings), {
      parse_mode: 'HTML',
      ...settingsKeyboard(settings),
    });
  };

  bot.command('settings', handleSettings);
  bot.hears('⚙️ Настройки', handleSettings);

  // /list and "📦 Мои товары"
  const handleList = async (ctx) => {
    const userId = ctx.from.id;
    await renderProductListPage(ctx, userId, 1, false);
  };

  bot.command('list', handleList);
  bot.hears('📦 Мои товары', handleList);

  // /check and "🔄 Проверить цены"
  const handleCheck = async (ctx) => {
    await withChatAction(ctx, 'typing', async () => {
      const statusMsg = await ctx.reply('🔄 <i>Запускаю проверку цен через Puppeteer... Пожалуйста, подождите.</i>', {
        parse_mode: 'HTML',
      });

      try {
        const result = await trackingService.checkAllProducts(bot);
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          null,
          `✅ <b>Проверка цен завершена!</b>\n━━━━━━━━━━━━━━━━━━━━━\nВсего проверено товаров: <b>${result.checked}</b>\nОбнаружено изменений цен: <b>${result.updated}</b>`,
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          null,
          `⚠️ Ошибка при выполнении проверки: ${err.message}`
        );
      }
    });
  };

  bot.command('check', handleCheck);
  bot.hears('🔄 Проверить цены', handleCheck);

  // /analogs <запрос или ссылка>
  bot.command('analogs', async (ctx) => {
    const text = ctx.message.text.replace(/^\/analogs\s*/i, '').trim();

    if (!text) {
      return ctx.reply(
        'ℹ️ <b>Как искать аналоги и похожие товары:</b>\n━━━━━━━━━━━━━━━━━━━━━\n' +
        '1. Отправьте команду с запросом: <code>/analogs наушники sony</code>\n' +
        '2. Или нажмите кнопку <b>«💡 🔍 Аналоги и похожие товары»</b> в карточке любого товара из /list!',
        { parse_mode: 'HTML' }
      );
    }

    await withChatAction(ctx, 'typing', async () => {
      try {
        let referencePrice = null;
        let query = text;

        if (isOzonUrl(text)) {
          const rawUrl = extractUrlFromText(text);
          const skuInfo = await extractOzonSku(rawUrl);
          if (skuInfo) {
            const existing = await productService.getProductBySku(skuInfo.sku);
            if (existing) {
              const res = await analogueService.findAnalogsForProduct(existing.id, 3);
              if (res.analogs.length === 0) {
                return ctx.reply(analogsNotFoundMessage(res.originalProduct, res.query), { parse_mode: 'HTML' });
              }
              return ctx.reply(analogsResultMessage(res.originalProduct, res.analogs, res.query), {
                parse_mode: 'HTML',
                ...analogsListKeyboard(existing.id, res.analogs, 1),
              });
            }
          }
        }

        const analogs = await analogueService.findAnalogsByQuery(query, referencePrice, 3);
        if (analogs.length === 0) {
          return ctx.reply('⚠️ По вашему запросу не найдено подходящих аналогов и похожих товаров на Ozon.');
        }

        let replyText = `💡 <b>Аналоги и похожие товары по запросу «${escapeHtml(query)}»:</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        analogs.forEach((item, idx) => {
          const num = idx + 1;
          const title = item.title.length > 50 ? `${item.title.slice(0, 47)}...` : item.title;
          replyText += `<b>${num}.</b> <a href="${escapeHtml(item.url)}">${escapeHtml(title)}</a>\n`;
          replyText += `   💰 <b>Цена:</b> ${formatPrice(item.effectivePrice)}\n\n`;
        });
        replyText += `━━━━━━━━━━━━━━━━━━━━━\n<i>💡 Перейдите по ссылкам или отправьте ссылку на товар боту, чтобы начать отслеживание!</i>`;

        await ctx.reply(replyText, {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        });
      } catch (err) {
        console.error('[CommandHandler] Ошибка /analogs:', err.message);
        await ctx.reply(`⚠️ Ошибка поиска: ${err.message}`);
      }
    });
  });
}

module.exports = {
  registerCommandHandlers,
  renderProductListPage,
};
