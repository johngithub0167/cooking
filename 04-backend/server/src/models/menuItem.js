/**
 * 菜单明细模型（BE-015）
 * 依据：database-design.md §2.6 与 migration 20260925010500-create-menu-items.js
 *
 * 该表无 updated_at：timestamps:false。dishId 故意不加外键（菜品删除后历史仍可读）。
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MenuItem = sequelize.define('MenuItem', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  recordId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'record_id' },
  dishId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'dish_id' },
  dishName: { type: DataTypes.STRING(64), allowNull: false, field: 'dish_name' },
  coverUrl: { type: DataTypes.STRING(255), allowNull: true, field: 'cover_url' },
  quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' }
}, {
  tableName: 'menu_items',
  timestamps: false
});

module.exports = MenuItem;
