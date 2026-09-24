/**
 * 404 兜底（BE-001）
 *
 * 未匹配到的路径统一返回 2001（资源不存在），避免 Express 默认返回 HTML 页面。
 */
const { ERROR_CODES } = require('../utils/errors');
const { fail } = require('../utils/response');

module.exports = function notFound(req, res) {
  return fail(
    res,
    ERROR_CODES.NOT_FOUND.code,
    `接口不存在：${req.method} ${req.originalUrl}`,
    ERROR_CODES.NOT_FOUND.httpStatus
  );
};
