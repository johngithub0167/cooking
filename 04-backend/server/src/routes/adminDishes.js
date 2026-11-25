/**
 * 后台菜品路由（BE-011）：/api/admin/dishes，需要 JWT 鉴权。
 * 由 routes/admin.js 挂载 router.use('/dishes', ...)。
 */
const express = require('express');
const { query, param, body } = require('express-validator');

const adminDishController = require('../controllers/adminDishController');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validator');

const router = express.Router();

router.use(auth);

// 列表：分页 + 筛选
const listRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('categoryId').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  query('status').optional({ nullable: true }).isInt().isIn([0, 1]).toInt(),
  query('keyword').optional().isString().trim().isLength({ max: 64 }),
  query('includeDeleted').optional().isIn(['true', 'false'])
];

// 新增 / 全量更新：字段同文档
const dishBodyRules = [
  body('name').isString().trim().isLength({ min: 1, max: 64 }),
  body('categoryId').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  body('coverUrl').optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body('thumbUrl').optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body('description').optional({ nullable: true }).isString().isLength({ max: 500 }),
  body('spicyLevel').optional({ nullable: true }).isInt().isIn([0, 1, 2, 3]).toInt(),
  body('cookMinutes').optional({ nullable: true }).isInt({ min: 0 }).toInt(),
  body('status').optional({ nullable: true }).isInt().isIn([0, 1]).toInt(),
  body('sort').optional().isInt().toInt(),
  body('ingredients').optional().isArray(),
  body('ingredients.*.name').optional().isString().trim().isLength({ min: 1, max: 32 }),
  body('ingredients.*.amountNote').optional({ nullable: true }).isString().isLength({ max: 50 })
];

const idRule = [param('id').isInt({ min: 1 }).toInt()];

router.get('/', listRules, validate, adminDishController.list);
router.post('/', dishBodyRules, validate, adminDishController.create);
router.patch('/:id/status',
  [param('id').isInt({ min: 1 }).toInt(), body('status').isInt().isIn([0, 1]).toInt()],
  validate,
  adminDishController.updateStatus
);
router.get('/:id', idRule, validate, adminDishController.detail);
router.put('/:id', idRule.concat(dishBodyRules), validate, adminDishController.update);
router.delete('/:id', idRule, validate, adminDishController.remove);

module.exports = router;
