/**
 * 健康检查路由（BE-001）
 * 挂载在 /api/health（见 routes/index.js）
 */
const express = require('express');

const healthController = require('../controllers/healthController');

const router = express.Router();

router.get('/', healthController.check);

module.exports = router;
