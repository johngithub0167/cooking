/**
 * C 端菜品控制器（BE-013）
 * 免鉴权；只取参数、调 service、组装响应。
 */
const dishService = require('../services/dishService');
const { ok, paginate } = require('../utils/response');

async function list(req, res, next) {
  try {
    const { page, pageSize, categoryId, keyword } = req.query;
    const result = await dishService.list({ page, pageSize, categoryId, keyword });
    return paginate(res, result.list, result.page, result.pageSize, result.total);
  } catch (error) {
    return next(error);
  }
}

async function detail(req, res, next) {
  try {
    return ok(res, await dishService.getById(req.params.id));
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, detail };
