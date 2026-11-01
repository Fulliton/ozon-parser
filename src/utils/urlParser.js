const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const config = require('../config');

/**
 * Checks if a string contains an Ozon product link or direct SKU
 * @param {string} text
 * @returns {boolean}
 */
function isOzonUrl(text) {
  if (!text || typeof text !== 'string') return false;

  // Direct SKU input (e.g. "123456789" or "артикул: 123456789")
  if (/^(?:(?:артикул|арт|sku)\s*[:#№]?\s*)?\d{6,15}$/i.test(text.trim())) {
    return true;
  }

  // Ozon domains: ozon.ru, ozon.by, ozon.kz, ozon.onelink.me
  return /(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)?(?:ozon\.(?:ru|by|kz)|ozon\.onelink\.me)/i.test(text);
}

/**
 * Extracts raw URL or direct SKU from text
 * @param {string} text
 * @returns {string|null}
 */
function extractUrlFromText(text) {
  if (!text) return null;

  const trimmed = text.trim();

  // If user sent direct SKU / article
  const skuMatch = trimmed.match(/^(?:(?:артикул|арт|sku)\s*[:#№]?\s*)?(\d{6,15})$/i);
  if (skuMatch) {
    return skuMatch[1];
  }

  const match = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)?(?:ozon\.(?:ru|by|kz)|ozon\.onelink\.me)[^\s]*/i) ||
                trimmed.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;

  let url = match[0];
  // Strip trailing punctuation often attached from messengers
  url = url.replace(/[),.;:!]+$/, '');

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  return url;
}

/**
 * Resolves short links (e.g. ozon.ru/t/..., onelink.me) by following HTTP redirects
 * with proxy support and fallback to real Chrome browser if datacenter IP is blocked.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function resolveRedirectUrl(url) {
  let currentUrl = url.trim();
  if (!/^https?:\/\//i.test(currentUrl)) {
    currentUrl = `https://${currentUrl}`;
  }

  let httpsAgent = null;
  if (config.proxyUrl) {
    try {
      httpsAgent = new HttpsProxyAgent(config.proxyUrl);
    } catch (e) {
      console.warn('[UrlParser] Не удалось инициализировать HttpsProxyAgent:', e.message);
    }
  }

  for (let i = 0; i < 5; i++) {
    // If it's already a full product URL with SKU, we don't need further redirects
    if (/\/product\/(?:[^/]+-)?\d+/i.test(currentUrl) || /[?&](?:sku|id)=\d+/i.test(currentUrl)) {
      return currentUrl;
    }

    try {
      console.log(`[UrlParser] Резолв редиректа шаг ${i + 1}: ${currentUrl}`);
      const response = await axios.get(currentUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        },
        httpsAgent: httpsAgent || undefined,
        timeout: 10000,
      });

      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        const nextUrl = new URL(response.headers.location, currentUrl).href;
        console.log(`[UrlParser] Редирект HTTP ${response.status} -> ${nextUrl}`);
        currentUrl = nextUrl;
      } else {
        return currentUrl;
      }
    } catch (error) {
      if (error.response && error.response.headers && error.response.headers.location) {
        const nextUrl = new URL(error.response.headers.location, currentUrl).href;
        console.log(`[UrlParser] Редирект (через catch) -> ${nextUrl}`);
        currentUrl = nextUrl;
      } else {
        console.warn(`[UrlParser] Не удалось разрешить редирект через axios на ${currentUrl}: ${error.response?.status ? 'HTTP ' + error.response.status : error.message}`);
        break;
      }
    }
  }

  // Fallback to real browser if axios was blocked by Ozon Cloudflare/Kasada
  if (currentUrl.includes('/t/') || currentUrl.includes('onelink.me')) {
    console.log(`[UrlParser] Попытка разрешить короткую ссылку через Puppeteer: ${currentUrl}`);
    try {
      const { resolveUrlViaBrowser } = require('../services/ozonParserService');
      if (typeof resolveUrlViaBrowser === 'function') {
        const browserUrl = await resolveUrlViaBrowser(currentUrl);
        if (browserUrl && browserUrl !== currentUrl) {
          console.log(`[UrlParser] Puppeteer успешно разрешил редирект -> ${browserUrl}`);
          currentUrl = browserUrl;
        }
      }
    } catch (browserErr) {
      console.warn(`[UrlParser] Не удалось разрешить короткую ссылку через браузер: ${browserErr.message}`);
    }
  }

  return currentUrl;
}

/**
 * Extracts SKU (Product ID) from an Ozon URL or raw text
 * @param {string} rawUrl
 * @returns {Promise<{ sku: string, canonicalUrl: string } | null>}
 */
async function extractOzonSku(rawUrl) {
  if (!rawUrl) return null;

  let url = String(rawUrl).trim();

  // 1. Direct SKU input (e.g. 123456789)
  if (/^\d{6,15}$/.test(url)) {
    console.log(`[UrlParser] Распознан прямой артикул товара: ${url}`);
    return {
      sku: url,
      canonicalUrl: `https://www.ozon.ru/product/${url}/`,
    };
  }

  console.log(`[UrlParser] Анализ ссылки: "${url}"`);

  // 2. If it's a short link or redirect link, follow it first
  if (url.includes('/t/') || url.includes('onelink.me') || !/\/product\//i.test(url)) {
    url = await resolveRedirectUrl(url);
  }

  // 3. Check if user sent a non-product section link (catalog, search, cart, etc.)
  const nonProductMatch = url.match(/\/(category|search|brand|seller|cart|my|highlight)\b/i);
  if (nonProductMatch) {
    const section = nonProductMatch[1].toLowerCase();
    const sectionNames = {
      category: 'раздел каталога',
      search: 'результаты поиска',
      brand: 'страницу бренда',
      seller: 'страницу продавца',
      cart: 'корзину',
      my: 'личный кабинет',
      highlight: 'подборку товаров',
    };
    const name = sectionNames[section] || 'общий раздел';
    console.warn(`[UrlParser] Ссылка указывает на ${name}: ${url}`);
    throw new Error(`Вы отправили ссылку на ${name}, а не на конкретный товар. Пожалуйста, откройте карточку товара и скопируйте ссылку на неё.`);
  }

  // 4. Pattern: /product/...-(123456789)/ or /product/123456789
  const productMatch = url.match(/\/products?\/(?:[^/]+-)?(\d{5,15})(?:\/|\?|#|$)/i);
  if (productMatch && productMatch[1]) {
    const sku = productMatch[1];
    console.log(`[UrlParser] Извлечен SKU из пути URL: ${sku}`);
    return {
      sku,
      canonicalUrl: `https://www.ozon.ru/product/${sku}/`,
    };
  }

  // 5. Pattern: /context/detail/id/(123456789)/
  const contextMatch = url.match(/\/context\/detail\/id\/(\d{5,15})(?:\/|\?|#|$)/i);
  if (contextMatch && contextMatch[1]) {
    const sku = contextMatch[1];
    console.log(`[UrlParser] Извлечен SKU из legacy пути URL: ${sku}`);
    return {
      sku,
      canonicalUrl: `https://www.ozon.ru/product/${sku}/`,
    };
  }

  // 6. Pattern: query parameters (?sku=..., ?id=..., ?product_id=..., ?item_id=...)
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const querySku = urlObj.searchParams.get('sku') ||
                     urlObj.searchParams.get('id') ||
                     urlObj.searchParams.get('product_id') ||
                     urlObj.searchParams.get('item_id') ||
                     urlObj.searchParams.get('origin_sku');

    if (querySku && /^\d{5,15}$/.test(querySku)) {
      console.log(`[UrlParser] Извлечен SKU из query-параметра: ${querySku}`);
      return {
        sku: querySku,
        canonicalUrl: `https://www.ozon.ru/product/${querySku}/`,
      };
    }
  } catch (e) {
    // ignore URL parsing error
  }

  console.warn(`[UrlParser] Не удалось определить артикул в URL: "${url}" (исходный: "${rawUrl}")`);
  return null;
}

module.exports = {
  isOzonUrl,
  extractUrlFromText,
  resolveRedirectUrl,
  extractOzonSku,
};
