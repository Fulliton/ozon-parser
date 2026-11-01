const { productService, subscriptionService, chartService, trackingService, analogueService } = require('../../services');
const { productRepository, priceHistoryRepository, subscriptionRepository } = require('../../repositories');
const {
  chartStatsMessage,
  settingsMessage,
  productCardMessage,
  analogsResultMessage,
  analogsNotFoundMessage,
} = require('../messages');
const {
  targetPromptKeyboard,
  settingsKeyboard,
  productDetailsKeyboard,
  productActionsKeyboard,
  analogsListKeyboard,
  removeOnlyKeyboard,
} = require('../keyboards');
const { setUserState, clearUserState } = require('./state');
const { formatPrice, escapeHtml } = require('../../utils/formatters');
const { withChatAction, safeEditMessage } = require('../utils/chatActions');
const { renderProductListPage } = require('./commandHandlers');

/**
 * Registers callback query action handlers
 * @param {import('telegraf').Telegraf} bot
 */
function registerActionHandlers(bot) {
  // Callback query: list_page:<page>
  bot.action(/^list_page:(\d+)$/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await ctx.answerCbQuery(`📄 Страница ${page}`);
    await renderProductListPage(ctx, ctx.from.id, page, true);
  });

  // Callback query: view_prod:<productId>:<page>
  bot.action(/^view_prod:(\d+):(\d+)$/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    const returnPage = parseInt(ctx.match[2], 10);
    const userId = ctx.from.id;

    await ctx.answerCbQuery('📦 Загрузка карточки...');

    const product = await productRepository.findById(productId);
    if (!product) {
      return safeEditMessage(ctx, '⚠️ Товар не найден в базе данных.', {
        ...removeOnlyKeyboard(productId, returnPage),
      });
    }

    const sub = await subscriptionRepository.getSubscription(userId, productId);
    const hasTarget = Boolean(sub?.targetPrice);
    const productWithTarget = {
      ...product,
      targetPrice: sub?.targetPrice || null,
    };

    const text = productCardMessage(productWithTarget);
    const keyboard = productDetailsKeyboard(productId, product.url, hasTarget, returnPage);

    await safeEditMessage(ctx, text, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      ...keyboard,
    });
  });

  // Callback query: back_to_list:<page>
  bot.action(/^back_to_list:(\d+)$/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await ctx.answerCbQuery('📋 Каталог товаров');
    await renderProductListPage(ctx, ctx.from.id, page, true);
  });

  // Callback query: refresh_prod:<productId>:<page>
  bot.action(/^refresh_prod:(\d+):(\d+)$/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    const returnPage = parseInt(ctx.match[2], 10);
    const userId = ctx.from.id;

    await ctx.answerCbQuery('🔄 Получаю свежую цену с Ozon...');

    await withChatAction(ctx, 'typing', async () => {
      try {
        const updated = await productService.refreshProduct(productId);
        const sub = await subscriptionRepository.getSubscription(userId, productId);
        const productWithTarget = {
          ...updated,
          targetPrice: sub?.targetPrice || null,
        };

        const text = `🔄 <b>Цена успешно обновлена!</b>\n\n` + productCardMessage(productWithTarget);
        const keyboard = productDetailsKeyboard(productId, updated.url, Boolean(sub?.targetPrice), returnPage);

        await safeEditMessage(ctx, text, {
          parse_mode: 'HTML',
          disable_web_page_preview: false,
          ...keyboard,
        });
      } catch (err) {
        console.error('[ActionHandler] Ошибка при обновлении товара:', err.message);
        await ctx.reply(`⚠️ Не удалось обновить цену товара: ${err.message}`);
      }
    });
  });

  // Callback query: find_analogs:<productId>:<page>
  bot.action(/^find_analogs:(\d+)(?::(\d+))?$/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    const returnPage = ctx.match[2] ? parseInt(ctx.match[2], 10) : 1;

    await ctx.answerCbQuery('🔍 Ищу аналоги и похожие товары...');

    await withChatAction(ctx, 'typing', async () => {
      try {
        const { originalProduct, query, analogs } = await analogueService.findAnalogsForProduct(productId, 3);

        if (analogs.length === 0) {
          const emptyText = analogsNotFoundMessage(originalProduct, query);
          return safeEditMessage(ctx, emptyText, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            ...analogsListKeyboard(productId, [], returnPage),
          });
        }

        const text = analogsResultMessage(originalProduct, analogs, query);
        const keyboard = analogsListKeyboard(productId, analogs, returnPage);

        await safeEditMessage(ctx, text, {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...keyboard,
        });
      } catch (err) {
        console.error('[ActionHandler] Ошибка поиска аналогов и похожих товаров:', err.message);
        await ctx.reply(`⚠️ Не удалось найти аналоги и похожие товары: ${err.message}`);
      }
    });
  });

  // Callback query: track_analog:<sku>:<page>:<originalProductId>
  bot.action(/^track_analog:([^:]+)(?::(\d+))?(?::(\d+))?$/, async (ctx) => {
    const sku = ctx.match[1];
    const userId = ctx.from.id;

    await ctx.answerCbQuery('➕ Добавляю товар в отслеживание...');

    await withChatAction(ctx, 'typing', async () => {
      try {
        const productUrl = `https://www.ozon.ru/product/${sku}/`;
        const { product, isNewSubscription } = await productService.trackProduct(userId, productUrl);

        const toast = isNewSubscription
          ? `✅ <b>Товар успешно взят на отслеживание!</b>\n\n📦 <b><a href="${escapeHtml(product.url)}">${escapeHtml(product.title)}</a></b>\n💰 Текущая цена: <b>${formatPrice(product.currentPrice)}</b>`
          : `ℹ️ <b>Товар уже находится в вашем списке отслеживания.</b>`;

        await ctx.reply(toast, {
          parse_mode: 'HTML',
          disable_web_page_preview: false,
          ...productActionsKeyboard(product.id, product.url, false),
        });
      } catch (err) {
        console.error('[ActionHandler] Ошибка добавления товара:', err.message);
        await ctx.reply(`⚠️ Не удалось добавить товар: ${err.message}`);
      }
    });
  });

  // Callback query: check_all
  bot.action('check_all', async (ctx) => {
    await ctx.answerCbQuery('🔄 Запуск сканирования цен...');

    await withChatAction(ctx, 'typing', async () => {
      try {
        const result = await trackingService.checkAllProducts(bot);
        await ctx.reply(
          `✅ <b>Проверка цен завершена!</b>\n━━━━━━━━━━━━━━━━━━━━━\nВсего товаров проверено: <b>${result.checked}</b>\nОбнаружено изменений цен: <b>${result.updated}</b>`,
          { parse_mode: 'HTML' }
        );
        // Refresh catalog list view
        await renderProductListPage(ctx, ctx.from.id, 1, false);
      } catch (err) {
        await ctx.reply(`⚠️ Ошибка при выполнении проверки: ${err.message}`);
      }
    });
  });

  // Callback query: unsub:<productId> or unsub:<productId>:<page>
  bot.action(/^unsub:(\d+)(?::(\d+))?$/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    const returnPage = ctx.match[2] ? parseInt(ctx.match[2], 10) : 1;
    const userId = ctx.from.id;

    const { success, product } = await subscriptionService.unsubscribe(userId, productId);
    await ctx.answerCbQuery(success ? 'Товар удален из отслеживания' : 'Товар уже был удален');

    if (success) {
      const title = product ? product.title : 'Товар';
      const text = `❌ Товар <b>«${escapeHtml(title)}»</b> удален из вашего списка отслеживания.`;
      await safeEditMessage(ctx, text, {
        parse_mode: 'HTML',
        ...removeOnlyKeyboard(productId, returnPage),
      });
    }
  });

  // Callback query: chart:<productId> or chart:<productId>:<page>
  bot.action(/^chart:(\d+)(?::(\d+))?$/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    await ctx.answerCbQuery('📊 Генерирую график цен...');

    await withChatAction(ctx, 'upload_photo', async () => {
      try {
        const product = await productRepository.findById(productId);
        if (!product) {
          return ctx.reply('⚠️ Товар не найден в базе.');
        }

        const history = await priceHistoryRepository.getByProductId(productId, 30);
        const chartUrl = chartService.generateChartUrl(product, history);
        const stats = chartService.getHistoryStats(product, history);
        const caption = chartStatsMessage(product, stats);

        try {
          await ctx.replyWithPhoto(chartUrl, {
            caption,
            parse_mode: 'HTML',
          });
        } catch {
          // Fallback to text if sending photo fails
          await ctx.reply(caption, { parse_mode: 'HTML' });
        }
      } catch (err) {
        console.error('[ActionHandler] Ошибка при формировании графика:', err.message);
        await ctx.reply('⚠️ Не удалось построить график цен.');
      }
    });
  });

  // Callback query: target:<productId> or target:<productId>:<page>
  bot.action(/^target:(\d+)(?::(\d+))?$/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    const returnPage = ctx.match[2] ? parseInt(ctx.match[2], 10) : 1;
    const userId = ctx.from.id;

    await ctx.answerCbQuery();

    const product = await productRepository.findById(productId);
    const sub = await subscriptionRepository.getSubscription(userId, productId);
    const hasTarget = Boolean(sub?.targetPrice);

    setUserState(userId, { type: 'target_price', productId, returnPage });

    const currentTargetText = hasTarget
      ? `\nТекущий установленный порог: <b>${formatPrice(sub.targetPrice)}</b>.`
      : '';

    await ctx.reply(
      `🎯 <b>Установка желаемой цены</b> для «${escapeHtml(product?.title || 'товара')}»:${currentTargetText}\n\n` +
      `Отправьте в чат желаемую сумму в рублях (например: <code>1500</code>).\n` +
      `Бот уведомит вас, как только цена опустится до этого значения или ниже!`,
      {
        parse_mode: 'HTML',
        ...targetPromptKeyboard(productId, hasTarget, returnPage),
      }
    );
  });

  // Callback query: target_clear:<productId> or target_clear:<productId>:<page>
  bot.action(/^target_clear:(\d+)(?::(\d+))?$/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    const returnPage = ctx.match[2] ? parseInt(ctx.match[2], 10) : 1;
    const userId = ctx.from.id;

    await subscriptionService.clearTargetPrice(userId, productId);
    clearUserState(userId);

    await ctx.answerCbQuery('Порог цены сброшен');
    await safeEditMessage(
      ctx,
      '✅ <b>Желаемая цена для товара успешно сброшена.</b>\nУведомления будут приходить при любом изменении стоимости.',
      {
        parse_mode: 'HTML',
        ...removeOnlyKeyboard(productId, returnPage),
      }
    );
  });

  // Callback query: cancel_prompt or cancel_prompt:<page>
  bot.action(/^cancel_prompt(?::(\d+))?$/, async (ctx) => {
    const returnPage = ctx.match[1] ? parseInt(ctx.match[1], 10) : 1;
    clearUserState(ctx.from.id);
    await ctx.answerCbQuery('Ввод отменен');

    await safeEditMessage(ctx, '❌ Установка желаемой цены отменена.', {
      parse_mode: 'HTML',
      ...removeOnlyKeyboard(0, returnPage),
    });
  });

  // Callback query: toggle_drops
  bot.action('toggle_drops', async (ctx) => {
    const userId = ctx.from.id;
    const current = await subscriptionService.getUserSettings(userId);
    const updated = await subscriptionService.updateUserSettings(userId, {
      notifyOnlyDrops: !current.notifyOnlyDrops,
    });

    await ctx.answerCbQuery(updated.notifyOnlyDrops ? 'Включено: только снижение' : 'Включено: все изменения');
    await safeEditMessage(ctx, settingsMessage(updated), {
      parse_mode: 'HTML',
      ...settingsKeyboard(updated),
    });
  });

  // Callback query: toggle_card
  bot.action('toggle_card', async (ctx) => {
    const userId = ctx.from.id;
    const current = await subscriptionService.getUserSettings(userId);
    const updated = await subscriptionService.updateUserSettings(userId, {
      useOzonCard: !current.useOzonCard,
    });

    await ctx.answerCbQuery(updated.useOzonCard ? 'Ozon Карта: включена' : 'Ozon Карта: выключена');
    await safeEditMessage(ctx, settingsMessage(updated), {
      parse_mode: 'HTML',
      ...settingsKeyboard(updated),
    });
  });
}

module.exports = {
  registerActionHandlers,
};
