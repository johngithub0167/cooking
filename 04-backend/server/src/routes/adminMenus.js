/**
 * 后台菜单记录路由（BE-015）：/api/admin/menus，需要 JWT 鉴权。
 * 结构同 C 端 2.6 / 2.7，复用 menuController 的 listHistory / detail。
 * 由 routes/admin.js 挂载 router.use('/menus', ...)。
 */
const express = require('express');
const { query, param } = require('express-validator');

const menuController = require('../controllers/menuController');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validator');

const router = express.Router();

router.use(auth);

const listRules = [
  query('page').optional().isInt({ min: 1 }).toInt().default(1),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
  query('startDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  query('endDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/)
];

const idRule = [param('id').isInt({ min: 1 }).toInt()];

router.get('/', listRules, validate, menuController.listHistory);
router.get('/:id', idRule, validate, menuController.detail);

module.exports = router;
