/**
 * 服务启动入口（BE-001）
 *
 * 启动顺序：校验配置 → 连数据库（失败直接退出，不假装可用）→ 监听端口。
 * 退出：收到 SIGINT / SIGTERM 时先停止接收新连接，再关连接池。
 */
const configModule = require('./config');
const logger = require('./utils/logger');
const app = require('./app');
const { connectDatabase, closeDatabase } = require('./config/database');

let server = null;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`收到 ${signal}，开始优雅退出...`);

  if (server) {
    server.close(() => logger.info('HTTP 服务已停止接收新连接'));
  }

  try {
    await closeDatabase();
  } catch (err) {
    logger.error(`关闭数据库连接失败：${err.message}`);
  }

  // 兜底：10 秒内没退干净就强制退出，避免进程悬挂
  setTimeout(() => process.exit(0), 10000).unref();
}

async function start() {
  // 缺配置直接崩在启动阶段
  configModule.assertRequired();

  await connectDatabase();

  server = app.listen(configModule.server.port, () => {
    logger.info(`后端服务已启动 http://localhost:${configModule.server.port} （env=${configModule.env}）`);
    logger.info(`健康检查 http://localhost:${configModule.server.port}/api/health`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`端口 ${configModule.server.port} 已被占用，请先停止占用进程（npm run stop）`);
    } else {
      logger.error(`HTTP 服务异常：${err.message}`);
    }
    process.exit(1);
  });

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error(`未处理的 Promise 拒绝：${reason && reason.stack ? reason.stack : reason}`);
  });

  process.on('uncaughtException', (err) => {
    logger.error(`未捕获异常：${err.stack}`);
    shutdown('uncaughtException');
  });
}

start().catch((err) => {
  logger.error(`启动失败：${err.stack || err.message}`);
  process.exit(1);
});
