const { priceAlertMessage, targetReachedAlertMessage } = require('../telegram/messages');
const { productActionsKeyboard } = require('../telegram/keyboards');
const { userSettingRepository } = require('../repositories');

class NotificationService {
  /**
   * Sends price change or target reached notification to subscribers of a product
   * @param {import('telegraf').Telegraf} bot
   * @param {Object} product
   * @param {number} oldPrice
   * @param {number} newPrice
   * @param {Array<{ userId: number, targetPrice: number|null }|number>} subscribers
   * @returns {Promise<number>} count of successful notifications sent
   */
  async notifyPriceChange(bot, product, oldPrice, newPrice, subscribers) {
    if (!subscribers || subscribers.length === 0 || !bot) return 0;

    let sentCount = 0;

    for (const sub of subscribers) {
      const userId = typeof sub === 'object' ? sub.userId : Number(sub);
      const targetPrice = typeof sub === 'object' ? sub.targetPrice : null;

      try {
        const settings = await userSettingRepository.getSettings(userId);

        const effectivePrice = (settings.useOzonCard && product.cardPrice)
          ? product.cardPrice
          : newPrice;

        const effectiveOldPrice = (settings.useOzonCard && product.cardPrice && oldPrice)
          ? oldPrice
          : oldPrice;

        const isPriceDrop = newPrice < oldPrice;

        // If user configured to only receive drops and price went up, skip regular change alert
        if (settings.notifyOnlyDrops && !isPriceDrop && (!targetPrice || effectivePrice > targetPrice)) {
          continue;
        }

        const keyboard = productActionsKeyboard(product.id, product.url, Boolean(targetPrice));

        // Check if target price threshold is reached
        if (targetPrice && effectivePrice <= targetPrice) {
          const targetText = targetReachedAlertMessage(product, targetPrice, effectivePrice);
          await bot.telegram.sendMessage(userId, targetText, {
            parse_mode: 'HTML',
            disable_web_page_preview: false,
            ...keyboard,
          });
          sentCount++;
          continue;
        }

        // Regular price alert
        const alertText = priceAlertMessage(product, effectiveOldPrice, effectivePrice);
        await bot.telegram.sendMessage(userId, alertText, {
          parse_mode: 'HTML',
          disable_web_page_preview: false,
          ...keyboard,
        });
        sentCount++;
      } catch (err) {
        console.error(`[NotificationService] Ошибка отправки пользователю ${userId}:`, err.message);
      }
    }

    return sentCount;
  }
}

module.exports = new NotificationService();
