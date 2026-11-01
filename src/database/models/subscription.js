const { DataTypes, Model } = require('sequelize');

class Subscription extends Model {}

function initSubscriptionModel(sequelize) {
  Subscription.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'user_id',
      },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'product_id',
      },
      targetPrice: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'target_price',
      },
    },
    {
      sequelize,
      tableName: 'subscriptions',
      underscored: true,
      timestamps: true,
    }
  );

  return Subscription;
}

module.exports = {
  Subscription,
  initSubscriptionModel,
};
