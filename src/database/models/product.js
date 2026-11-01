const { DataTypes, Model } = require('sequelize');

class Product extends Model {}

function initProductModel(sequelize) {
  Product.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      sku: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      url: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      currentPrice: {
        type: DataTypes.FLOAT,
        allowNull: false,
        field: 'current_price',
      },
      oldPrice: {
        type: DataTypes.FLOAT,
        allowNull: true,
        field: 'old_price',
      },
      cardPrice: {
        type: DataTypes.FLOAT,
        allowNull: true,
        field: 'card_price',
      },
      imageUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'image_url',
      },
      inStock: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'in_stock',
      },
      lastCheckedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_checked_at',
      },
      lastParsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_parsed_at',
      },
    },
    {
      sequelize,
      tableName: 'products',
      underscored: true,
      timestamps: true,
    }
  );

  return Product;
}

module.exports = {
  Product,
  initProductModel,
};
