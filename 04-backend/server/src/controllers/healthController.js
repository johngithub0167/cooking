/**
 * 健康检查控制器（BE-001）
 *
 * 约定：controller 只取参数、调 service、组装响应，不写业务规则。
 *
 * 注意：/api/health 不在 api-design.md 的 15 个业务接口里，
 * 它是架构 5.5 / 运维 start-dev.ps1 依赖的就绪探针，仍走统一响应结构：
 *   正常  200 { code:0, data:{ status:'ok', db:'up', ... } }
 *   库挂了 500 { code:5000, message:'数据库连接不可用', data:{ db:'down', dbError } }
 * （HTTP 状态按错误码表 5000→500，不用 503，避免与文档不一致）
 */
const healthService = require('../services/healthService');
const { ok, fail } = require('../utils/response');
const { ERROR_CODES } = require('../utils/errors');

async function check(req, res, next) {
  try {
    const result = await healthService.check();
    if (result.db !== 'up') {
      return fail(res, ERROR_CODES.INTERNAL.code, '数据库连接不可用', ERROR_CODES.INTERNAL.httpStatus, result);
    }
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { check };
