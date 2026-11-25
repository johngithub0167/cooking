/**
 * 模型统一加载入口（BE-010 建，BE-011 追加菜品/食材模型）
 *
 * admin.js、category.js 及其导出保持不动；这里只追加导出与关联定义。
 */
const { sequelize, Sequelize } = require('../config/database');

const Admin = require('./admin');
const Category = require('./category');
const Dish = require('./dish');
const Ingredient = require('./ingredient');
const DishIngredient = require('./dishIngredient');
const MenuRecord = require('./menuRecord');
const MenuItem = require('./menuItem');

// ---- 关联定义 ----
// 菜品属于分类（分类删除后 category_id 置 NULL，由数据库外键保证）
Dish.belongsTo(Category, { foreignKey: 'categoryId', targetKey: 'id' });
Category.hasMany(Dish, { foreignKey: 'categoryId', sourceKey: 'id' });

// 菜品与食材多对多，通过 dish_ingredients
Dish.belongsToMany(Ingredient, { through: DishIngredient, foreignKey: 'dishId', otherKey: 'ingredientId' });
Ingredient.belongsToMany(Dish, { through: DishIngredient, foreignKey: 'ingredientId', otherKey: 'dishId' });

// 直接关联，便于带出 amount_note
Dish.hasMany(DishIngredient, { foreignKey: 'dishId', sourceKey: 'id' });
DishIngredient.belongsTo(Ingredient, { foreignKey: 'ingredientId', targetKey: 'id' });

// 菜单记录 → 明细（dish_id 不建外键关联，菜品删除后历史仍可读）
MenuRecord.hasMany(MenuItem, { foreignKey: 'recordId', sourceKey: 'id' });
MenuItem.belongsTo(MenuRecord, { foreignKey: 'recordId', targetKey: 'id' });

module.exports = {
  sequelize,
  Sequelize,
  Admin,
  Category,
  Dish,
  Ingredient,
  DishIngredient,
  MenuRecord,
  MenuItem
};
