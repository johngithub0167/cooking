/**
 * 菜单记录模型（BE-015）
 * 依据：database-design.md §2.5 与 migration 20260925010400-create-menu-records.js
 *
 * 该表只有 created_at，没有 updated_at：timestamps:false，只定义 createdAt。
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MenuRecord = sequelize.define('MenuRecord', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  mealDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'meal_date' },
  itemCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'item_count' },
  remark: { type: DataTypes.STRING(200), allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' }
}, {
  tableName: 'menu_records',
  timestamps: false
});

module.exports = MenuRecord;
