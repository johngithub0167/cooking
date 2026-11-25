/**
 * 后台食材查询路由（BE-011）：/api/admin/ingredients，需要 JWT 鉴权。
 * 由 routes/admin.js 挂载 router.use('/ingredients', ...)。
 */
const express = require('express');
const { query } = require('express-validator');

const adminIngredientController = require('../controllers/adminIngredientController');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validator');

const router = express.Router();

router.use(auth);

router.get('/',
  [query('keyword').optional().isString().trim().isLength({ max: 32 })],
  validate,
  adminIngredientController.search
);

module.exports = router;
