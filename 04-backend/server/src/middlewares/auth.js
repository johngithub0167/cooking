const jwt = require('jsonwebtoken');

const config = require('../config');
const { AppError } = require('../utils/errors');

/** 校验后台 Authorization: Bearer <token>。 */
function auth(req, res, next) {
  const header = req.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !config.jwt.secret) return next(AppError.unauthorized());

  try {
    const payload = jwt.verify(match[1], config.jwt.secret);
    req.auth = payload;
    return next();
  } catch (error) {
    return next(AppError.unauthorized());
  }
}

module.exports = auth;
