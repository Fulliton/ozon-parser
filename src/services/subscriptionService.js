const { subscriptionRepository, productRepository, userSettingRepository } = require('../repositories');

class SubscriptionService {
  /**
   * Unsubscribes a user from a product
   * @param {number} userId
   * @param {number} productId
   * @returns {Promise<{ success: boolean, product: Object|null }>}
   */
  async unsubscribe(userId, productId) {
    const product = await productRepository.findById(productId);
    const success = await subscriptionRepository.unsubscribe(userId, productId);
    return { success, product };
  }

  /**
   * Checks if a user is subscribed to a product
   * @param {number} userId
   * @param {number} productId
   * @returns {Promise<boolean>}
   */
  async isSubscribed(userId, productId) {
    return subscriptionRepository.isSubscribed(userId, productId);
  }

  /**
   * Gets list of subscribers for a product
   * @param {number} productId
   * @returns {Promise<Array<number>>}
   */
  async getSubscribers(productId) {
    return subscriptionRepository.getSubscribersByProductId(productId);
  }

  /**
   * Sets a target price for a user's subscription
   * @param {number} userId
   * @param {number} productId
   * @param {number} targetPrice
   * @returns {Promise<boolean>}
   */
  async setTargetPrice(userId, productId, targetPrice) {
    return subscriptionRepository.setTargetPrice(userId, productId, targetPrice);
  }

  /**
   * Clears the target price for a user's subscription
   * @param {number} userId
   * @param {number} productId
   * @returns {Promise<boolean>}
   */
  async clearTargetPrice(userId, productId) {
    return subscriptionRepository.clearTargetPrice(userId, productId);
  }

  /**
   * Gets settings for a specific user
   * @param {number} userId
   * @returns {Promise<{ userId: number, notifyOnlyDrops: boolean, useOzonCard: boolean }>}
   */
  async getUserSettings(userId) {
    return userSettingRepository.getSettings(userId);
  }

  /**
   * Updates settings for a specific user
   * @param {number} userId
   * @param {Partial<{ notifyOnlyDrops: boolean, useOzonCard: boolean }>} patch
   * @returns {Promise<{ userId: number, notifyOnlyDrops: boolean, useOzonCard: boolean }>}
   */
  async updateUserSettings(userId, patch) {
    return userSettingRepository.updateSettings(userId, patch);
  }
}

module.exports = new SubscriptionService();
