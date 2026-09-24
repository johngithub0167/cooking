/**
 * sequelize-cli 专用配置（BE-002 的 db:migrate 用）
 *
 * CLI 要求导出「按环境分组」的对象，这里复用 src/config/index.js，
 * 保证 migration 与运行时连的是同一个库、同一份账号，不会出现两套配置漂移。
 */
const config = require('./index');

const base = {
  username: config.db.user,
  password: config.db.password,
  database: config.db.database,
  host: config.db.host,
  port: config.db.port,
  dialect: 'mysql',
  timezone: config.db.timezone,
  // migration 过程不要打印 SQL，结果由 CLI 自己输出
  logging: false,
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    underscored: true,
    timestamps: true
  }
};

module.exports = {
  development: { ...base },
  test: { ...base },
  production: { ...base }
};
