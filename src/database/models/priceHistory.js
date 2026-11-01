const { DataTypes, Model } = require('sequelize');

class PriceHistory extends Model {}

function initPriceHistoryModel(sequelize) {
  PriceHistory.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'product_id',
      },
      price: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      cardPrice: {
        type: DataTypes.FLOAT,
        allowNull: true,
        field: 'card_price',
      },
      recordedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'recorded_at',
      },
    },
    {
      sequelize,
      tableName: 'price_history',
      underscored: true,
      timestamps: true,
    }
  );

  return PriceHistory;
}

module.exports = {
  PriceHistory,
  initPriceHistoryModel,
};
