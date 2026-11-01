const { DataTypes } = require('sequelize');

module.exports = {
  async up({ context: queryInterface }) {
    await queryInterface.createTable('products', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      sku: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
      url: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      current_price: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      old_price: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      card_price: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      image_url: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      in_stock: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      last_checked_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_parsed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    await queryInterface.addIndex('products', ['sku']);
  },

  async down({ context: queryInterface }) {
    await queryInterface.dropTable('products');
  },
};
