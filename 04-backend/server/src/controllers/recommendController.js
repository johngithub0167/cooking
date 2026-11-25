/**
 * 推荐控制器（BE-014）
 * 免鉴权；只取参数、调 service、组装响应。
 */
const recommendService = require('../services/recommendService');
const { ok } = require('../utils/response');

async function recommend(req, res, next) {
  try {
    const { size, exclude } = req.query;
    // 路由用 query('exclude') 解析逗号串为数组；service 入参名沿用 excludeIds
    return ok(res, await recommendService.recommend({ size, excludeIds: exclude }));
  } catch (error) {
    return next(error);
  }
}

module.exports = { recommend };
