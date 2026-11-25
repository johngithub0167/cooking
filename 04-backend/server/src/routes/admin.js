const express = require('express');
const { body } = require('express-validator');

const adminController = require('../controllers/adminController');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validator');

const router = express.Router();

router.post('/login',
  body('username').isString().trim().isLength({ min: 1, max: 32 }),
  body('password').isString().isLength({ min: 1 }),
  validate,
  adminController.login
);
router.get('/profile', auth, adminController.profile);

module.exports = router;
