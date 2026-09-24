/**
 * 请求日志（BE-001）
 *
 * morgan 输出「方法、路径、状态码、耗时、响应大小」，经 logger.httpStream 落盘到 logs/。
 * 健康检查被运维脚本每 2 秒轮询一次，默认不打，避免刷屏（可用 LOG_REQUEST_HEALTH=1 打开）。
 */
const morgan = require('morgan');

const logger = require('../utils/logger');

const FORMAT = ':method :url :status :response-time ms :res[content-length] bytes - :remote-addr';

function shouldSkip(req) {
  const isHealth = req.originalUrl === '/api/health' || req.url === '/health';
  return isHealth && process.env.LOG_REQUEST_HEALTH !== '1';
}

module.exports = morgan(FORMAT, { stream: logger.httpStream, skip: shouldSkip });
