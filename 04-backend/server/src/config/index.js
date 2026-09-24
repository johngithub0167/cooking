/**
 * 统一配置入口（BE-001）
 *
 * 规则（backend-rules 第 8 条）：所有配置只从 .env 读取，代码中不得硬编码账号密码、端口、密钥。
 * .env 由 06-devops/.env.example 生成，本机真实值在 04-backend/server/.env（已 gitignore）。
 */
const path = require('path');
const dotenv = require('dotenv');

// 04-backend/server/.env（src/config -> src -> server）
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SERVER_DIR = path.resolve(__dirname, '../..');

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function toBool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function resolvePath(value) {
  if (!value) return value;
  return path.isAbsolute(value) ? value : path.resolve(SERVER_DIR, value);
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const config = {
  env: nodeEnv,
  isProduction,
  serverDir: SERVER_DIR,
  server: {
    port: toInt(process.env.SERVER_PORT, 3000),
    // JSON 体上限：接口只传文本，1mb 足够
    jsonLimit: '1mb',
    corsOrigin: process.env.CORS_ORIGIN || '*'
  },
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cooking',
    poolMax: toInt(process.env.DB_POOL_MAX, 10),
    poolMin: toInt(process.env.DB_POOL_MIN, 0),
    poolIdle: toInt(process.env.DB_POOL_IDLE, 10000),
    poolAcquire: toInt(process.env.DB_POOL_ACQUIRE, 30000),
    // 东八区，避免 DATE/DATETIME 与容器 UTC 之间差 8 小时
    timezone: '+08:00'
  },
  jwt: {
    // BE-004 才用到，这里先读好；生产环境缺失时在下面校验里直接报错
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '12h'
  },
  admin: {
    defaultUsername: process.env.ADMIN_DEFAULT_USERNAME || 'admin',
    defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || ''
  },
  upload: {
    dir: resolvePath(process.env.UPLOAD_DIR || 'uploads'),
    maxSize: toInt(process.env.UPLOAD_MAX_SIZE, 5 * 1024 * 1024),
    allowedTypes: (process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,image/webp')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    staticBaseUrl: process.env.STATIC_BASE_URL || '',
    enableThumbnail: toBool(process.env.ENABLE_THUMBNAIL, true)
  },
  recommend: {
    size: toInt(process.env.RECOMMEND_SIZE, 4),
    excludeDays: toInt(process.env.RECOMMEND_EXCLUDE_DAYS, 7)
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
    dir: resolvePath(process.env.LOG_DIR || 'logs')
  }
};

/**
 * 必填项校验：缺配置直接崩在启动阶段，好过运行到一半才连不上库。
 * JWT_SECRET 只在生产环境强制（开发环境允许后续任务补齐）。
 */
function assertRequired() {
  const missing = [];
  if (!config.db.host) missing.push('DB_HOST');
  if (!config.db.user) missing.push('DB_USER');
  if (!config.db.password) missing.push('DB_PASSWORD');
  if (!config.db.database) missing.push('DB_NAME');
  if (isProduction && !config.jwt.secret) missing.push('JWT_SECRET');

  if (missing.length > 0) {
    throw new Error(
      `[config] .env 缺少必填配置：${missing.join(', ')}。请复制 06-devops/.env.example 后填写，或运行 npm run env:init。`
    );
  }
}

module.exports = config;
module.exports.assertRequired = assertRequired;
