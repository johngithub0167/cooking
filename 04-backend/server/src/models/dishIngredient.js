/**
 * 菜品-食材关联模型（BE-011）
 * 依据：database-design.md §2.4 与 migration 20260925010300-create-dish-ingredients.js
 *
 * 该表无时间列：timestamps:false。唯一键 (dish_id, ingredient_id)。
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DishIngredient = sequelize.define('DishIngredient', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  dishId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'dish_id' },
  ingredientId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'ingredient_id' },
  amountNote: { type: DataTypes.STRING(50), allowNull: true, field: 'amount_note' }
}, {
  tableName: 'dish_ingredients',
  timestamps: false,
  indexes: [{ name: 'uk_dish_ingredient', unique: true, fields: ['dish_id', 'ingredient_id'] }]
});

module.exports = DishIngredient;
