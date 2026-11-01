const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const config = require('../config');

// Activate stealth plugin
puppeteer.use(StealthPlugin());

let sharedBrowser = null;
let browserClosingTimer = null;

/**
 * Finds the Chrome executable path on the system
 * @returns {string|undefined}
 */
function getChromeExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const commonPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return undefined;
}

/**
 * Cleans price string and converts to number
 * @param {string|number} priceStr
 * @returns {number|null}
 */
function cleanPrice(priceStr) {
  if (priceStr === null || priceStr === undefined) return null;
  if (typeof priceStr === 'number') return Math.round(priceStr);

  const cleaned = String(priceStr)
    .replace(/&nbsp;/g, ' ')
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F]/g, ' ')
    .replace(/[^\d.,]/g, '')
    .replace(',', '.');

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num);
}

/**
 * Parses structured product data from Ozon widgetStates object
 * @param {Object} widgetStates
 * @returns {{ rawTitle: string|null, rawCardPrice: string|null, rawCurrentPrice: string|null, rawOldPrice: string|null, rawImage: string|null, inStock: boolean }}
 */
function parseWidgetStates(widgetStates) {
  let rawTitle = null;
  let rawCardPrice = null;
  let rawCurrentPrice = null;
  let rawOldPrice = null;
  let rawImage = null;
  let inStock = true;

  if (!widgetStates || typeof widgetStates !== 'object') {
    return { rawTitle, rawCardPrice, rawCurrentPrice, rawOldPrice, rawImage, inStock };
  }

  for (const [key, rawVal] of Object.entries(widgetStates)) {
    try {
      const state = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
      if (!state || typeof state !== 'object') continue;

      if (key.includes('webProductHeading') || key.includes('webTitle')) {
        if (state.title) rawTitle = state.title;
        else if (state.heading) rawTitle = state.heading;
      }

      if (key.includes('webPrice') || key.includes('webCurrentPrice')) {
        if (state.cardPrice) rawCardPrice = state.cardPrice;
        if (state.price) rawCurrentPrice = state.price;
        if (state.originalPrice) rawOldPrice = state.originalPrice;
        if (state.isAvailable !== undefined) inStock = Boolean(state.isAvailable);
      }

      if (key.includes('webGallery') || key.includes('webCover')) {
        if (state.coverImage) {
          rawImage = state.coverImage;
        } else if (Array.isArray(state.images) && state.images.length > 0) {
          rawImage = state.images[0]?.src || state.images[0];
        }
      }

      if (key.includes('webOutOfStock') || state.isOutOfStock) {
        inStock = false;
      }
    } catch {
      // ignore state parsing error
    }
  }

  return { rawTitle, rawCardPrice, rawCurrentPrice, rawOldPrice, rawImage, inStock };
}

/**
 * Parses proxy URL into server and optional credentials
 * @param {string} proxyUrl
 * @returns {{ server: string, username?: string, password?: string } | null}
 */
function parseProxy(proxyUrl) {
  if (!proxyUrl) return null;
  try {
    const parsed = new URL(proxyUrl);
    return {
      server: `${parsed.protocol}//${parsed.hostname}:${parsed.port}`,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    };
  } catch {
    return { server: proxyUrl };
  }
}

/**
 * Gets or launches a shared Puppeteer browser instance
 * @returns {Promise<import('puppeteer').Browser>}
 */
async function getBrowser() {
  if (browserClosingTimer) {
    clearTimeout(browserClosingTimer);
    browserClosingTimer = null;
  }

  const isConnected = sharedBrowser && (typeof sharedBrowser.isConnected === 'function' ? sharedBrowser.isConnected() : sharedBrowser.connected);
  if (isConnected) {
    return sharedBrowser;
  }

  // 1. Try connecting to an already running Chrome with remote debugging (e.g. port 9222)
  const remoteUrl = config.chromeRemoteUrl || 'http://127.0.0.1:9222';
  try {
    const checkRes = await fetch(`${remoteUrl}/json/version`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(1000) : undefined,
    });
    if (checkRes.ok) {
      console.log(`[Puppeteer] Подключаемся к запущенному Chrome на ${remoteUrl}...`);
      sharedBrowser = await puppeteer.connect({
        browserURL: remoteUrl,
        defaultViewport: null,
      });
      sharedBrowser._isRemote = true;
      return sharedBrowser;
    }
  } catch {
    // Remote Chrome not running, proceed to regular launch
  }

  // 2. Launch local Chrome instance
  const chromePath = getChromeExecutablePath();
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1440,900',
    '--lang=ru-RU,ru',
  ];

  const proxy = parseProxy(config.proxyUrl);
  if (proxy) {
    launchArgs.push(`--proxy-server=${proxy.server}`);
  }

  const env = {
    ...process.env,
    LD_LIBRARY_PATH: [process.env.LD_LIBRARY_PATH, '/usr/local/lib', '/usr/lib'].filter(Boolean).join(':'),
  };

  const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

  // 2. Launch real browser instance using puppeteer-real-browser to bypass bot detection
  try {
    const { connect } = require('puppeteer-real-browser');
    const session = await connect({
      headless: 'auto',
      args: launchArgs,
      disableXvfb: hasDisplay, // On headless VPS (no display), enable Xvfb virtual screen
      customConfig: {
        chromePath: chromePath || '/usr/bin/google-chrome',
      },
    });
    sharedBrowser = session.browser;
    return sharedBrowser;
  } catch (err) {
    console.warn('[Puppeteer] Real browser launch failed, falling back to standard launch:', err.message);
  }

  // 3. Fallback to standard puppeteer launch
  sharedBrowser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: launchArgs,
    env,
  });

  return sharedBrowser;
}

/**
 * Schedules browser close after inactivity to free system RAM
 * @param {number} delayMs
 */
function scheduleBrowserClose(delayMs = 60000) {
  if (browserClosingTimer) {
    clearTimeout(browserClosingTimer);
  }
  browserClosingTimer = setTimeout(async () => {
    const isConnected = sharedBrowser && (typeof sharedBrowser.isConnected === 'function' ? sharedBrowser.isConnected() : sharedBrowser.connected);
    if (isConnected) {
      try {
        if (sharedBrowser._isRemote) {
          sharedBrowser.disconnect();
        } else {
          await sharedBrowser.close();
        }
      } catch (e) {
        console.warn('[Puppeteer] Error closing idle browser:', e.message);
      } finally {
        sharedBrowser = null;
      }
    }
  }, delayMs);
}

/**
 * Generates simulated product data for testing/demo mode
 * @param {string} sku
 * @param {number|null} prevPrice
 * @returns {Object}
 */
function getDemoProduct(sku, prevPrice = null) {
  let basePrice = prevPrice;
  if (!basePrice) {
    const seed = parseInt(sku.slice(-4), 10) || 1990;
    basePrice = Math.max(490, (seed % 100) * 100 + 490);
  } else {
    const changeFactor = Math.random() < 0.6 ? -(0.05 + Math.random() * 0.1) : (0.05 + Math.random() * 0.08);
    basePrice = Math.round(basePrice * (1 + changeFactor));
  }

  const cardPrice = Math.round(basePrice * 0.95);

  return {
    title: `Товар Ozon [SKU: ${sku}]`,
    currentPrice: cardPrice,
    oldPrice: Math.round(basePrice * 1.2),
    cardPrice,
    imageUrl: 'https://cdn1.ozone.ru/s3/multimedia-1/6000000000.jpg',
    inStock: true,
  };
}

/**
 * Generates simulated analogue products with cheaper prices for demo/testing mode
 * @param {string} query
 * @param {number|null} referencePrice
 * @param {number} count
 * @returns {Array<Object>}
 */
function getDemoAnalogs(query, referencePrice = null, count = 3) {
  const basePrice = referencePrice || 2500;
  const discounts = [0.28, 0.20, 0.12]; // 28%, 20%, 12% cheaper

  const demoItems = [];
  for (let i = 0; i < Math.min(count, discounts.length); i++) {
    const discountedPrice = Math.max(100, Math.round(basePrice * (1 - discounts[i])));
    const cardPrice = Math.round(discountedPrice * 0.95);
    const sku = `17${i + 1}9948485`;

    demoItems.push({
      sku,
      title: `${query} — Аналог / похожий товар #${i + 1}`,
      currentPrice: discountedPrice,
      cardPrice,
      oldPrice: basePrice,
      url: `https://www.ozon.ru/product/${sku}/`,
      imageUrl: 'https://cdn1.ozone.ru/s3/multimedia-1/6000000000.jpg',
      inStock: true,
    });
  }

  return demoItems;
}

/**
 * Parses an Ozon product page using Puppeteer
 * @param {string} url - canonical or full product URL
 * @param {string} [sku] - optional product SKU
 * @param {number|null} [currentDbPrice] - current price in DB (for demo mode)
 * @returns {Promise<{ title: string, currentPrice: number, cardPrice: number|null, oldPrice: number|null, imageUrl: string|null, inStock: boolean }>}
 */
async function parseOzonProduct(url, sku = null, currentDbPrice = null) {
  if (config.demoMode) {
    console.log(`[DEMO MODE] Имитация парсинга Ozon для URL: ${url}`);
    return getDemoProduct(sku || 'demo', currentDbPrice);
  }

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1440, height: 900 });

    const proxy = parseProxy(config.proxyUrl);
    if (proxy?.username && proxy?.password) {
      await page.authenticate({
        username: proxy.username,
        password: proxy.password,
      });
    }

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'sec-ch-ua-platform': '"Windows"',
    });

    // Load saved cookies if available
    const cookiesPath = path.resolve(__dirname, '../../data/ozon-cookies.json');
    if (fs.existsSync(cookiesPath)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
        if (Array.isArray(cookies) && cookies.length > 0) {
          await page.setCookie(...cookies);
        }
      } catch (err) {
        console.warn('[Puppeteer] Не удалось загрузить сохраненные куки:', err.message);
      }
    }

    let extractedData = null;

    // 1. Fast path: try Ozon's internal JSON API (entrypoint-api.bx) if SKU is known
    if (sku) {
      try {
        const apiUrl = `https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=%2Fproduct%2F${sku}%2F`;
        console.log(`[Ozon API] Быстрый запрос через entrypoint-api для SKU: ${sku}`);
        await page.goto(apiUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise((r) => setTimeout(r, 1200));

        const bodyText = await page.evaluate(() => document.body.innerText);
        if (bodyText && bodyText.startsWith('{')) {
          const json = JSON.parse(bodyText);
          if (json.widgetStates) {
            extractedData = parseWidgetStates(json.widgetStates);
          }
        }
      } catch (apiErr) {
        console.warn(`[Ozon API] Быстрый запрос не удался (${apiErr.message}), переходим к веб-странице...`);
      }
    }

    // 2. Fallback path: open regular product page if fast API did not yield prices
    if (!extractedData || (!extractedData.rawCardPrice && !extractedData.rawCurrentPrice)) {
      console.log(`[Puppeteer] Открываем веб-страницу Ozon: ${url}`);

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 35000,
      });

      // Wait for widget hydration
      await new Promise((resolve) => setTimeout(resolve, 3500));

      const pageTitle = await page.title();

      if (pageTitle.includes('нет соединения') || pageTitle.includes('Antibot') || pageTitle.includes('Captcha')) {
        const isGeoBlock = await page.evaluate(() => {
          return document.body.innerText.includes('Выключите VPN') || document.body.innerText.includes('нет соединения');
        });

        if (isGeoBlock) {
          throw new Error(
            'Ozon заблокировал IP адрес сервера (геоблокировка датацентра). ' +
            'Для работы парсера на удаленном сервере настройте PROXY_URL (российский прокси) в .env файле.'
          );
        }

        throw new Error(`Ozon показал проверку на бота (${pageTitle}). Запустите команду 'npm run solve-captcha' для прохождения проверки в окне браузера или настройте PROXY_URL.`);
      }

      // Extract product details from page DOM
      extractedData = await page.evaluate(() => {
        let rawTitle = null;
        let rawCardPrice = null;
        let rawCurrentPrice = null;
        let rawOldPrice = null;
        let rawImage = null;
        let inStock = true;

      // 1. Data-state containers
      const stateElements = document.querySelectorAll('[id^="state-"]');
      for (const el of stateElements) {
        const id = el.id || '';
        const stateAttr = el.getAttribute('data-state');
        if (!stateAttr) continue;

        try {
          const state = JSON.parse(stateAttr);

          if (id.includes('webProductHeading') || id.includes('webTitle')) {
            if (state.title) rawTitle = state.title;
          }

          if (id.includes('webPrice') || id.includes('webCurrentPrice')) {
            if (state.cardPrice) rawCardPrice = state.cardPrice;
            if (state.price) rawCurrentPrice = state.price;
            if (state.originalPrice) rawOldPrice = state.originalPrice;
          }

          if (id.includes('webGallery') || id.includes('webCover')) {
            if (state.coverImage) {
              rawImage = state.coverImage;
            } else if (Array.isArray(state.images) && state.images.length > 0) {
              rawImage = state.images[0].src || state.images[0];
            }
          }

          if (id.includes('webOutOfStock') || state.isOutOfStock) {
            inStock = false;
          }
        } catch {
          // ignore parsing error for single state
        }
      }

      // 2. Schema.org ld+json
      if (!rawCurrentPrice || !rawTitle) {
        const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const s of ldScripts) {
          try {
            const parsed = JSON.parse(s.textContent || '{}');
            if (parsed['@type'] === 'Product' || parsed.offers) {
              if (!rawTitle && parsed.name) rawTitle = parsed.name;
              if (!rawImage && parsed.image) {
                rawImage = Array.isArray(parsed.image) ? parsed.image[0] : parsed.image;
              }
              const offers = parsed.offers;
              if (offers) {
                const offerPrice = offers.price || (Array.isArray(offers) ? offers[0]?.price : null);
                if (!rawCurrentPrice && offerPrice) rawCurrentPrice = offerPrice;
              }
            }
          } catch {
            // ignore
          }
        }
      }

      // 3. Fallback to DOM elements
      if (!rawTitle) {
        const h1 = document.querySelector('h1');
        if (h1) rawTitle = h1.innerText.trim();
      }

      const priceWidget = document.querySelector('[data-widget="webPrice"]') || document.body;
      const allText = priceWidget.innerText;

      const priceMatches = allText.match(/\d[\d\s\u00A0\u2009]*[₽\u20BD]/g);
      if (priceMatches && priceMatches.length > 0) {
        if (!rawCardPrice && !rawCurrentPrice) {
          rawCardPrice = priceMatches[0];
        }
        if (priceMatches.length > 1 && !rawOldPrice) {
          rawOldPrice = priceMatches[1];
        }
      }

      if (
        document.body.innerText.includes('Товар закончился') ||
        document.body.innerText.includes('Этот товар закончился') ||
        document.body.innerText.includes('Нет в наличии')
      ) {
        inStock = false;
      }

      if (!rawImage) {
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage) rawImage = ogImage.getAttribute('content');
      }

      return {
        rawTitle,
        rawCardPrice,
        rawCurrentPrice,
        rawOldPrice,
        rawImage,
        inStock,
        pageTitle: document.title,
      };
    });
  }

    const cardPrice = cleanPrice(extractedData.rawCardPrice);
    const regularPrice = cleanPrice(extractedData.rawCurrentPrice);
    const oldPrice = cleanPrice(extractedData.rawOldPrice);

    let title = extractedData.rawTitle;
    if (!title && extractedData.pageTitle) {
      title = extractedData.pageTitle.split('купить по выгодной')[0].split('- Ozon')[0].trim();
    }
    if (!title) {
      title = sku ? `Товар Ozon #${sku}` : 'Товар Ozon';
    }

    const effectivePrice = cardPrice || regularPrice || oldPrice;

    if (!effectivePrice) {
      throw new Error('Не удалось найти цену на странице товара.');
    }

    return {
      title,
      currentPrice: effectivePrice,
      cardPrice: cardPrice || null,
      oldPrice: oldPrice || (cardPrice && regularPrice && cardPrice !== regularPrice ? regularPrice : null),
      imageUrl: extractedData.rawImage || null,
      inStock: extractedData.inStock,
    };
  } finally {
    try {
      await page.close();
    } catch {
      // ignore
    }
    scheduleBrowserClose(60000);
  }
}

/**
 * Extracts product items from Ozon search widgetStates JSON object
 * @param {Object} widgetStates
 * @param {string} defaultQuery
 * @returns {Array<Object>}
 */
function extractItemsFromSearchWidgetStates(widgetStates, defaultQuery = '') {
  const items = [];
  const seenSkus = new Set();

  if (!widgetStates || typeof widgetStates !== 'object') {
    return items;
  }

  for (const rawVal of Object.values(widgetStates)) {
    try {
      const state = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
      if (!state || typeof state !== 'object') continue;

      const candidates = Array.isArray(state.items)
        ? state.items
        : Array.isArray(state.tiles)
        ? state.tiles
        : Array.isArray(state.products)
        ? state.products
        : [];

      for (const item of candidates) {
        if (!item || typeof item !== 'object') continue;

        // 1. Extract SKU / ID
        let sku = null;
        if (item.sku) {
          sku = String(item.sku);
        } else if (item.id) {
          sku = String(item.id);
        } else if (item.action?.link) {
          const match = item.action.link.match(/\/product\/.*?(\d{6,})\/?/);
          if (match) sku = match[1];
        } else if (item.link) {
          const match = item.link.match(/\/product\/.*?(\d{6,})\/?/);
          if (match) sku = match[1];
        }
        if (!sku || seenSkus.has(sku)) continue;

        // 2. Extract Price & Card Price
        let rawPrice = item.price || item.currentPrice || null;
        let rawCardPrice = item.cardPrice || null;
        let rawOldPrice = item.originalPrice || item.oldPrice || null;

        if (Array.isArray(item.mainState)) {
          for (const sub of item.mainState) {
            // Modern Ozon format: priceV2
            if (sub.priceV2) {
              const priceList = Array.isArray(sub.priceV2.price) ? sub.priceV2.price : [];
              const styleType = sub.priceV2.priceStyle?.styleType;
              const isCard = styleType === 'CARD_PRICE';

              for (const p of priceList) {
                if (p && p.text) {
                  if (isCard && !rawCardPrice) {
                    rawCardPrice = p.text;
                  } else if (!rawPrice) {
                    rawPrice = p.text;
                  } else if (!rawOldPrice) {
                    rawOldPrice = p.text;
                  }
                }
              }
            }

            // Legacy Ozon format: atom.price
            if (sub.atom?.price) {
              if (sub.atom.price.price) rawPrice = sub.atom.price.price;
              if (sub.atom.price.cardPrice) rawCardPrice = sub.atom.price.cardPrice;
              if (sub.atom.price.originalPrice) rawOldPrice = sub.atom.price.originalPrice;
            }
          }
        }

        const cardPrice = cleanPrice(rawCardPrice);
        const regularPrice = cleanPrice(rawPrice);
        const oldPrice = cleanPrice(rawOldPrice);
        const effectivePrice = cardPrice || regularPrice;

        if (!effectivePrice) continue;

        // 3. Extract Title
        let title = item.title || item.name || null;
        if (Array.isArray(item.mainState)) {
          for (const sub of item.mainState) {
            // Modern Ozon format: textDS
            if (sub.textDS?.text) {
              title = sub.textDS.text;
              break;
            }
            // Legacy format: atom.textAtom
            if (sub.atom?.textAtom?.text) {
              title = sub.atom.textAtom.text;
              break;
            }
          }
        }
        if (!title && item.action?.link) {
          const titleMatch = item.action.link.match(/\/product\/(.*?)-?\d{6,}\/?/);
          if (titleMatch && titleMatch[1]) {
            title = decodeURIComponent(titleMatch[1]).replace(/-/g, ' ');
          }
        }

        // 4. Extract Image
        let imageUrl = item.image || null;
        if (!imageUrl && item.tileImage?.items) {
          for (const tImg of item.tileImage.items) {
            if (tImg.image?.link) {
              imageUrl = tImg.image.link;
              break;
            }
          }
        }
        if (!imageUrl && Array.isArray(item.images) && item.images.length > 0) {
          imageUrl = item.images[0]?.src || item.images[0];
        }

        // 5. Clean Link
        let itemUrl = `https://www.ozon.ru/product/${sku}/`;
        if (item.action?.link) {
          const cleanPath = item.action.link.split('?')[0];
          itemUrl = cleanPath.startsWith('http') ? cleanPath : `https://www.ozon.ru${cleanPath}`;
        }

        seenSkus.add(sku);
        items.push({
          sku,
          title: title ? title.trim() : (defaultQuery || `Товар ${sku}`),
          currentPrice: effectivePrice,
          cardPrice: cardPrice || null,
          oldPrice: oldPrice || null,
          url: itemUrl,
          imageUrl,
          inStock: true,
        });
      }
    } catch {
      // skip invalid state block
    }
  }

  return items;
}

/**
 * Searches Ozon for products matching a query string strictly via entrypoint-api JSON
 * @param {string} query - Clean search query
 * @param {number|null} referencePrice - Current product price for savings comparison
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array<{ sku: string, title: string, currentPrice: number, cardPrice: number|null, oldPrice: number|null, url: string, imageUrl: string|null, inStock: boolean }>>}
 */
async function searchOzonProducts(query, referencePrice = null, limit = 5) {
  if (config.demoMode) {
    console.log(`[DEMO MODE] Имитация поиска аналогов Ozon для запроса: "${query}"`);
    return getDemoAnalogs(query, referencePrice, limit);
  }

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1440, height: 900 });

    const proxy = parseProxy(config.proxyUrl);
    if (proxy?.username && proxy?.password) {
      await page.authenticate({
        username: proxy.username,
        password: proxy.password,
      });
    }

    await page.setExtraHTTPHeaders({
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'sec-ch-ua-platform': '"Windows"',
      'Referer': 'https://www.ozon.ru/',
    });

    // Load saved cookies if available
    const cookiesPath = path.resolve(__dirname, '../../data/ozon-cookies.json');
    if (fs.existsSync(cookiesPath)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
        if (Array.isArray(cookies) && cookies.length > 0) {
          await page.setCookie(...cookies);
        }
      } catch (err) {
        console.warn('[Puppeteer] Не удалось загрузить сохраненные куки:', err.message);
      }
    }

    // Decode first to prevent accidental double-encoding (%25D0)
    let cleanQuery = String(query || '').trim();
    try {
      if (cleanQuery.includes('%')) {
        cleanQuery = decodeURIComponent(cleanQuery);
      }
    } catch {
      // ignore decode error
    }

    // Construct search path and encode it once into the url parameter
    const searchPath = `/search/?from_global=true&sorting=price&text=${cleanQuery}`;
    const apiUrl = `https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=${encodeURIComponent(searchPath)}`;

    console.log(`[Ozon API] Поиск аналогов и похожих товаров через entrypoint-api: "${cleanQuery}"`);
    console.log(`[Ozon API] URL: ${apiUrl}`);

    let items = [];

    const response = await page.goto(apiUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await new Promise((r) => setTimeout(r, 1200));

    let json = null;
    try {
      if (response && typeof response.json === 'function') {
        json = await response.json();
      }
    } catch {
      // If Puppeteer rendered as plain text in document.body
    }

    if (!json) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (bodyText && bodyText.startsWith('{')) {
        try {
          json = JSON.parse(bodyText);
        } catch {
          // ignore
        }
      }
    }

    if (json && json.widgetStates) {
      items = extractItemsFromSearchWidgetStates(json.widgetStates, cleanQuery);
      console.log(`[Ozon API] Найдено товаров в ответе API: ${items.length}`);
    } else {
      console.warn(`[Ozon API] Ответ entrypoint-api не содержит widgetStates или пуст`);
    }

    return items.slice(0, limit);
  } catch (err) {
    console.error('[OzonParser] Ошибка при запросе к entrypoint-api поиска:', err.message);
    return [];
  } finally {
    try {
      await page.close();
    } catch {
      // ignore
    }
    scheduleBrowserClose(60000);
  }
}

async function closeSharedBrowser() {
  const isConnected = sharedBrowser && (typeof sharedBrowser.isConnected === 'function' ? sharedBrowser.isConnected() : sharedBrowser.connected);
  if (isConnected) {
    try {
      if (sharedBrowser._isRemote) {
        sharedBrowser.disconnect();
      } else {
        await sharedBrowser.close();
      }
    } catch (err) {
      console.warn('[Puppeteer] Error closing browser:', err.message);
    } finally {
      sharedBrowser = null;
    }
  }
}

module.exports = {
  parseOzonProduct,
  cleanPrice,
  getDemoProduct,
  getDemoAnalogs,
  searchOzonProducts,
  extractItemsFromSearchWidgetStates,
  getBrowser,
  closeSharedBrowser,
};
