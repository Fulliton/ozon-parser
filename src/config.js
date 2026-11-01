const path = require('path');
require('dotenv').config();

const config = {
  // Telegram Bot Token
  botToken: process.env.BOT_TOKEN || '',

  // Cron schedule for checking prices (default: every 30 minutes)
  checkIntervalCron: process.env.CHECK_INTERVAL_CRON || '*/30 * * * *',

  // Database path
  databasePath: process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'tracker.db'),

  // Optional proxy URL
  proxyUrl: process.env.PROXY_URL || null,

  // Ozon API Base URL
  ozonApiBase: process.env.OZON_API_BASE || 'https://api.ozon.ru',

  // Demo mode for testing price alerts locally
  demoMode: process.env.DEMO_MODE === 'true',

  // Optional Remote Chrome debugging URL (e.g. http://127.0.0.1:9222)
  chromeRemoteUrl: process.env.CHROME_REMOTE_URL || null,
};

if (!config.botToken && process.env.NODE_ENV !== 'test') {
  console.warn('⚠️ Внимание: BOT_TOKEN не задан в .env файле!');
}

module.exports = config;
