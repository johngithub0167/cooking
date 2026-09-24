/**
 * 统一响应（BE-001）
 *
 * 所有接口必须走这里，结构固定为 { code, message, data }（api-design.md 第 1.1 节）：
 *   code = 0 成功；其余为业务错误码。
 * 分页接口 data 固定为 { list, page, pageSize, total }。
 */
const { ERROR_CODES, HTTP_STATUS_BY_CODE } = require('./errors');

/**
 * 成功响应
 * @param {object} res Express Response
 * @param {*} data 业务数据，无数据时传 null
 * @param {string} [message]
 */
function ok(res, data = null, message = ERROR_CODES.SUCCESS.message) {
  return res.status(200).json({ code: 0, message, data });
}

/** 创建成功（201），用于新增类接口 */
function created(res, data = null, message = ERROR_CODES.SUCCESS.message) {
  return res.status(201).json({ code: 0, message, data });
}

/**
 * 失败响应
 * @param {object} res
 * @param {number} code 业务错误码
 * @param {string} [message] 不传则取错误码默认文案
 * @param {number} [httpStatus] 不传则按错误码映射
 * @param {*} [data] 少数场景需要附带数据（如健康检查的 db 状态）
 */
function fail(res, code, message, httpStatus, data = null) {
  const preset = Object.values(ERROR_CODES).find((item) => item.code === code);
  const status = httpStatus || HTTP_STATUS_BY_CODE[code] || 500;
  return res.status(status).json({
    code,
    message: message || (preset ? preset.message : '服务器内部错误'),
    data
  });
}

/** 分页响应：data 固定为 { list, page, pageSize, total } */
function paginate(res, list, page, pageSize, total, message = ERROR_CODES.SUCCESS.message) {
  return ok(
    res,
    {
      list,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      total: Number(total) || 0
    },
    message
  );
}

module.exports = { ok, created, fail, paginate };
