/**
 * Express 应用装配（BE-001）
 *
 * 顺序即行为：跨域 → 请求体解析 → 请求日志 → 静态资源 → 业务路由 → 404 → 错误兜底。
 */
const express = require('express');
const cors = require('cors');

const config = require('./config');
const requestLogger = require('./middlewares/requestLogger');
const apiRouter = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// 不暴露技术栈
app.disable('x-powered-by');

// 跨域：开发期可用 *，上线前必须改成具体域名（.env 的 CORS_ORIGIN）
const rawOrigin = config.server.corsOrigin;
const corsOrigin = rawOrigin === '*' ? '*' : String(rawOrigin).split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigin }));

// 请求体：上传接口走 multipart，这里只处理 JSON / 表单
app.use(express.json({ limit: config.server.jsonLimit }));
app.use(express.urlencoded({ extended: false, limit: config.server.jsonLimit }));

// 请求日志
app.use(requestLogger);

// 菜品图片静态访问：GET /uploads/2026/09/xxx.jpg
app.use('/uploads', express.static(config.upload.dir, { maxAge: '7d' }));

// 业务路由
app.use('/api', apiRouter);

// 兜底
app.use(notFound);
app.use(errorHandler);

module.exports = app;
