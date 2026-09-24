/**
 * 日志工具（BE-001）
 *
 * 两部分：
 *   1. 应用日志：info / warn / error / debug，写控制台 + logs/app-<日期>.log
 *   2. 请求日志：morgan 通过 httpStream 接入同一套输出（架构 2.1「morgan + 自定义 logger」）
 *
 * logs/ 目录已被 .gitignore 忽略，不入库。
 */
const fs = require('fs');
const path = require('path');

const config = require('../config');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const currentLevel = LEVELS[String(config.log.level).toLowerCase()] || LEVELS.info;

let logDirReady = false;

function ensureLogDir() {
  if (logDirReady) return true;
  try {
    fs.mkdirSync(config.log.dir, { recursive: true });
    logDirReady = true;
    return true;
  } catch (err) {
    // 日志目录不可写时降级为只输出控制台，不能因为日志把服务搞挂
    console.error(`[logger] 日志目录不可用（${config.log.dir}）：${err.message}`);
    return false;
  }
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${today()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function isLevelEnabled(level) {
  return (LEVELS[level] || LEVELS.info) >= currentLevel;
}

function write(level, args) {
  if (!isLevelEnabled(level)) return;

  const tag = level.toUpperCase().padEnd(5);
  const message = args
    .map((a) => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    })
    .join(' ');
  const line = `${timestamp()} ${tag} ${message}`;

  // 控制台
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);

  // 文件（按天切分，追加写，失败不影响主流程）
  if (ensureLogDir()) {
    const file = path.join(config.log.dir, `app-${today()}.log`);
    try {
      fs.appendFileSync(file, line + '\n', { encoding: 'utf8' });
    } catch (err) {
      console.error(`[logger] 写入日志文件失败：${err.message}`);
    }
  }
}

const logger = {
  isLevelEnabled,
  debug: (...args) => write('debug', args),
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
  /** morgan 用的流：把访问日志收敛到 logger（info 级） */
  httpStream: {
    write: (msg) => {
      const text = String(msg).trim();
      if (text) write('info', [text]);
    }
  }
};

module.exports = logger;
