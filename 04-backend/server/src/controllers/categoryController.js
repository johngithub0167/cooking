/**
 * 分类控制器（BE-010）
 * 只取参数、调 service、组装响应；业务规则在 service。
 */
const categoryService = require('../services/categoryService');
const { ok } = require('../utils/response');

/** C 端分类列表 */
async function listPublic(req, res, next) {
  try {
    return ok(res, await categoryService.listPublic());
  } catch (error) {
    return next(error);
  }
}

/** 后台：全部分类 */
async function listAdmin(req, res, next) {
  try {
    return ok(res, await categoryService.listAdmin());
  } catch (error) {
    return next(error);
  }
}

/** 后台：新增分类 */
async function create(req, res, next) {
  try {
    const { name, sort, status } = req.body;
    return ok(res, await categoryService.create({ name, sort, status }));
  } catch (error) {
    return next(error);
  }
}

/** 后台：修改分类 */
async function update(req, res, next) {
  try {
    const { name, sort, status } = req.body;
    return ok(res, await categoryService.update(req.params.id, { name, sort, status }));
  } catch (error) {
    return next(error);
  }
}

/** 后台：删除分类 */
async function remove(req, res, next) {
  try {
    return ok(res, await categoryService.remove(req.params.id));
  } catch (error) {
    return next(error);
  }
}

module.exports = { listPublic, listAdmin, create, update, remove };
