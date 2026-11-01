const { Product, initProductModel } = require('./product');
const { Subscription, initSubscriptionModel } = require('./subscription');
const { PriceHistory, initPriceHistoryModel } = require('./priceHistory');
const { UserSetting, initUserSettingModel } = require('./userSetting');

/**
 * Initializes all Sequelize models and sets up associations
 * @param {import('sequelize').Sequelize} sequelize
 */
function initModels(sequelize) {
  initProductModel(sequelize);
  initSubscriptionModel(sequelize);
  initPriceHistoryModel(sequelize);
  initUserSettingModel(sequelize);

  // Associations
  Product.hasMany(Subscription, {
    foreignKey: 'productId',
    as: 'subscriptions',
    onDelete: 'CASCADE',
  });
  Subscription.belongsTo(Product, {
    foreignKey: 'productId',
    as: 'product',
  });

  Product.hasMany(PriceHistory, {
    foreignKey: 'productId',
    as: 'priceHistory',
    onDelete: 'CASCADE',
  });
  PriceHistory.belongsTo(Product, {
    foreignKey: 'productId',
    as: 'product',
  });

  return {
    Product,
    Subscription,
    PriceHistory,
    UserSetting,
  };
}

module.exports = {
  initModels,
  Product,
  Subscription,
  PriceHistory,
  UserSetting,
};
