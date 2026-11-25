/**
 * C 端分类路由（BE-010）：GET /api/categories，免鉴权。
 * 挂载点见 routes/index.js 的 router.use('/categories', ...)。
 */
const express = require('express');

const categoryController = require('../controllers/categoryController');

const router = express.Router();

router.get('/', categoryController.listPublic);

module.exports = router;
