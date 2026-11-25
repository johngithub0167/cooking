/**
 * C 端推荐路由（BE-014）：GET /api/recommendations，免 JWT 鉴权。
 * 挂载点：routes/index.js 的 router.use('/recommendations', ...)。
 *
 * size 默认 config.recommend.size（4），上限 100；
 * exclude 逗号分隔的 id，空串忽略，非法项过滤。
 */
const express = require('express');
const { query } = require('express-validator');

const recommendController = require('../controllers/recommendController');
const validate = require('../middlewares/validator');

const router = express.Router();

/**
 * exclude 解析：'12,15' -> [12,15]；'' / 未传 -> []；
 * 非正整数项丢弃。用 customSanitizer 归一化后交给 controller。
 */
function parseExclude(value) {
  if (value === undefined || value === null || value === '') return [];
  return String(value)
    .split(',')
    .map(s => s.trim())
    .filter(s => /^\d+$/.test(s))
    .map(Number)
    .filter(n => n > 0);
}

const recommendRules = [
  query('size').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('exclude').optional().isString().customSanitizer(parseExclude)
];

router.get('/', recommendRules, validate, recommendController.recommend);

module.exports = router;
