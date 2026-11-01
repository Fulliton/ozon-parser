const { Telegraf } = require('telegraf');
const config = require('../config');
const { registerHandlers } = require('./handlers');

/**
 * Creates and configures the Telegraf bot instance
 * @returns {Telegraf}
 */
function createBot() {
  const bot = new Telegraf(config.botToken);

  // Register all handlers (commands, messages, actions)
  registerHandlers(bot);

  // Global error handler
  bot.catch((err, ctx) => {
    console.error(`[Telegram Error] Ошибка у пользователя ${ctx?.from?.id}:`, err);
  });

  return bot;
}

module.exports = {
  createBot,
};
