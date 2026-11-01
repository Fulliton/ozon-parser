const cron = require('node-cron');
const config = require('../config');
const { productRepository, subscriptionRepository } = require('../repositories');
const { parseOzonProduct } = require('./ozonParserService');
const notificationService = require('./notificationService');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class TrackingService {
  /**
   * Checks all tracked products, updates prices, timestamps and notifies subscribers
   * @param {import('telegraf').Telegraf} bot
   * @returns {Promise<{ checked: number, updated: number }>}
   */
  async checkAllProducts(bot) {
    const products = await productRepository.getAllTracked();
    console.log(`[TrackingService] Запуск проверки цен. Всего товаров на отслеживании: ${products.length}`);

    let checkedCount = 0;
    let updatedCount = 0;

    for (const product of products) {
      try {
        await sleep(1500);

        const freshInfo = await parseOzonProduct(
          product.url,
          product.sku,
          product.currentPrice
        );
        checkedCount++;

        const newPrice = freshInfo.currentPrice;
        const oldPrice = product.currentPrice;

        if (newPrice && newPrice !== oldPrice) {
          console.log(`🔔 [TrackingService] Цена SKU ${product.sku} изменилась: ${oldPrice} -> ${newPrice}`);

          // Update price, history and timestamps in DB via repository
          const updatedProduct = await productRepository.updatePrice(product.id, newPrice, freshInfo.cardPrice);
          updatedCount++;

          // Send notifications to subscribers with target price details
          if (bot) {
            const subscribers = await subscriptionRepository.getSubscriptionsWithDetails(product.id);
            await notificationService.notifyPriceChange(bot, updatedProduct, oldPrice, newPrice, subscribers);
          }
        } else {
          // Price didn't change, update last_parsed_at and last_checked_at
          await productRepository.updateLastParsed(product.id);
        }
      } catch (err) {
        console.warn(`[TrackingService] Не удалось проверить SKU ${product.sku}: ${err.message}`);
      }
    }

    console.log(`[TrackingService] Проверка завершена. Проверено: ${checkedCount}, изменилось: ${updatedCount}`);
    return { checked: checkedCount, updated: updatedCount };
  }

  /**
   * Starts periodic cron scheduler (every 30 minutes by default)
   * @param {import('telegraf').Telegraf} bot
   */
  startScheduler(bot) {
    if (!cron.validate(config.checkIntervalCron)) {
      console.error(`❌ Неверный cron-формат: ${config.checkIntervalCron}. Проверьте CHECK_INTERVAL_CRON в .env`);
      return;
    }

    console.log(`⏰ [TrackingService] Планировщик запущен с интервалом: "${config.checkIntervalCron}"`);

    cron.schedule(config.checkIntervalCron, async () => {
      try {
        await this.checkAllProducts(bot);
      } catch (err) {
        console.error('[TrackingService Scheduler] Критическая ошибка проверки цен:', err);
      }
    });
  }
}

module.exports = new TrackingService();
