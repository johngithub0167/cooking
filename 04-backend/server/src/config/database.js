/**
 * Sequelize 实例与连接管理（BE-001）
 *
 * 约定：全局只用这一个实例；查询一律走 Sequelize 参数化，禁止字符串拼接 SQL。
 */
const { Sequelize } = require('sequelize');

const config = require('./index');
const logger = require('../utils/logger');

const sequelize = new Sequelize(config.db.database, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: 'mysql',
  timezone: config.db.timezone,
  // SQL 日志走 debug 级别，避免 INFO 日志被 SQL 刷屏
  logging: (sql, timing) => {
    if (logger.isLevelEnabled('debug')) {
      logger.debug(`[sql] ${typeof sql === 'string' ? sql.replace(/\s+/g, ' ') : sql}${timing ? ` (${timing}ms)` : ''}`);
    }
  },
  pool: {
    max: config.db.poolMax,
    min: config.db.poolMin,
    idle: config.db.poolIdle,
    acquire: config.db.poolAcquire
  },
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    // 模型用 camelCase，列名用 snake_case（与 database-design.md 一致）
    underscored: true,
    timestamps: true
  }
});

/** 建连并校验账号可用；失败时把原因打全，方便定位是端口还是口令问题 */
async function connectDatabase() {
  try {
    await sequelize.authenticate();
    logger.info(
      `数据库连接成功 ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`
    );
    return true;
  } catch (err) {
    logger.error(
      `数据库连接失败 ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}：${err.message}`
    );
    throw err;
  }
}

async function closeDatabase() {
  await sequelize.close();
  logger.info('数据库连接已关闭');
}

module.exports = { sequelize, connectDatabase, closeDatabase };
