const BaseRepository = require('./baseRepository');
const { Subscription, Product } = require('../database/models');

class SubscriptionRepository extends BaseRepository {
  constructor() {
    super(Subscription);
  }

  /**
   * Subscribes a user to a product (safe against duplicates)
   * @param {number} userId
   * @param {number} productId
   * @returns {Promise<boolean>} true if newly subscribed, false if already existed
   */
  async subscribe(userId, productId) {
    const [, created] = await Subscription.findOrCreate({
      where: { userId, productId },
      defaults: { userId, productId },
    });

    return created;
  }

  /**
   * Sets or updates target price for a user's subscription
   * @param {number} userId
   * @param {number} productId
   * @param {number|null} targetPrice
   * @returns {Promise<boolean>}
   */
  async setTargetPrice(userId, productId, targetPrice) {
    const [affected] = await Subscription.update(
      { targetPrice: targetPrice ? Math.round(targetPrice) : null },
      { where: { userId, productId } }
    );
    return affected > 0;
  }

  /**
   * Clears target price for a user's subscription
   * @param {number} userId
   * @param {number} productId
   * @returns {Promise<boolean>}
   */
  async clearTargetPrice(userId, productId) {
    return this.setTargetPrice(userId, productId, null);
  }

  /**
   * Unsubscribes a user from a product
   * @param {number} userId
   * @param {number} productId
   * @returns {Promise<boolean>}
   */
  async unsubscribe(userId, productId) {
    const deletedCount = await Subscription.destroy({
      where: { userId, productId },
    });

    return deletedCount > 0;
  }

  /**
   * Checks if user is subscribed to a product
   * @param {number} userId
   * @param {number} productId
   * @returns {Promise<boolean>}
   */
  async isSubscribed(userId, productId) {
    const count = await Subscription.count({
      where: { userId, productId },
    });

    return count > 0;
  }

  /**
   * Retrieves subscription details for a specific user and product
   * @param {number} userId
   * @param {number} productId
   * @returns {Promise<Object|null>}
   */
  async getSubscription(userId, productId) {
    const sub = await Subscription.findOne({
      where: { userId, productId },
    });
    return sub ? sub.toJSON() : null;
  }

  /**
   * Retrieves all products subscribed to by a specific user
   * @param {number} userId
   * @returns {Promise<Array<Object>>}
   */
  async getUserProducts(userId) {
    const subscriptions = await Subscription.findAll({
      where: { userId },
      include: [
        {
          model: Product,
          as: 'product',
          required: true,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return subscriptions.map((s) => {
      const p = s.product.toJSON();
      return {
        ...p,
        targetPrice: s.targetPrice,
        subscribedAt: s.createdAt,
      };
    });
  }

  /**
   * Retrieves all user IDs subscribed to a given product
   * @param {number} productId
   * @returns {Promise<Array<number>>}
   */
  async getSubscribersByProductId(productId) {
    const rows = await Subscription.findAll({
      where: { productId },
      attributes: ['userId'],
    });

    return rows.map((r) => Number(r.userId));
  }

  /**
   * Retrieves all subscriptions (including targetPrice) for a product
   * @param {number} productId
   * @returns {Promise<Array<{ userId: number, targetPrice: number|null }>>}
   */
  async getSubscriptionsWithDetails(productId) {
    const rows = await Subscription.findAll({
      where: { productId },
      attributes: ['userId', 'targetPrice'],
    });

    return rows.map((r) => ({
      userId: Number(r.userId),
      targetPrice: r.targetPrice ? Number(r.targetPrice) : null,
    }));
  }
}

module.exports = new SubscriptionRepository();
