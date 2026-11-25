/**
 * 菜单记录控制器（BE-015）
 * C 端与后台共用：listHistory / detail 返回结构相同；create 仅 C 端使用。
 * 只取参数、调 service、组装响应。
 */
const menuService = require('../services/menuService');
const { ok, created, paginate } = require('../utils/response');

/** 创建菜单记录（C 端 POST /api/menus） */
async function create(req, res, next) {
  try {
    return created(res, await menuService.create(req.body));
  } catch (error) {
    return next(error);
  }
}

/** 历史列表（C 端 GET /api/menus、后台 GET /api/admin/menus） */
async function listHistory(req, res, next) {
  try {
    const { page, pageSize, startDate, endDate } = req.query;
    const result = await menuService.listHistory({ page, pageSize, startDate, endDate });
    return paginate(res, result.list, result.page, result.pageSize, result.total);
  } catch (error) {
    return next(error);
  }
}

/** 详情（C 端 GET /api/menus/:id、后台 GET /api/admin/menus/:id） */
async function detail(req, res, next) {
  try {
    return ok(res, await menuService.getDetail(req.params.id));
  } catch (error) {
    return next(error);
  }
}

module.exports = { create, listHistory, detail };
