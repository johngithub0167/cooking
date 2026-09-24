/**
 * 路由总入口（BE-001）
 *
 * 挂载位置：app.use('/api', apiRouter)
 *
 * 本次（BE-001）只挂健康检查；业务路由按任务逐个补齐，届时在这里 use 即可：
 *   BE-010 router.use('/categories', require('./categories'));
 *   BE-013 router.use('/dishes', require('./dishes'));
 *   BE-014 router.use('/recommendations', require('./recommend'));
 *   BE-015 router.use('/menus', require('./menus'));
 *   BE-004/012 router.use('/admin', require('./admin'));
 */
const express = require('express');

const healthRoutes = require('./health');

const router = express.Router();

router.use('/health', healthRoutes);

module.exports = router;
