/**
 * C 端菜单记录路由（BE-015）：/api/menus，免 JWT 鉴权。
 * 挂载点：routes/index.js 的 router.use('/menus', ...)。
 *
 * page/pageSize 校验给默认值（1/20），service 层也兜底，双保险。
 */
const express = require('express');
const { body, query, param } = require('express-validator');

const menuController = require('../controllers/menuController');
const validate = require('../middlewares/validator');

const router = express.Router();

// 创建菜单：items 1~50；dishId 正整数；quantity 1~99；mealDate 日期；remark ≤200
const createRules = [
  body('items').isArray({ min: 1, max: 50 }),
  body('items.*.dishId').isInt({ min: 1 }).toInt(),
  body('items.*.quantity').isInt({ min: 1, max: 99 }).toInt(),
  body('mealDate').optional({ nullable: true }).matches(/^\d{4}-\d{2}-\d{2}$/),
  body('remark').optional({ nullable: true }).isString().isLength({ max: 200 })
];

// 历史列表：分页默认 + 日期范围
const listRules = [
  query('page').optional().isInt({ min: 1 }).toInt().default(1),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
  query('startDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  query('endDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/)
];

const idRule = [param('id').isInt({ min: 1 }).toInt()];

router.post('/', createRules, validate, menuController.create);
router.get('/', listRules, validate, menuController.listHistory);
router.get('/:id', idRule, validate, menuController.detail);

module.exports = router;
