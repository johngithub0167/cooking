/**
 * 后台菜品服务（BE-011）
 *
 * 规则：
 * - 列表默认排除 deleted_at IS NOT NULL，includeDeleted=true 才包含；
 * - keyword 匹配菜名或食材名；categoryName 通过关联 Category 取得；
 * - 新增/编辑时 ingredients[].name 不存在则自动创建食材，同名去重；多表写入走事务；
 * - PUT 全量覆盖；DELETE 逻辑删除（写 deleted_at）；PATCH 上下架。
 */
const { Op } = require('sequelize');
const { sequelize, Dish, Category, Ingredient, DishIngredient } = require('../models');
const { AppError } = require('../utils/errors');

const LIST_FIELDS = [
  'id', 'name', 'categoryId', 'coverUrl', 'thumbUrl', 'description',
  'spicyLevel', 'cookMinutes', 'status', 'sort', 'updatedAt', 'deletedAt'
];

/** 列表（分页 + 筛选），返回 { list, total } */
async function list({ page, pageSize, categoryId, status, keyword, includeDeleted }) {
  const where = {};
  const replacements = {};
  if (!includeDeleted) where.deletedAt = null;
  if (categoryId) where.categoryId = categoryId;
  if (status === 0 || status === 1) where.status = status;

  // keyword 同时匹配菜名或食材名。
  // 用 EXISTS 子查询而非 include 多对多：Sequelize 带 include + limit 时会把 WHERE 包进
  // 内层子查询，而多对多 JOIN 在外层，引用食材列会报 Unknown column。
  // 子查询完全自包含，只用 replacements 参数化绑定，禁止字符串拼值。
  if (keyword) {
    replacements.kw = `%${keyword}%`;
    where[Op.or] = [
      sequelize.literal('`Dish`.`name` LIKE :kw'),
      sequelize.literal(
        'EXISTS (SELECT 1 FROM `dish_ingredients` `di` INNER JOIN `ingredients` `ig` ON `di`.`ingredient_id` = `ig`.`id` WHERE `di`.`dish_id` = `Dish`.`id` AND `ig`.`name` LIKE :kw)'
      )
    ];
  }

  const { count, rows } = await Dish.findAndCountAll({
    attributes: LIST_FIELDS,
    where,
    include: [{ model: Category, attributes: ['name'], required: false }],
    order: [['sort', 'ASC'], ['id', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    distinct: true,
    raw: false,
    replacements
  });

  const list = rows.map(toListDto);
  return { list, total: count };
}

/** 详情：含 ingredients，已删除菜品也可查（保留历史记录） */
async function getById(id) {
  const dish = await Dish.findByPk(id, {
    include: [{ model: Category, attributes: ['name'], required: false }]
  });
  if (!dish) throw AppError.notFound('菜品不存在');

  const ingredients = await DishIngredient.findAll({
    where: { dishId: id },
    include: [{ model: Ingredient, attributes: ['id', 'name'], required: true }],
    order: [['id', 'ASC']],
    raw: false
  });

  return {
    ...toListDto(dish),
    ingredients: ingredients.map(link => ({
      id: link.Ingredient.id,
      name: link.Ingredient.name,
      amountNote: link.amountNote
    }))
  };
}

/** 新增：返回 { id } */
async function create(payload) {
  const now = new Date();
  const transaction = await sequelize.transaction();
  try {
    const dish = await Dish.create({
      name: payload.name,
      categoryId: payload.categoryId ?? null,
      coverUrl: payload.coverUrl ?? null,
      thumbUrl: payload.thumbUrl ?? null,
      description: payload.description ?? null,
      spicyLevel: payload.spicyLevel ?? null,
      cookMinutes: payload.cookMinutes ?? null,
      status: payload.status === undefined || payload.status === null ? 1 : payload.status,
      sort: payload.sort === undefined || payload.sort === null ? 100 : payload.sort,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }, { transaction });

    await syncIngredients(dish.id, payload.ingredients, transaction, now);
    await transaction.commit();
    return { id: dish.id };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/** 全量覆盖更新：返回 { id } */
async function update(id, payload) {
  const transaction = await sequelize.transaction();
  try {
    const dish = await Dish.findByPk(id, { transaction });
    if (!dish) throw AppError.notFound('菜品不存在');

    const now = new Date();
    dish.name = payload.name;
    dish.categoryId = payload.categoryId ?? null;
    dish.coverUrl = payload.coverUrl ?? null;
    dish.thumbUrl = payload.thumbUrl ?? null;
    dish.description = payload.description ?? null;
    dish.spicyLevel = payload.spicyLevel ?? null;
    dish.cookMinutes = payload.cookMinutes ?? null;
    dish.status = payload.status === undefined || payload.status === null ? 1 : payload.status;
    dish.sort = payload.sort === undefined || payload.sort === null ? 100 : payload.sort;
    dish.updatedAt = now;
    await dish.save({ transaction });

    await syncIngredients(id, payload.ingredients, transaction, now);
    await transaction.commit();
    return { id: dish.id };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/** 逻辑删除：写 deleted_at，不物理删 */
async function remove(id) {
  const dish = await Dish.findByPk(id);
  if (!dish) throw AppError.notFound('菜品不存在');
  dish.deletedAt = new Date();
  dish.updatedAt = new Date();
  await dish.save();
  return { id: dish.id };
}

/** 上下架：PATCH status */
async function updateStatus(id, status) {
  const dish = await Dish.findByPk(id);
  if (!dish) throw AppError.notFound('菜品不存在');
  dish.status = status;
  dish.updatedAt = new Date();
  await dish.save();
  return { id: dish.id, status: dish.status };
}

/**
 * 同步菜品食材关联：全量替换。
 * - 先清掉旧关联；
 * - 按 name 去重（避免 uk_dish_ingredient 冲突）；
 * - name 不存在则创建食材（唯一约束兜底并发）。
 */
async function syncIngredients(dishId, ingredients, transaction, now) {
  await DishIngredient.destroy({ where: { dishId }, transaction });
  if (!Array.isArray(ingredients) || ingredients.length === 0) return;

  const seen = new Set();
  for (const item of ingredients) {
    const name = item.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);

    let ingredient = await Ingredient.findOne({ where: { name }, transaction });
    if (!ingredient) {
      try {
        ingredient = await Ingredient.create({ name, createdAt: now }, { transaction });
      } catch (error) {
        // 并发下唯一约束冲突：重新查一次
        if (error.name !== 'SequelizeUniqueConstraintError') throw error;
        ingredient = await Ingredient.findOne({ where: { name }, transaction });
      }
    }
    if (!ingredient) continue;
    await DishIngredient.create({
      dishId,
      ingredientId: ingredient.id,
      amountNote: item.amountNote ?? null
    }, { transaction });
  }
}

function toListDto(row) {
  const data = row.get ? row.get({ plain: true }) : row;
  return {
    id: data.id,
    name: data.name,
    categoryId: data.categoryId,
    categoryName: data.Category ? data.Category.name : null,
    coverUrl: data.coverUrl,
    thumbUrl: data.thumbUrl,
    description: data.description,
    spicyLevel: data.spicyLevel,
    cookMinutes: data.cookMinutes,
    status: data.status,
    sort: data.sort,
    updatedAt: data.updatedAt,
    deletedAt: data.deletedAt
  };
}

module.exports = { list, getById, create, update, remove, updateStatus };
