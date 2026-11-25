/**
 * 模型统一加载入口（BE-010）
 *
 * 说明：现有 admin.js 保持不动，这里只做集中导出，不改变其任何行为。
 * 后续业务模型（dish / ingredient / menu 等）按任务逐个在此追加。
 */
const { sequelize, Sequelize } = require('../config/database');

const Admin = require('./admin');
const Category = require('./category');

module.exports = {
  sequelize,
  Sequelize,
  Admin,
  Category
};
