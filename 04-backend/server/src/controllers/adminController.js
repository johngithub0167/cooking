const adminService = require('../services/adminService');
const { ok } = require('../utils/response');

async function login(req, res, next) {
  try {
    return ok(res, await adminService.login(req.body.username, req.body.password));
  } catch (error) {
    return next(error);
  }
}

async function profile(req, res, next) {
  try {
    return ok(res, await adminService.profile(req.auth.id));
  } catch (error) {
    return next(error);
  }
}

module.exports = { login, profile };
