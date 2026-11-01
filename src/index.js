const config = require('./config');
const { initDb, closeDb } = require('./database');
const { createBot } = require('./telegram');
const { trackingService, ozonParserService } = require('./services');

async function main() {
  console.log('🚀 Запуск Ozon Price Tracker Bot...');

  if (!config.botToken) {
    console.error('❌ Ошибка: Переменная окружения BOT_TOKEN не задана.');
    console.error('👉 Создайте файл .env на основе .env.example и укажите токен вашего бота.');
    process.exit(1);
  }

  // 1. Initialize SQLite database with Sequelize & run pending migrations
  await initDb();

  // 2. Initialize Telegram Bot
  const bot = createBot();

  // 3. Start Price Monitoring Cron Scheduler (every 30 minutes)
  trackingService.startScheduler(bot);

  // 4. Start polling Telegram updates
  try {
    const botInfo = await bot.telegram.getMe();
    console.log(`ℹ️ Имя бота: @${botInfo.username} (${botInfo.first_name})`);
    console.log('🤖 Telegram-бот успешно запущен и слушает входящие сообщения!');

    bot.launch({ dropPendingUpdates: true });
  } catch (err) {
    console.error('❌ Ошибка при запуске Telegram-бота:', err.message);
    process.exit(1);
  }

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\n🛑 Получен сигнал ${signal}. Остановка приложения...`);
    try {
      bot.stop(signal);
      await ozonParserService.closeSharedBrowser();
      closeDb();
    } catch (err) {
      console.warn('Ошибка при завершении работы:', err.message);
    }
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Непредвиденная фатальная ошибка:', err);
  process.exit(1);
});
