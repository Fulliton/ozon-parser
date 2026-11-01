/**
 * Set of marketing stop words and filler words commonly found in marketplace product titles
 */
const STOP_WORDS = new Set([
  // Promo and marketing buzzwords
  'скидка', 'скидки', 'акция', 'акции', 'распродажа', 'новинка', 'новинки',
  'хит', 'топ', 'топ-10', 'подарок', 'подарки', 'подарочный', 'подарочная',
  'лучший', 'лучшая', 'лучшие', 'оригинал', 'оригинальный', 'оригинальная',
  'выгодно', 'дешево', 'супер', 'премиум', 'premium', 'sale', 'new', 'hit', 'original',
  'распродажа', 'sale', 'промо', 'promo', 'тренд', 'тренд2024', 'тренд2025', 'тренд2026',
  'гарантия', 'качество', 'люкс', 'luxury',

  // Target audience fillers
  'мужчин', 'мужской', 'мужская', 'мужчине', 'мужу',
  'женщин', 'женский', 'женская', 'женщине', 'жене',
  'детей', 'детский', 'детская', 'детям', 'ребенку',
  'маме', 'папе', 'парню', 'девушке', 'другу', 'подруге',

  // Russian prepositions and particles
  'для', 'со', 'во', 'под', 'над', 'при', 'про', 'через',
  'или', 'как', 'так', 'это', 'тот', 'свой', 'весь', 'все',
  'без', 'что', 'чем', 'где', 'куда', 'тут', 'там', 'еще',
  'уже', 'тоже', 'также', 'очень', 'самый', 'самая', 'самое',
  'год', 'года', 'лет', 'штук', 'штуки', 'набор', 'комплект',
]);

/**
 * Cleans a marketplace product title and extracts core search keywords
 * to find matching analogues on Ozon or other marketplaces.
 *
 * @param {string} title - Raw product title
 * @param {number} maxWords - Maximum number of keywords to return (default: 4)
 * @returns {string} - Clean search query string
 */
function extractSearchKeywords(title, maxWords = 4) {
  if (!title || typeof title !== 'string') {
    return '';
  }

  // 1. Remove bracketed text, e.g. [SKU: 12345], (Черный), {500 мл}
  let cleaned = title
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\{[^}]*\}/g, ' ');

  // 2. Replace separators and punctuation with space
  cleaned = cleaned.replace(/[,;:/\\|!?"'«»~*_+=#$@%&<>]/g, ' ');

  // 3. Tokenize words
  const words = cleaned
    .trim()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  // 4. Filter out stop words and single-letter prepositions
  const meaningfulWords = [];
  for (const word of words) {
    const lower = word.toLowerCase();

    // Skip short words unless it's a known model abbreviation or number (e.g. "M3", "5G", "S9")
    if (word.length <= 2 && !/\d/.test(word)) {
      continue;
    }

    // Skip stop words
    if (STOP_WORDS.has(lower)) {
      continue;
    }

    meaningfulWords.push(word);

    if (meaningfulWords.length >= maxWords) {
      break;
    }
  }

  // Fallback: if all words were stripped, return the first few words of cleaned title
  if (meaningfulWords.length === 0) {
    return words.slice(0, 3).join(' ');
  }

  return meaningfulWords.join(' ');
}

module.exports = {
  extractSearchKeywords,
  STOP_WORDS,
};
