/**
 * C 端菜品路由（BE-013）：/api/dishes，免 JWT 鉴权。
 * 挂载点：routes/index.js 的 router.use('/dishes', ...)。
 *
 * page/pageSize 在校验层给默认值（1/20），service 层也有兜底，双保险。
 */
const express = require('express');
const { query, param } = require('express-validator');

const dishController = require('../controllers/dishController');
const validate = require('../middlewares/validator');

const router = express.Router();

const listRules = [
  query('page').optional().isInt({ min: 1 }).toInt().default(1),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
  query('categoryId').optional().isInt({ min: 0 }).toInt(),
  query('keyword').optional().isString().trim().isLength({ max: 64 })
];

const idRule = [param('id').isInt({ min: 1 }).toInt()];

router.get('/', listRules, validate, dishController.list);
router.get('/:id', idRule, validate, dishController.detail);

module.exports = router;
