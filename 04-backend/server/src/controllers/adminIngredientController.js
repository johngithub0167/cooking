/**
 * 后台食材查询控制器（BE-011）
 */
const adminIngredientService = require('../services/adminIngredientService');
const { ok } = require('../utils/response');

async function search(req, res, next) {
  try {
    return ok(res, await adminIngredientService.search(req.query.keyword));
  } catch (error) {
    return next(error);
  }
}

module.exports = { search };
