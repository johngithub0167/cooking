const { validationResult } = require('express-validator');
const { AppError } = require('../utils/errors');

function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return next(AppError.badRequest('参数错误', { fields: result.array() }));
  }
  return next();
}

module.exports = validate;
