/**
 * 后台食材查询服务（BE-011）
 * GET /api/admin/ingredients?keyword= → 最多 20 条，用于后台表单联想。
 */
const { Op } = require('sequelize');
const { Ingredient } = require('../models');

async function search(keyword) {
  const where = {};
  if (keyword) {
    where.name = { [Op.like]: `%${keyword}%` };
  }
  return Ingredient.findAll({
    attributes: ['id', 'name'],
    where,
    order: [['id', 'ASC']],
    limit: 20,
    raw: true
  });
}

module.exports = { search };
