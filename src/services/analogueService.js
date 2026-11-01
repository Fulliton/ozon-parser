const { productRepository } = require('../repositories');
const { searchOzonProducts } = require('./ozonParserService');

/**
 * Cleans technical brackets (e.g. [SKU: ...]) from title while preserving the full product title
 * @param {string} title
 * @returns {string}
 */
function cleanProductTitleForSearch(title) {
  if (!title || typeof title !== 'string') return '';
  return title
    .replace(/\[SKU:[^\]]*\]/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

class AnalogueService {
  /**
   * Finds cheaper analogues and similar products for an existing tracked product
   * Searches directly by the product's actual title
   *
   * @param {number} productId - Database product ID
   * @param {number} limit - Maximum number of analogues to return
   * @returns {Promise<{ originalProduct: Object, query: string, analogs: Array<Object> }>}
   */
  async findAnalogsForProduct(productId, limit = 3) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new Error(`Товар с ID ${productId} не найден в базе данных.`);
    }

    const originalPrice = product.cardPrice || product.currentPrice;

    // Search strictly by the actual product title
    const searchQuery = cleanProductTitleForSearch(product.title) || product.title;

    let foundItems = await searchOzonProducts(searchQuery, originalPrice, limit * 4);

    // If full title gave 0 items and title is very long, try first 5 words as fallback
    if (foundItems.length === 0 && searchQuery.split(/\s+/).length > 5) {
      const shortQuery = searchQuery.split(/\s+/).slice(0, 5).join(' ');
      foundItems = await searchOzonProducts(shortQuery, originalPrice, limit * 4);
    }

    // Filter items:
    // 1. Exclude the original product itself (by SKU)
    // 2. Only keep items strictly cheaper than original price
    const cheaperAnalogs = foundItems
      .filter((item) => {
        if (!item.sku || item.sku === product.sku) return false;
        const price = item.cardPrice || item.currentPrice;
        return price && price < originalPrice;
      })
      .map((item) => {
        const itemPrice = item.cardPrice || item.currentPrice;
        const savingsRub = originalPrice - itemPrice;
        const savingsPercent = Math.round((savingsRub / originalPrice) * 100);

        return {
          ...item,
          effectivePrice: itemPrice,
          savingsRub,
          savingsPercent,
        };
      })
      // Sort by greatest savings first (lowest price first)
      .sort((a, b) => b.savingsRub - a.savingsRub)
      .slice(0, limit);

    return {
      originalProduct: product,
      query: searchQuery,
      analogs: cheaperAnalogs,
    };
  }

  /**
   * Searches for cheaper products by free-form text query
   *
   * @param {string} query
   * @param {number|null} referencePrice
   * @param {number} limit
   * @returns {Promise<Array<Object>>}
   */
  async findAnalogsByQuery(query, referencePrice = null, limit = 3) {
    const searchQuery = String(query || '').trim();
    const items = await searchOzonProducts(searchQuery, referencePrice, limit);

    return items.map((item) => {
      const itemPrice = item.cardPrice || item.currentPrice;
      const savingsRub = referencePrice && referencePrice > itemPrice ? referencePrice - itemPrice : 0;
      const savingsPercent = referencePrice && savingsRub > 0 ? Math.round((savingsRub / referencePrice) * 100) : 0;

      return {
        ...item,
        effectivePrice: itemPrice,
        savingsRub,
        savingsPercent,
      };
    });
  }
}

module.exports = new AnalogueService();
module.exports.cleanProductTitleForSearch = cleanProductTitleForSearch;
