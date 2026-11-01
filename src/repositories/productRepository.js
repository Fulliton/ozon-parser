const BaseRepository = require('./baseRepository');
const { Product, Subscription, PriceHistory } = require('../database/models');

class ProductRepository extends BaseRepository {
  constructor() {
    super(Product);
  }

  /**
   * Finds a product by its primary key
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const item = await Product.findByPk(id);
    return item ? item.toJSON() : null;
  }

  /**
   * Finds a product by its unique SKU
   * @param {string} sku
   * @returns {Promise<Object|null>}
   */
  async findBySku(sku) {
    const item = await Product.findOne({ where: { sku } });
    return item ? item.toJSON() : null;
  }

  /**
   * Upserts product details and records initial price history
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async upsert({ sku, url, title, currentPrice, oldPrice, cardPrice, imageUrl, inStock = true }) {
    const now = new Date();
    let product = await Product.findOne({ where: { sku } });

    if (product) {
      await product.update({
        title: title || product.title,
        currentPrice,
        cardPrice: cardPrice !== undefined ? cardPrice : product.cardPrice,
        imageUrl: imageUrl || product.imageUrl,
        inStock: inStock !== undefined ? inStock : product.inStock,
        lastCheckedAt: now,
        lastParsedAt: now,
      });

      return product.toJSON();
    }

    product = await Product.create({
      sku,
      url,
      title,
      currentPrice,
      oldPrice: oldPrice || null,
      cardPrice: cardPrice || null,
      imageUrl: imageUrl || null,
      inStock,
      lastCheckedAt: now,
      lastParsedAt: now,
    });

    // Record initial price history
    await PriceHistory.create({
      productId: product.id,
      price: currentPrice,
      cardPrice: cardPrice || null,
      recordedAt: now,
    });

    return product.toJSON();
  }

  /**
   * Updates price, records history and updates last_parsed_at
   * @param {number} id
   * @param {number} newPrice
   * @param {number|null} newCardPrice
   * @returns {Promise<Object>}
   */
  async updatePrice(id, newPrice, newCardPrice = null) {
    const product = await Product.findByPk(id);
    if (!product) {
      throw new Error(`Товар с ID ${id} не найден`);
    }

    const oldPrice = product.currentPrice;
    const now = new Date();

    await product.update({
      oldPrice,
      currentPrice: newPrice,
      cardPrice: newCardPrice,
      lastCheckedAt: now,
      lastParsedAt: now,
    });

    await PriceHistory.create({
      productId: id,
      price: newPrice,
      cardPrice: newCardPrice,
      recordedAt: now,
    });

    return product.toJSON();
  }

  /**
   * Updates last_checked_at and last_parsed_at timestamps
   * @param {number} id
   * @returns {Promise<void>}
   */
  async updateLastParsed(id) {
    const now = new Date();
    await Product.update(
      {
        lastCheckedAt: now,
        lastParsedAt: now,
      },
      { where: { id } }
    );
  }

  /**
   * Retrieves all unique products that currently have at least one active subscriber
   * @returns {Promise<Array<Object>>}
   */
  async getAllTracked() {
    const products = await Product.findAll({
      include: [
        {
          model: Subscription,
          as: 'subscriptions',
          required: true,
          attributes: [],
        },
      ],
      distinct: true,
    });

    return products.map((p) => p.toJSON());
  }

  /**
   * Deletes a product by ID
   * @param {number} id
   * @returns {Promise<number>}
   */
  async delete(id) {
    return Product.destroy({ where: { id } });
  }
}

module.exports = new ProductRepository();
