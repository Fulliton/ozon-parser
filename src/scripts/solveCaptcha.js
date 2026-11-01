const fs = require('fs');
const path = require('path');
const { connect } = require('puppeteer-real-browser');

const COOKIES_PATH = path.resolve(__dirname, '../../data/ozon-cookies.json');
const TARGET_URL = 'https://www.ozon.ru/product/figurka-personazha-anime-luffi-nika-one-piece-luffy-1699948485/';

async function run() {
  console.log('🚀 Запускаем браузер для прохождения капчи Ozon...');
  console.log('💡 Если открылось окно браузера с пазлом, просто передвиньте ползунок на место.\n');

  let browser;
  let page;

  try {
    const session = await connect({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1280,850',
      ],
      disableXvfb: true,
      customConfig: {
        chromePath: '/usr/bin/google-chrome',
      },
    });

    browser = session.browser;
    page = session.page;

    console.log(`🌐 Переходим на страницу Ozon: ${TARGET_URL}`);
    await page.goto(TARGET_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    console.log('⏳ Ожидание решения капчи (проверяем каждые 2 секунды)...');

    const maxWaitTime = 180000; // 3 минуты
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const title = await page.title();
      const currentUrl = page.url();

      const isCaptcha = title.includes('Antibot') || title.includes('Captcha') || title.includes('нет соединения');

      if (!isCaptcha && title.length > 0) {
        console.log(`\n🎉 Проверка пройдена! Заголовок страницы: "${title}"`);

        // Ждем пару секунд для сохранения всех кук
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const cookies = await page.cookies();
        fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2), 'utf8');

        console.log(`✅ Успешно сохранено ${cookies.length} кук в: ${COOKIES_PATH}`);
        console.log('🚀 Теперь бот может автоматически парсить товары без капчи!\n');
        break;
      }
    }

    await browser.close();
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
    process.exit(1);
  }
}

run();
