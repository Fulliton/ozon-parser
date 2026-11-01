const { getSequelize, models } = require('../database');

/**
 * Base Repository for Sequelize models
 */
class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  get sequelize() {
    return getSequelize();
  }

  get models() {
    return models;
  }
}

module.exports = BaseRepository;
