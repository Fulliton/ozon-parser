const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const config = require('../config');
const { initModels, Product, Subscription, PriceHistory } = require('./models');

let sequelizeInstance = null;
let migratorInstance = null;

/**
 * Creates or gets the Sequelize instance
 * @param {string} [storagePath]
 * @returns {Sequelize}
 */
function getSequelize(storagePath = null) {
  if (sequelizeInstance) {
    return sequelizeInstance;
  }

  const dbPath = storagePath || config.databasePath;
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  sequelizeInstance = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: process.env.NODE_ENV === 'test' ? false : (msg) => console.log(`[SQL] ${msg}`),
    define: {
      underscored: true,
      timestamps: true,
    },
  });

  initModels(sequelizeInstance);
  return sequelizeInstance;
}

/**
 * Creates Umzug migrator for running database migrations
 * @param {Sequelize} sequelize
 * @returns {Umzug}
 */
function getMigrator(sequelize = null) {
  const seq = sequelize || getSequelize();

  if (migratorInstance && migratorInstance.options.context === seq.getQueryInterface()) {
    return migratorInstance;
  }

  const migrationsPath = path.join(__dirname, 'migrations');

  migratorInstance = new Umzug({
    migrations: {
      glob: path.join(migrationsPath, '*.js'),
      resolve: ({ name, path: filePath, context }) => {
        const migration = require(filePath);
        return {
          name,
          up: async () => migration.up({ context }),
          down: async () => migration.down({ context }),
        };
      },
    },
    context: seq.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize: seq }),
    logger: process.env.NODE_ENV === 'test' ? undefined : console,
  });

  return migratorInstance;
}

/**
 * Initializes database and runs all pending migrations
 * @param {string} [storagePath]
 * @returns {Promise<Sequelize>}
 */
async function initDb(storagePath = null) {
  const seq = getSequelize(storagePath);
  await seq.authenticate();

  // Run all pending migrations via Umzug
  const migrator = getMigrator(seq);
  const pending = await migrator.pending();

  if (pending.length > 0) {
    console.log(`🚀 [Database] Применяем ${pending.length} миграций...`);
    await migrator.up();
    console.log('✅ [Database] Все миграции успешно применены!');
  } else {
    console.log('✅ [Database] База данных актуальна, новых миграций нет.');
  }

  return seq;
}

/**
 * Closes the database connection
 */
async function closeDb() {
  if (sequelizeInstance) {
    await sequelizeInstance.close();
    sequelizeInstance = null;
    migratorInstance = null;
  }
}

module.exports = {
  getSequelize,
  getMigrator,
  initDb,
  closeDb,
  models: {
    Product,
    Subscription,
    PriceHistory,
  },
};
