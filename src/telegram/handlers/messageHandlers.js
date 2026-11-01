const { isOzonUrl } = require('../../utils/urlParser');
const { productService, subscriptionService, ozonParserService } = require('../../services');
const { productTrackedMessage } = require('../messages');
const { productActionsKeyboard } = require('../keyboards');
const { getUserState, clearUserState } = require('./state');
const { formatPrice } = require('../../utils/formatters');
const { withChatAction } = require('../utils/chatActions');

/**
 * Registers text message handlers
 * @param {import('telegraf').Telegraf} bot
 */
function registerMessageHandlers(bot) {
  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text.trim();
    const userId = ctx.from.id;

    // 1. Check if user is in an active prompt state (e.g. entering target price)
    const state = getUserState(userId);
    if (state && state.type === 'target_price') {
      if (text.toLowerCase() === 'отмена' || text.toLowerCase() === '/cancel') {
        clearUserState(userId);
        return ctx.reply('❌ Установка желаемой цены отменена.');
      }

      const targetPrice = ozonParserService.cleanPrice(text);
      if (targetPrice && targetPrice > 0) {
        await subscriptionService.setTargetPrice(userId, state.productId, targetPrice);
        clearUserState(userId);

        return ctx.reply(
          `✅ <b>Желаемая цена установлена:</b> <b>${formatPrice(targetPrice)}</b>!\n\n` +
          `Как только цена опустится до этой отметки или ниже, бот незамедлительно пришлет вам уведомление.`,
          { parse_mode: 'HTML' }
        );
      } else {
        return ctx.reply(
          '⚠️ Пожалуйста, введите корректную сумму в рублях (например: <code>1500</code>) или напишите <b>Отмена</b>.',
          { parse_mode: 'HTML' }
        );
      }
    }

    // 2. Check if message is an Ozon URL
    if (!isOzonUrl(text)) {
      return next();
    }

    await withChatAction(ctx, 'typing', async () => {
      const waitMsg = await ctx.reply('⚡ <i>Подключаюсь к Ozon и анализирую товар...</i>', {
        parse_mode: 'HTML',
      });

      try {
        const { product } = await productService.trackProduct(userId, text);

        await ctx.telegram.editMessageText(
          ctx.chat.id,
          waitMsg.message_id,
          null,
          productTrackedMessage(product),
          {
            parse_mode: 'HTML',
            disable_web_page_preview: false,
            ...productActionsKeyboard(product.id, product.url, Boolean(product.targetPrice)),
          }
        );
      } catch (error) {
        console.error(`[Telegram] Ошибка при обработке ссылки:`, error.message);

        await ctx.telegram.editMessageText(
          ctx.chat.id,
          waitMsg.message_id,
          null,
          `❌ <b>Не удалось обработать товар</b>\n\nПричина: <i>${error.message}</i>\n\nЕсли Ozon блокирует прямые запросы от дата-центра, настройте российский <code>PROXY_URL</code> в .env или включите <code>DEMO_MODE=true</code> для тестирования бота.`,
          { parse_mode: 'HTML' }
        );
      }
    });
  });
}

module.exports = {
  registerMessageHandlers,
};
