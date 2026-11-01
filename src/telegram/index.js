const { createBot } = require('./bot');
const keyboards = require('./keyboards');
const messages = require('./messages');
const handlers = require('./handlers');

module.exports = {
  createBot,
  keyboards,
  messages,
  handlers,
};
