/**
 * 统一错误定义（BE-001 / BE-003）
 *
 * 错误码与 HTTP 状态严格对齐 02-design/api-design.md 第 1.2 节：
 *   1000→400 参数错误    1001→401 未登录    1002→403 无权限
 *   2001→404 资源不存在  2002→409 资源冲突
 *   3001→400 文件类型    3002→400 文件超限
 *   5000→500 系统错误
 * 新增错误码必须先改 api-design.md，再改这里（backend-rules 第 2 条）。
 */
const ERROR_CODES = {
  SUCCESS: { code: 0, httpStatus: 200, message: 'ok' },
  PARAM_ERROR: { code: 1000, httpStatus: 400, message: '参数错误' },
  UNAUTHORIZED: { code: 1001, httpStatus: 401, message: '未登录或登录已失效' },
  FORBIDDEN: { code: 1002, httpStatus: 403, message: '无权限' },
  NOT_FOUND: { code: 2001, httpStatus: 404, message: '资源不存在' },
  CONFLICT: { code: 2002, httpStatus: 409, message: '资源冲突' },
  FILE_TYPE_NOT_ALLOWED: { code: 3001, httpStatus: 400, message: '文件类型不支持' },
  FILE_TOO_LARGE: { code: 3002, httpStatus: 400, message: '文件超过大小限制' },
  INTERNAL: { code: 5000, httpStatus: 500, message: '服务器内部错误' }
};

/** code → httpStatus，供 errorHandler 兜底使用 */
const HTTP_STATUS_BY_CODE = Object.values(ERROR_CODES).reduce((acc, item) => {
  acc[item.code] = item.httpStatus;
  return acc;
}, {});

class AppError extends Error {
  /**
   * @param {number} code 业务错误码（见 ERROR_CODES）
   * @param {string} [message] 提示语，默认取错误码对应文案
   * @param {number} [httpStatus] HTTP 状态，默认按错误码映射
   * @param {*} [details] 可选：字段级错误信息（express-validator 结果等）
   */
  constructor(code, message, httpStatus, details) {
    const preset = Object.values(ERROR_CODES).find((item) => item.code === code);
    super(message || (preset ? preset.message : '服务器内部错误'));
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus || (preset ? preset.httpStatus : 500);
    this.details = details;
  }

  static badRequest(message, details) {
    return new AppError(ERROR_CODES.PARAM_ERROR.code, message, 400, details);
  }

  static unauthorized(message) {
    return new AppError(ERROR_CODES.UNAUTHORIZED.code, message, 401);
  }

  static forbidden(message) {
    return new AppError(ERROR_CODES.FORBIDDEN.code, message, 403);
  }

  static notFound(message) {
    return new AppError(ERROR_CODES.NOT_FOUND.code, message, 404);
  }

  static conflict(message) {
    return new AppError(ERROR_CODES.CONFLICT.code, message, 409);
  }

  static fileTypeNotAllowed(message) {
    return new AppError(ERROR_CODES.FILE_TYPE_NOT_ALLOWED.code, message, 400);
  }

  static fileTooLarge(message) {
    return new AppError(ERROR_CODES.FILE_TOO_LARGE.code, message, 400);
  }

  static internal(message) {
    return new AppError(ERROR_CODES.INTERNAL.code, message, 500);
  }
}

function isAppError(err) {
  return err instanceof AppError;
}

module.exports = { ERROR_CODES, HTTP_STATUS_BY_CODE, AppError, isAppError };
