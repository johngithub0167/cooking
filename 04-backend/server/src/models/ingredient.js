/**
 * 食材模型（BE-011）
 * 依据：database-design.md §2.3 与 migration 20260925010200-create-ingredients.js
 *
 * 该表只有 created_at，没有 updated_at：timestamps:false，只定义 createdAt。
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Ingredient = sequelize.define('Ingredient', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  name: { type: DataTypes.STRING(32), allowNull: false, unique: 'uk_ingredient_name' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' }
}, {
  tableName: 'ingredients',
  timestamps: false
});

module.exports = Ingredient;
