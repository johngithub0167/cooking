/**
 * 菜品模型（BE-011）
 * 依据：database-design.md §2.2 与 migration 20260925010100-create-dishes.js
 *
 * 逐列对齐：timestamps:false，camelCase 属性显式 field 映射蛇形列。
 * 不使用 Sequelize paranoid：deleted_at 由 service 手动写入（文档要求 paranoid:false）。
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Dish = sequelize.define('Dish', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  name: { type: DataTypes.STRING(64), allowNull: false },
  categoryId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'category_id' },
  coverUrl: { type: DataTypes.STRING(255), allowNull: true, field: 'cover_url' },
  thumbUrl: { type: DataTypes.STRING(255), allowNull: true, field: 'thumb_url' },
  description: { type: DataTypes.STRING(500), allowNull: true },
  spicyLevel: { type: DataTypes.TINYINT, allowNull: true, field: 'spicy_level' },
  cookMinutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'cook_minutes' },
  status: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
  sort: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  deletedAt: { type: DataTypes.DATE, allowNull: true, field: 'deleted_at' }
}, {
  tableName: 'dishes',
  timestamps: false
});

module.exports = Dish;
