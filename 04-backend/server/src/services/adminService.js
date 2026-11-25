const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const config = require('../config');
const Admin = require('../models/admin');
const { AppError } = require('../utils/errors');

async function login(username, password) {
  if (!config.jwt.secret) throw AppError.internal('JWT_SECRET 未配置');
  const admin = await Admin.scope('withPassword').findOne({ where: { username } });
  const valid = admin && await bcrypt.compare(password, admin.passwordHash);
  if (!valid) throw AppError.badRequest('账号或密码错误');

  const now = new Date();
  await admin.update({ lastLoginAt: now });
  const token = jwt.sign({ id: admin.id, username: admin.username }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
  return { token, expiresIn: config.jwt.expiresIn, username: admin.username };
}

async function profile(adminId) {
  const admin = await Admin.findByPk(adminId);
  if (!admin) throw AppError.unauthorized();
  return {
    id: admin.id,
    username: admin.username,
    lastLoginAt: admin.lastLoginAt
  };
}

module.exports = { login, profile };
