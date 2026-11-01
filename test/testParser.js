const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(__dirname, 'test.db');
process.env.DEMO_MODE = 'true';

const { isOzonUrl, extractOzonSku, extractUrlFromText } = require('../src/utils/urlParser');
const { formatPrice, formatPriceDiff } = require('../src/utils/formatters');
const { initDb, closeDb, getMigrator } = require('../src/database');
const {
  productRepository,
  subscriptionRepository,
  priceHistoryRepository,
  userSettingRepository,
} = require('../src/repositories');
const {
  productService,
  subscriptionService,
  trackingService,
  ozonParserService,
  chartService,
  notificationService,
} = require('../src/services');
const { cleanPrice } = ozonParserService;
const {
  productTrackedMessage,
  productCardMessage,
  targetReachedAlertMessage,
  chartStatsMessage,
  settingsMessage,
} = require('../src/telegram/messages');

async function runTests() {
  console.log('🧪 Запуск тестов Ozon Price Tracker Bot (Target Price, Charts, User Settings)...\n');

  // Clean up any old test database
  await closeDb();
  if (fs.existsSync(process.env.DATABASE_PATH)) {
    fs.unlinkSync(process.env.DATABASE_PATH);
  }

  // 1. Test URL Parser
  console.log('1. Тестирование валидации ссылок и парсера URL Ozon:');
  assert.strictEqual(isOzonUrl('https://www.ozon.ru/product/12345'), true);
  assert.strictEqual(isOzonUrl('Купи на https://ozon.ru/product/item-987654321/ пж'), true);
  assert.strictEqual(isOzonUrl('https://google.com'), false);

  const userUrl = 'https://www.ozon.ru/product/figurka-personazha-anime-luffi-nika-one-piece-luffy-1699948485/?__rr=1&sh=fCik80PgcA';
  assert.strictEqual(isOzonUrl(userUrl), true);
  const parsedUser = await extractOzonSku(userUrl);
  assert.strictEqual(parsedUser?.sku, '1699948485');
  assert.strictEqual(parsedUser?.canonicalUrl, 'https://www.ozon.ru/product/1699948485/');

  const shortShareText = 'Смотри какой товар: https://ozon.ru/t/6ly40sI! Покупаем?';
  assert.strictEqual(isOzonUrl(shortShareText), true);
  const extractedUrl = extractUrlFromText(shortShareText);
  assert.strictEqual(extractedUrl, 'https://ozon.ru/t/6ly40sI');
  const parsedShort = await extractOzonSku(extractedUrl);
  assert.strictEqual(parsedShort?.sku, '2346114215');
  assert.strictEqual(parsedShort?.canonicalUrl, 'https://www.ozon.ru/product/2346114215/');

  console.log('   ✅ Валидация URL и извлечение SKU работают корректно\n');

  // 2. Test Formatters & Price Cleaning
  console.log('2. Тестирование парсинга и форматирования цен:');
  assert.strictEqual(cleanPrice('1 440 ₽'), 1440);
  assert.strictEqual(cleanPrice('1 516 ₽'), 1516);
  assert.strictEqual(cleanPrice('19 990 ₽'), 19990);
  assert.strictEqual(formatPrice(1990), '1 990 ₽');
  assert.strictEqual(formatPrice(250000), '250 000 ₽');

  const diffDown = formatPriceDiff(2500, 2000);
  assert.strictEqual(diffDown.direction, 'down');
  assert.strictEqual(diffDown.diff, -500);
  assert.strictEqual(diffDown.percent, 20);

  console.log('   ✅ Форматирование валюты и разницы цен работает точно\n');

  // 3. Test Database, Migrations & ORM Repositories
  console.log('3. Тестирование Sequelize ORM, системы миграций (Umzug) и слоя Repositories:');
  const seq = await initDb(process.env.DATABASE_PATH);

  // Verify all 4 migrations were applied
  const migrator = getMigrator(seq);
  const executedMigrations = await migrator.executed();
  assert.ok(executedMigrations.length >= 4, 'Должно быть выполнено не менее 4 миграций');
  console.log(`   Применено миграций: ${executedMigrations.map((m) => m.name).join(', ')}`);

  // Upsert product via ProductRepository
  const product = await productRepository.upsert({
    sku: '1699948485',
    url: 'https://www.ozon.ru/product/1699948485/',
    title: 'Фигурка персонажа аниме Луффи Ника',
    currentPrice: 1440,
    oldPrice: 1516,
    cardPrice: 1440,
    imageUrl: 'https://example.com/luffy.jpg',
  });

  assert.strictEqual(product.sku, '1699948485');
  assert.strictEqual(product.currentPrice, 1440);
  assert.strictEqual(product.cardPrice, 1440);
  assert.ok(product.lastParsedAt, 'Поле lastParsedAt должно быть заполнено при парсинге');

  // Subscription via SubscriptionRepository
  const userId = 99887766;
  const subscribed = await subscriptionRepository.subscribe(userId, product.id);
  assert.strictEqual(subscribed, true);

  // Set target price
  const targetSet = await subscriptionRepository.setTargetPrice(userId, product.id, 1200);
  assert.strictEqual(targetSet, true);

  const userProducts = await subscriptionRepository.getUserProducts(userId);
  assert.strictEqual(userProducts.length, 1);
  assert.strictEqual(userProducts[0].targetPrice, 1200);

  const subDetails = await subscriptionRepository.getSubscriptionsWithDetails(product.id);
  assert.strictEqual(subDetails.length, 1);
  assert.strictEqual(subDetails[0].userId, userId);
  assert.strictEqual(subDetails[0].targetPrice, 1200);

  // Price update via ProductRepository
  const updatedProduct = await productRepository.updatePrice(product.id, 1350, 1350);
  assert.strictEqual(updatedProduct.oldPrice, 1440);
  assert.strictEqual(updatedProduct.currentPrice, 1350);

  // Price history check
  const history = await priceHistoryRepository.getByProductId(product.id);
  assert.ok(history.length >= 2, 'В истории должно быть зафиксировано не менее 2 записей');

  // User Settings Repository test
  const defaultSettings = await userSettingRepository.getSettings(userId);
  assert.strictEqual(defaultSettings.notifyOnlyDrops, true);
  assert.strictEqual(defaultSettings.useOzonCard, true);

  const updatedSettings = await userSettingRepository.updateSettings(userId, {
    notifyOnlyDrops: false,
  });
  assert.strictEqual(updatedSettings.notifyOnlyDrops, false);
  assert.strictEqual(updatedSettings.useOzonCard, true);

  console.log('   ✅ Все операции с БД, целевым порогом цен и настройками работают отлично\n');

  // 4. Test ChartService
  console.log('4. Тестирование ChartService (генерация графиков динамики цен):');
  const chartUrl = chartService.generateChartUrl(product, history);
  assert.ok(chartUrl.startsWith('https://quickchart.io/chart?'), 'Chart URL должен вести на QuickChart');
  assert.ok(chartUrl.includes('devicePixelRatio'), 'Chart URL должен быть высокой четкости');

  const stats = chartService.getHistoryStats(product, history);
  assert.strictEqual(stats.currentPrice, 1440);
  assert.strictEqual(typeof stats.minPrice, 'number');
  assert.strictEqual(typeof stats.maxPrice, 'number');
  assert.ok(stats.pointsCount >= 2);

  const chartCaption = chartStatsMessage(product, stats);
  assert.ok(chartCaption.includes('История цен:'));
  assert.ok(chartCaption.includes('Минимум:'));
  console.log('   ✅ ChartService формирует корректные URL графиков и статистику цен\n');

  // 5. Test NotificationService with Target Price & Drops-only filter
  console.log('5. Тестирование логики NotificationService (алерты по порогу цен и фильтрация):');
  const sentMessages = [];
  const fakeBot = {
    telegram: {
      sendMessage: async (toUser, text, extra) => {
        sentMessages.push({ toUser, text, extra });
      },
    },
  };

  // 5a. Regular price drop alert
  await notificationService.notifyPriceChange(
    fakeBot,
    updatedProduct,
    1440,
    1350,
    [{ userId, targetPrice: 1200 }]
  );
  assert.strictEqual(sentMessages.length, 1);
  assert.ok(sentMessages[0].text.includes('ЦЕНА СНИЗИЛАСЬ'));

  // 5b. Target price reached alert (price falls to 1190 <= target 1200)
  sentMessages.length = 0;
  await notificationService.notifyPriceChange(
    fakeBot,
    { ...updatedProduct, currentPrice: 1190, cardPrice: 1190 },
    1350,
    1190,
    [{ userId, targetPrice: 1200 }]
  );
  assert.strictEqual(sentMessages.length, 1);
  assert.ok(sentMessages[0].text.includes('ЖЕЛАЕМАЯ ЦЕНА ДОСТИГНУТА!'), 'Должно отправиться целевое уведомление');

  console.log('   ✅ NotificationService корректно отправляет целевые алерты и алерты об изменении\n');

  // 6. Test Service Layer & Full Tracking Cycle
  console.log('6. Тестирование слоя Сервисов (Services) и интеграции:');
  const trackResult = await productService.trackProduct(userId, userUrl);
  assert.ok(trackResult.product);
  assert.strictEqual(trackResult.product.sku, '1699948485');

  // Messages formatting check
  const cardWithTarget = productCardMessage({
    ...trackResult.product,
    targetPrice: 1200,
  });
  assert.ok(cardWithTarget.includes('Желаемая цена: <b>1 200 ₽</b>'));

  const settingsFormatted = settingsMessage({ notifyOnlyDrops: true, useOzonCard: true });
  assert.ok(settingsFormatted.includes('Настройки уведомлений'));

  // TrackingService cycle
  const checkResult = await trackingService.checkAllProducts(fakeBot);
  assert.ok(checkResult.checked >= 1);

  // Unsubscribe & cleanup
  await subscriptionService.unsubscribe(userId, trackResult.product.id);
  const subsAfter = await subscriptionRepository.getUserProducts(userId);
  assert.strictEqual(subsAfter.length, 0);

  console.log('   ✅ Сервисы productService, subscriptionService, trackingService, chartService работают согласованно\n');

  // 7. Test Interactive UX, Chat Actions, Pagination & refreshProduct
  console.log('7. Тестирование интерактивного UX (Chat Actions, меню на лету, пагинация, refreshProduct):');
  const { formatRelativeTime, formatTargetProgress } = require('../src/utils/formatters');
  const { productListMenuMessage } = require('../src/telegram/messages');
  const { productListKeyboard, productDetailsKeyboard } = require('../src/telegram/keyboards');
  const { withChatAction, safeEditMessage } = require('../src/telegram/utils/chatActions');

  // 7a. formatRelativeTime
  assert.strictEqual(formatRelativeTime(new Date()), 'только что');
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  assert.strictEqual(formatRelativeTime(fiveMinAgo), '5 мин назад');
  const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
  assert.strictEqual(formatRelativeTime(twoHoursAgo), '2 ч назад');

  // 7b. formatTargetProgress
  const notReached = formatTargetProgress(1500, 1200);
  assert.strictEqual(notReached.reached, false);
  assert.strictEqual(notReached.diff, 300);
  assert.ok(notReached.text.includes('до цели: 300 ₽'));

  const reached = formatTargetProgress(1100, 1200);
  assert.strictEqual(reached.reached, true);
  assert.ok(reached.text.includes('Цель достигнута!'));

  // 7c. productListMenuMessage and productListKeyboard
  const sampleProducts = [
    { id: 1, title: 'Товар 1', url: 'https://ozon.ru/1', currentPrice: 1000, cardPrice: 900, sku: '111' },
    { id: 2, title: 'Товар 2', url: 'https://ozon.ru/2', currentPrice: 2000, cardPrice: null, sku: '222' },
  ];
  const catalogText = productListMenuMessage(sampleProducts, 1, 2, 8);
  assert.ok(catalogText.includes('Ваши отслеживаемые товары (8)'));
  assert.ok(catalogText.includes('Страница 1 из 2'));

  const catalogKb = productListKeyboard(sampleProducts, 1, 2);
  assert.ok(catalogKb.reply_markup.inline_keyboard.length >= 2);
  // Check button callbacks
  const itemRow = catalogKb.reply_markup.inline_keyboard[0];
  assert.strictEqual(itemRow[0].callback_data, 'view_prod:1:1');
  assert.strictEqual(itemRow[1].callback_data, 'view_prod:2:1');

  // 7d. productDetailsKeyboard
  const detailsKb = productDetailsKeyboard(1, 'https://ozon.ru/1', true, 2);
  const detailsRows = detailsKb.reply_markup.inline_keyboard;
  assert.ok(detailsRows.some((row) => row.some((btn) => btn.callback_data === 'refresh_prod:1:2')));
  assert.ok(detailsRows.some((row) => row.some((btn) => btn.callback_data === 'back_to_list:2')));

  // 7e. withChatAction and safeEditMessage
  let chatActionSent = false;
  const mockCtx = {
    sendChatAction: async (action) => {
      if (action === 'typing') chatActionSent = true;
    },
    editMessageText: async (text) => {
      if (text === 'throw_same') {
        const err = new Error('Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message');
        err.description = err.message;
        throw err;
      }
      return { ok: true, text };
    },
  };

  const actionResult = await withChatAction(mockCtx, 'typing', async () => {
    return 'task_completed';
  });
  assert.strictEqual(actionResult, 'task_completed');
  assert.strictEqual(chatActionSent, true);

  // safeEditMessage should catch message is not modified without throwing
  const suppressedResult = await safeEditMessage(mockCtx, 'throw_same');
  assert.strictEqual(suppressedResult, null);

  // 7f. productService.refreshProduct
  const recheckProduct = await productService.refreshProduct(product.id);
  assert.strictEqual(recheckProduct.sku, '1699948485');
  assert.ok(recheckProduct.currentPrice > 0);

  console.log('   ✅ Интерактивный UX, индикация активности, меню на лету и refreshProduct работают безупречно\n');

  // 8. Тестирование модуля поиска аналогов (AnalogueService, KeywordExtractor, Keyboards, Messages)
  console.log('8. Тестирование модуля поиска аналогов и экономии бюджета (Smart Analogue Engine):');
  const { extractSearchKeywords } = require('../src/utils/keywordExtractor');
  const { analogueService } = require('../src/services');
  const { analogsListKeyboard } = require('../src/telegram/keyboards');
  const { analogsResultMessage, analogsNotFoundMessage } = require('../src/telegram/messages');

  // 8a. KeywordExtractor
  const spamTitle = 'Беспроводные наушники Pro TWS Bluetooth 5.3 гарнитура для телефона спортивные с микрофоном черные подарок мужу детям новинка 2026 хит [SKU: 999] (Original)';
  const cleanedKeywords = extractSearchKeywords(spamTitle, 3);
  assert.strictEqual(cleanedKeywords, 'Беспроводные наушники Pro');
  assert.ok(!cleanedKeywords.includes('подарок'));
  assert.ok(!cleanedKeywords.includes('новинка'));
  assert.ok(!cleanedKeywords.includes('SKU'));

  // 8b. AnalogueService.findAnalogsForProduct
  const analogsResult = await analogueService.findAnalogsForProduct(product.id, 3);
  assert.ok(analogsResult.originalProduct);
  assert.strictEqual(analogsResult.originalProduct.id, product.id);
  assert.ok(Array.isArray(analogsResult.analogs));
  assert.ok(analogsResult.analogs.length > 0, 'Должны быть найдены более дешевые аналоги');

  const originalEffectivePrice = analogsResult.originalProduct.cardPrice || analogsResult.originalProduct.currentPrice;
  for (const analog of analogsResult.analogs) {
    assert.notStrictEqual(analog.sku, product.sku, 'Аналог не должен совпадать с исходным SKU');
    assert.ok(analog.effectivePrice < originalEffectivePrice, `Цена аналога (${analog.effectivePrice}) должна быть ниже исходной (${originalEffectivePrice})`);
    assert.ok(analog.savingsRub > 0, 'Экономия в рублях должна быть положительной');
    assert.ok(analog.savingsPercent > 0, 'Процент экономии должен быть больше нуля');
    assert.strictEqual(analog.savingsRub, originalEffectivePrice - analog.effectivePrice);
  }

  // 8c. Keyboard & Messages for Analogs
  const analogsKb = analogsListKeyboard(product.id, analogsResult.analogs, 1);
  const kbRows = analogsKb.reply_markup.inline_keyboard;
  assert.ok(kbRows.length >= analogsResult.analogs.length + 1);
  // First row has link and track buttons
  assert.ok(kbRows[0][0].url.includes('https://www.ozon.ru/product/'));
  assert.ok(kbRows[0][1].callback_data.startsWith('track_analog:'));
  // Last row has back button
  assert.strictEqual(kbRows[kbRows.length - 1][0].callback_data, `view_prod:${product.id}:1`);

  const msgText = analogsResultMessage(product, analogsResult.analogs, analogsResult.query);
  assert.ok(msgText.includes('Найдены более дешевые аналоги и похожие товары!'));
  assert.ok(msgText.includes('Экономия:'));

  const notFoundText = analogsNotFoundMessage(product, 'эксклюзивный товар');
  assert.ok(notFoundText.includes('У вас лучшая цена на рынке!'));
  assert.ok(notFoundText.includes('более дешевых аналогов и похожих товаров не найдено'));

  // 8d. extractItemsFromSearchWidgetStates (чистый парсер JSON ответов Ozon search entrypoint-api)
  const { extractItemsFromSearchWidgetStates } = require('../src/services/ozonParserService');
  const mockWidgetStates = {
    'tileGridDesktop-3669724-default-1': JSON.stringify({
      items: [
        {
          sku: 6085014178,
          id: '6085014178',
          action: { link: '/product/kamera-dlya-tyubinga-6085014178/?at=123' },
          tileImage: { items: [{ type: 'image', image: { link: 'https://ir.ozone.ru/s3/multimedia-1-o/20499160596.jpg' } }] },
          mainState: [
            { type: 'priceV2', priceV2: { price: [{ text: '513\u2009\u20BD', textStyle: 'PRICE' }], priceStyle: { styleType: 'CARD_PRICE' } } },
            { type: 'textDS', textDS: { text: 'Камера для тюбинга' }, id: 'name' }
          ]
        },
        {
          sku: 6201203586,
          id: '6201203586',
          action: { link: '/product/kamera-dlya-tyubinga-6201203586/?at=456' },
          mainState: [
            { type: 'priceV2', priceV2: { price: [{ text: '595\u2009\u20BD', textStyle: 'PRICE' }], priceStyle: { styleType: 'ACTUAL_PRICE' } } },
            { type: 'textDS', textDS: { text: 'Камера для тюбинга R14' }, id: 'name' }
          ]
        }
      ]
    })
  };
  const parsedSearchItems = extractItemsFromSearchWidgetStates(mockWidgetStates, 'ватрушка');
  assert.strictEqual(parsedSearchItems.length, 2);
  assert.strictEqual(parsedSearchItems[0].sku, '6085014178');
  assert.strictEqual(parsedSearchItems[0].currentPrice, 513);
  assert.strictEqual(parsedSearchItems[0].cardPrice, 513);
  assert.strictEqual(parsedSearchItems[0].title, 'Камера для тюбинга');

  assert.strictEqual(parsedSearchItems[1].sku, '6201203586');
  assert.strictEqual(parsedSearchItems[1].currentPrice, 595);
  assert.strictEqual(parsedSearchItems[1].title, 'Камера для тюбинга R14');

  console.log('   ✅ Модуль поиска аналогов и похожих товаров, расчет экономии и клавиатуры работают безупречно\n');

  // Clean up test db
  await closeDb();
  if (fs.existsSync(process.env.DATABASE_PATH)) {
    fs.unlinkSync(process.env.DATABASE_PATH);
  }

  console.log('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
}

runTests().catch((err) => {
  console.error('❌ Ошибка во время тестов:', err);
  process.exit(1);
});
