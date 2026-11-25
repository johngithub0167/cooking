/** 管理员模型：默认查询不返回 password_hash。 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Admin = sequelize.define('Admin', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(32), allowNull: false },
  passwordHash: { type: DataTypes.STRING(128), allowNull: false, field: 'password_hash' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  lastLoginAt: { type: DataTypes.DATE, allowNull: true, field: 'last_login_at' }
}, {
  tableName: 'admins',
  timestamps: false,
  defaultScope: { attributes: { exclude: ['passwordHash'] } },
  scopes: { withPassword: { attributes: { include: ['passwordHash'] } } }
});

module.exports = Admin;
