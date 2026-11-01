const { productRepository, subscriptionRepository } = require('../repositories');
const { parseOzonProduct } = require('./ozonParserService');
const { isOzonUrl, extractOzonSku, extractUrlFromText } = require('../utils/urlParser');

class ProductService {
  /**
   * Tracks an Ozon product from raw text/link for a specific user
   * @param {number} userId - Telegram user ID
   * @param {string} text - text containing Ozon URL
   * @returns {Promise<{ product: Object, isNewSubscription: boolean }>}
   */
  async trackProduct(userId, text) {
    if (!isOzonUrl(text)) {
      throw new Error('Указанный текст не содержит валидной ссылки на Ozon.');
    }

    const rawUrl = extractUrlFromText(text);
    if (!rawUrl) {
      throw new Error('Не удалось извлечь URL из сообщения.');
    }

    const skuInfo = await extractOzonSku(rawUrl);
    if (!skuInfo) {
      throw new Error('Не удалось определить артикул (SKU) товара.');
    }

    const { sku, canonicalUrl } = skuInfo;

    // Check if product already exists in database
    const existing = await productRepository.findBySku(sku);

    // Parse product details via Puppeteer service
    const productData = await parseOzonProduct(
      canonicalUrl,
      sku,
      existing ? existing.currentPrice : null
    );

    // Save/update product in database through repository
    const product = await productRepository.upsert({
      sku,
      url: canonicalUrl,
      title: productData.title,
      currentPrice: productData.currentPrice,
      oldPrice: productData.oldPrice,
      cardPrice: productData.cardPrice,
      imageUrl: productData.imageUrl,
      inStock: productData.inStock ? 1 : 0,
    });

    // Create user subscription through repository
    const isNewSubscription = await subscriptionRepository.subscribe(userId, product.id);

    return {
      product,
      isNewSubscription,
    };
  }

  /**
   * Retrieves all products tracked by a user
   * @param {number} userId
   * @returns {Promise<Array<Object>>}
   */
  async getUserProducts(userId) {
    return subscriptionRepository.getUserProducts(userId);
  }

  /**
   * Retrieves product by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async getProductById(id) {
    return productRepository.findById(id);
  }

  /**
   * Retrieves product by SKU
   * @param {string} sku
   * @returns {Promise<Object|null>}
   */
  async getProductBySku(sku) {
    return productRepository.findBySku(sku);
  }

  /**
   * Re-fetches the latest price and details from Ozon for a single product
   * @param {number} productId
   * @returns {Promise<Object>}
   */
  async refreshProduct(productId) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new Error(`Товар с ID ${productId} не найден.`);
    }

    const productData = await parseOzonProduct(
      product.url,
      product.sku,
      product.currentPrice
    );

    const updated = await productRepository.upsert({
      sku: product.sku,
      url: product.url,
      title: productData.title || product.title,
      currentPrice: productData.currentPrice,
      oldPrice: product.currentPrice,
      cardPrice: productData.cardPrice,
      imageUrl: productData.imageUrl || product.imageUrl,
      inStock: productData.inStock !== false,
    });

    return updated;
  }
}

module.exports = new ProductService();
