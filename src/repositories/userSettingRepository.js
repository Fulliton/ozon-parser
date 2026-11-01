const BaseRepository = require('./baseRepository');
const { UserSetting } = require('../database/models');

class UserSettingRepository extends BaseRepository {
  constructor() {
    super(UserSetting);
  }

  /**
   * Retrieves user settings, returning defaults if not yet created
   * @param {number} userId
   * @returns {Promise<{ userId: number, notifyOnlyDrops: boolean, useOzonCard: boolean }>}
   */
  async getSettings(userId) {
    const record = await UserSetting.findOne({
      where: { userId },
    });

    if (!record) {
      return {
        userId: Number(userId),
        notifyOnlyDrops: true,
        useOzonCard: true,
      };
    }

    const json = record.toJSON();
    return {
      userId: Number(json.userId),
      notifyOnlyDrops: Boolean(json.notifyOnlyDrops),
      useOzonCard: Boolean(json.useOzonCard),
    };
  }

  /**
   * Updates or creates user settings
   * @param {number} userId
   * @param {Partial<{ notifyOnlyDrops: boolean, useOzonCard: boolean }>} patch
   * @returns {Promise<{ userId: number, notifyOnlyDrops: boolean, useOzonCard: boolean }>}
   */
  async updateSettings(userId, patch) {
    const [record] = await UserSetting.findOrCreate({
      where: { userId },
      defaults: {
        userId,
        notifyOnlyDrops: patch.notifyOnlyDrops !== undefined ? patch.notifyOnlyDrops : true,
        useOzonCard: patch.useOzonCard !== undefined ? patch.useOzonCard : true,
      },
    });

    if (patch.notifyOnlyDrops !== undefined) {
      record.notifyOnlyDrops = patch.notifyOnlyDrops;
    }
    if (patch.useOzonCard !== undefined) {
      record.useOzonCard = patch.useOzonCard;
    }

    await record.save();

    return {
      userId: Number(record.userId),
      notifyOnlyDrops: Boolean(record.notifyOnlyDrops),
      useOzonCard: Boolean(record.useOzonCard),
    };
  }
}

module.exports = new UserSettingRepository();
