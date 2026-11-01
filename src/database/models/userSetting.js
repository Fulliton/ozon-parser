const { DataTypes, Model } = require('sequelize');

class UserSetting extends Model {}

function initUserSettingModel(sequelize) {
  UserSetting.init(
    {
      userId: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        allowNull: false,
        field: 'user_id',
      },
      notifyOnlyDrops: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'notify_only_drops',
      },
      useOzonCard: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'use_ozon_card',
      },
    },
    {
      sequelize,
      tableName: 'user_settings',
      underscored: true,
      timestamps: true,
    }
  );

  return UserSetting;
}

module.exports = {
  UserSetting,
  initUserSettingModel,
};
