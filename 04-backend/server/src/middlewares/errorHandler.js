/**
 * 统一错误处理（BE-001 / BE-003）
 *
 * 兜底顺序：AppError → Sequelize 已知错误 → 未知错误（一律 5000）。
 * 生产环境只返回通用提示，不返回堆栈（架构第 8 节）。
 */
const config = require('../config');
const logger = require('../utils/logger');
const { AppError, isAppError, ERROR_CODES } = require('../utils/errors');
const { fail } = require('../utils/response');

/**
 * Sequelize 错误 → 业务错误码
 *   UniqueConstraintError  2002 资源冲突（分类名/食材名重复等）
 *   ValidationError        1000 参数错误
 *   ForeignKeyConstraintError 1000（引用了不存在或受约束的数据）
 *   DatabaseError / 连接类   5000 系统错误
 */
function mapSequelizeError(err) {
  const name = err && err.name;
  switch (name) {
    case 'SequelizeUniqueConstraintError':
      return new AppError(ERROR_CODES.CONFLICT.code, '数据已存在，请勿重复添加', 409);
    case 'SequelizeValidationError':
    case 'SequelizeForeignKeyConstraintError': {
      const first = err.errors && err.errors[0];
      return new AppError(ERROR_CODES.PARAM_ERROR.code, first ? first.message : '数据校验未通过', 400);
    }
    case 'SequelizeEmptyResultError':
      return new AppError(ERROR_CODES.NOT_FOUND.code, '资源不存在', 404);
    case 'SequelizeDatabaseError':
    case 'SequelizeConnectionError':
    case 'SequelizeConnectionRefusedError':
    case 'SequelizeConnectionTimedOutError':
      return new AppError(ERROR_CODES.INTERNAL.code, '数据库操作失败', 500);
    default:
      return null;
  }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // 响应已经开始（例如流式输出中断），交给 Express 默认处理
  if (res.headersSent) {
    return next(err);
  }

  // 1) 业务错误：warn 级，不打堆栈
  if (isAppError(err)) {
    logger.warn(`[${err.code}] ${req.method} ${req.originalUrl} - ${err.message}`);
    return fail(res, err.code, err.message, err.httpStatus, err.details ? { details: err.details } : null);
  }

  // 2) ORM 错误：error 级，记堆栈
  const mapped = mapSequelizeError(err);
  if (mapped) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`);
    logger.error(err.stack);
    return fail(res, mapped.code, mapped.message, mapped.httpStatus);
  }

  // 3) 未知错误
  logger.error(`未捕获异常 ${req.method} ${req.originalUrl} - ${err.message}`);
  logger.error(err && err.stack);
  return fail(
    res,
    ERROR_CODES.INTERNAL.code,
    config.isProduction ? ERROR_CODES.INTERNAL.message : err.message,
    500
  );
}

module.exports = errorHandler;
