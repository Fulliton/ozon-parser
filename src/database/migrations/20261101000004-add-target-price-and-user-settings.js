const { DataTypes } = require('sequelize');

module.exports = {
  async up({ context: queryInterface }) {
    // 1. Add target_price to subscriptions
    const subTable = await queryInterface.describeTable('subscriptions');
    if (!subTable.target_price) {
      await queryInterface.addColumn('subscriptions', 'target_price', {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      });
    }

    // 2. Create user_settings table
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('user_settings')) {
      await queryInterface.createTable('user_settings', {
        user_id: {
          type: DataTypes.BIGINT,
          primaryKey: true,
          allowNull: false,
        },
        notify_only_drops: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        use_ozon_card: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
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
    }
  },

  async down({ context: queryInterface }) {
    const subTable = await queryInterface.describeTable('subscriptions');
    if (subTable.target_price) {
      await queryInterface.removeColumn('subscriptions', 'target_price');
    }
    await queryInterface.dropTable('user_settings');
  },
};
