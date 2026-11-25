/**
 * 后台分类路由（BE-010）：/api/admin/categories，需要 JWT 鉴权。
 * 由 routes/admin.js 挂载 router.use('/categories', ...)。
 */
const express = require('express');
const { body, param } = require('express-validator');

const categoryController = require('../controllers/categoryController');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validator');

const router = express.Router();

// 后台分类接口一律先过 auth
router.use(auth);

// 新增：name 必填 1~32；sort/status 可选
const createRules = [
  body('name').isString().trim().isLength({ min: 1, max: 32 }),
  body('sort').optional({ nullable: true }).isInt().toInt(),
  body('status').optional({ nullable: true }).isInt().isIn([0, 1]).toInt()
];

// 修改：id 必为正整数；其余字段可选（部分更新）
const updateRules = [
  param('id').isInt({ min: 1 }).toInt(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 32 }),
  body('sort').optional({ nullable: true }).isInt().toInt(),
  body('status').optional({ nullable: true }).isInt().isIn([0, 1]).toInt()
];

const deleteRules = [param('id').isInt({ min: 1 }).toInt()];

router.get('/', categoryController.listAdmin);
router.post('/', createRules, validate, categoryController.create);
router.put('/:id', updateRules, validate, categoryController.update);
router.delete('/:id', deleteRules, validate, categoryController.remove);

module.exports = router;
