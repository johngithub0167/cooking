/**
 * 健康检查服务（BE-001）
 *
 * 只做一件事：确认数据库真的能读写（SELECT 1），供 /api/health 与运维轮询使用。
 * 分层约定：service 不碰 req/res。
 */
const { sequelize } = require('../config/database');
const config = require('../config');

const startedAt = Date.now();

/**
 * @returns {Promise<{status:string, db:string, dbLatencyMs:number|null, dbError?:string,
 *                    env:string, uptimeSec:number, time:string}>}
 */
async function check() {
  const base = {
    status: 'ok',
    db: 'up',
    dbLatencyMs: null,
    env: config.env,
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    time: new Date().toISOString()
  };

  const begin = Date.now();
  try {
    await sequelize.query('SELECT 1');
    base.dbLatencyMs = Date.now() - begin;
    return base;
  } catch (err) {
    return {
      ...base,
      status: 'error',
      db: 'down',
      dbError: err.message
    };
  }
}

module.exports = { check };
