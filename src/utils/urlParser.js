const axios = require('axios');

/**
 * Checks if a string contains an Ozon product link
 * @param {string} text
 * @returns {boolean}
 */
function isOzonUrl(text) {
  if (!text || typeof text !== 'string') return false;
  return /(?:https?:\/\/)?(?:www\.)?(?:ozon\.ru|ozon\.onelink\.me)/i.test(text);
}

/**
 * Extracts raw URL from text
 * @param {string} text
 * @returns {string|null}
 */
function extractUrlFromText(text) {
  if (!text) return null;
  const match = text.match(/(?:https?:\/\/)?(?:www\.)?(?:ozon\.ru|ozon\.onelink\.me)[^\s]*/i) ||
                text.match(/https?:\/\/[^\s]+/i);
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
 * without loading heavy HTML or triggering redirect loops.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function resolveRedirectUrl(url) {
  let currentUrl = url.trim();
  if (!/^https?:\/\//i.test(currentUrl)) {
    currentUrl = `https://${currentUrl}`;
  }

  for (let i = 0; i < 5; i++) {
    // If it's already a full product URL with SKU, we don't need further redirects
    if (/\/product\/(?:[^/]+-)?\d+/i.test(currentUrl) || /[?&](?:sku|id)=\d+/i.test(currentUrl)) {
      return currentUrl;
    }

    try {
      const response = await axios.get(currentUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        },
        timeout: 10000,
      });

      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        currentUrl = new URL(response.headers.location, currentUrl).href;
      } else {
        return currentUrl;
      }
    } catch (error) {
      if (error.response && error.response.headers && error.response.headers.location) {
        currentUrl = new URL(error.response.headers.location, currentUrl).href;
      } else {
        break;
      }
    }
  }

  return currentUrl;
}

/**
 * Extracts SKU (Product ID) from an Ozon URL
 * @param {string} rawUrl
 * @returns {Promise<{ sku: string, canonicalUrl: string } | null>}
 */
async function extractOzonSku(rawUrl) {
  if (!rawUrl) return null;

  let url = rawUrl.trim();

  // If it's a short link or redirect link, follow it first
  if (url.includes('/t/') || url.includes('onelink.me') || !/\/product\//i.test(url)) {
    url = await resolveRedirectUrl(url);
  }

  // Common patterns for Ozon products:
  // 1) /product/...-(123456789)/ or /product/123456789/
  // 2) /product/smartfon-123456789
  // 3) ?sku=123456789 or ?id=123456789

  const productMatch = url.match(/\/product\/(?:[^/]+-)?(\d+)(?:\/|\?|$)/i);
  if (productMatch && productMatch[1]) {
    const sku = productMatch[1];
    return {
      sku,
      canonicalUrl: `https://www.ozon.ru/product/${sku}/`,
    };
  }

  // Check query parameter ?sku=...
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const querySku = urlObj.searchParams.get('sku') || urlObj.searchParams.get('id');
    if (querySku && /^\d+$/.test(querySku)) {
      return {
        sku: querySku,
        canonicalUrl: `https://www.ozon.ru/product/${querySku}/`,
      };
    }
  } catch (e) {
    // ignore URL parsing error
  }

  return null;
}

module.exports = {
  isOzonUrl,
  extractUrlFromText,
  resolveRedirectUrl,
  extractOzonSku,
};
