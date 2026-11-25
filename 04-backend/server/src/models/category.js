/**
 * 分类模型（BE-010）
 * 依据：database-design.md §2.1 与 migration 20260925010000-create-categories.js
 *
 * migration 用 timestamps:false 显式建 created_at / updated_at，
 * 因此这里同样关闭 timestamps，并用 field 映射到蛇形列名，避免多出一组驼峰列。
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: 'uk_category_name'
  },
  sort: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at'
  }
}, {
  tableName: 'categories',
  timestamps: false
});

module.exports = Category;
