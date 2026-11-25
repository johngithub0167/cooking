/**
 * C 端菜品查询服务（BE-013）
 *
 * 规则（api-design.md §2.2 / §2.3）：
 * - 列表只返回 deleted_at IS NULL 且 status=1；
 * - categoryId 不传或 0 表示全部；keyword 匹配菜名或食材名；
 * - 按 sort 升序、id 降序；page/pageSize 默认 1/20（本层兜底，避免漏传报错）；
 * - 详情：不存在/已删除/已下架一律 404/2001；
 * - 序列化只输出文档字段，不暴露 status/sort/updatedAt/deletedAt 等内部字段。
 *
 * 独立实现，不复用 adminDishService：
 *   admin 的 toListDto 含内部字段、详情允许已删除，与 C 端要求冲突。
 */
const { Op } = require('sequelize');
const { sequelize, Dish, Category, Ingredient, DishIngredient } = require('../models');
const { AppError } = require('../utils/errors');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

function normalizePagination(page, pageSize) {
  const p = Number(page) > 0 ? Number(page) : DEFAULT_PAGE;
  const size = Number(pageSize) > 0 ? Number(pageSize) : DEFAULT_PAGE_SIZE;
  return { page: p, pageSize: size };
}

/** 列表，返回 { list, total, page, pageSize } */
async function list({ page, pageSize, categoryId, keyword } = {}) {
  const { page: p, pageSize: size } = normalizePagination(page, pageSize);

  const where = {
    deletedAt: null,
    status: 1
  };
  const replacements = {};

  // categoryId 不传或 0 表示全部
  const catId = Number(categoryId);
  if (catId > 0) where.categoryId = catId;

  // keyword 匹配菜名或食材名：参数化 EXISTS 子查询（同 BE-011 已验证方案）
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
    attributes: [
      'id', 'name', 'categoryId', 'coverUrl', 'thumbUrl',
      'description', 'spicyLevel', 'cookMinutes'
    ],
    where,
    include: [{ model: Category, attributes: ['name'], required: false }],
    order: [['sort', 'ASC'], ['id', 'DESC']],
    limit: size,
    offset: (p - 1) * size,
    distinct: true,
    raw: false,
    replacements
  });

  // 批量取食材，避免 N+1 查询
  const ids = rows.map(r => r.id);
  const ingredientMap = await loadIngredients(ids);

  const list = rows.map(row => ({
    ...toPublicDto(row),
    ingredients: ingredientMap.get(row.id) || []
  }));

  return { list, total: count, page: p, pageSize: size };
}

/** 详情：仅上架且未删除，含 ingredients；否则 404/2001 */
async function getById(id) {
  const row = await Dish.findOne({
    attributes: [
      'id', 'name', 'categoryId', 'coverUrl', 'thumbUrl',
      'description', 'spicyLevel', 'cookMinutes'
    ],
    where: { id, deletedAt: null, status: 1 },
    include: [{ model: Category, attributes: ['name'], required: false }],
    raw: false
  });
  if (!row) throw AppError.notFound('菜品不存在');

  const ingredientMap = await loadIngredients([row.id]);
  return {
    ...toPublicDto(row),
    ingredients: ingredientMap.get(row.id) || []
  };
}

/** 批量加载菜品食材：{ dishId: [{id,name,amountNote}] } */
async function loadIngredients(dishIds) {
  const map = new Map();
  if (!dishIds.length) return map;

  const links = await DishIngredient.findAll({
    where: { dishId: dishIds },
    include: [{ model: Ingredient, attributes: ['id', 'name'], required: true }],
    order: [['id', 'ASC']],
    raw: false
  });

  for (const link of links) {
    if (!map.has(link.dishId)) map.set(link.dishId, []);
    map.get(link.dishId).push({
      id: link.Ingredient.id,
      name: link.Ingredient.name,
      amountNote: link.amountNote
    });
  }
  return map;
}

/** 严格按文档 §2.2 字段，不暴露内部字段 */
function toPublicDto(row) {
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
    cookMinutes: data.cookMinutes
  };
}

module.exports = { list, getById };
