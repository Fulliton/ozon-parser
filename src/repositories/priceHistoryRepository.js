const BaseRepository = require('./baseRepository');
const { PriceHistory } = require('../database/models');

class PriceHistoryRepository extends BaseRepository {
  constructor() {
    super(PriceHistory);
  }

  /**
   * Adds a new price history entry
   * @param {number} productId
   * @param {number} price
   * @param {number|null} cardPrice
   * @returns {Promise<Object>}
   */
  async addRecord(productId, price, cardPrice = null) {
    const item = await PriceHistory.create({
      productId,
      price,
      cardPrice: cardPrice || null,
      recordedAt: new Date(),
    });

    return item.toJSON();
  }

  /**
   * Retrieves price history for a product sorted from newest to oldest
   * @param {number} productId
   * @param {number} [limit=20]
   * @returns {Promise<Array<Object>>}
   */
  async getByProductId(productId, limit = 20) {
    const rows = await PriceHistory.findAll({
      where: { productId },
      order: [
        ['id', 'DESC'],
      ],
      limit,
    });

    return rows.map((r) => r.toJSON());
  }
}

module.exports = new PriceHistoryRepository();
