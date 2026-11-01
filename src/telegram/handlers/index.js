const { registerCommandHandlers } = require('./commandHandlers');
const { registerMessageHandlers } = require('./messageHandlers');
const { registerActionHandlers } = require('./actionHandlers');

/**
 * Registers all bot handlers
 * @param {import('telegraf').Telegraf} bot
 */
function registerHandlers(bot) {
  registerCommandHandlers(bot);
  registerMessageHandlers(bot);
  registerActionHandlers(bot);
}

module.exports = {
  registerHandlers,
  registerCommandHandlers,
  registerMessageHandlers,
  registerActionHandlers,
};
