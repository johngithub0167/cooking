/**
 * 后台菜品控制器（BE-011）
 * 只取参数、调 service、组装响应。
 */
const adminDishService = require('../services/adminDishService');
const { ok, created, paginate } = require('../utils/response');

async function list(req, res, next) {
  try {
    const { page, pageSize, categoryId, status, keyword, includeDeleted } = req.query;
    const result = await adminDishService.list({
      page,
      pageSize,
      categoryId,
      status,
      keyword,
      includeDeleted: includeDeleted === true || includeDeleted === 'true'
    });
    return paginate(res, result.list, page, pageSize, result.total);
  } catch (error) {
    return next(error);
  }
}

async function detail(req, res, next) {
  try {
    return ok(res, await adminDishService.getById(req.params.id));
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    return created(res, await adminDishService.create(req.body));
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    return ok(res, await adminDishService.update(req.params.id, req.body));
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    return ok(res, await adminDishService.remove(req.params.id));
  } catch (error) {
    return next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    return ok(res, await adminDishService.updateStatus(req.params.id, req.body.status));
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, detail, create, update, remove, updateStatus };
