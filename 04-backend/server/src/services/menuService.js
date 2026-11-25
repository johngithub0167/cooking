/**
 * 菜单记录服务（BE-015）
 *
 * 规则（api-design.md §2.5/2.6/2.7）：
 * - 创建：重查菜品写名称/图片快照，不信任前端；菜品必须上架且未删除；
 *   itemCount 为份数合计；事务写入；mealDate 默认服务端当天（东八区）。
 * - 历史：按 meal_date 倒序分页，每条 preview 最多 3 项。
 * - 详情：记录不存在 → 404/2001；含完整 items。
 * - page/pageSize 默认 1/20（本层兜底）。
 * 后台 /api/admin/menus 复用 listHistory / getDetail，结构相同。
 */
const { Op } = require('sequelize');
const { sequelize, Dish, MenuRecord, MenuItem } = require('../models');
const { AppError } = require('../utils/errors');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

function normalizePagination(page, pageSize) {
  const p = Number(page) > 0 ? Number(page) : DEFAULT_PAGE;
  const size = Number(pageSize) > 0 ? Number(pageSize) : DEFAULT_PAGE_SIZE;
  return { page: p, pageSize: size };
}

/** 服务端当天日期 YYYY-MM-DD（东八区，与 config.db.timezone 一致） */
function todayInShanghai() {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

/** 创建菜单记录，返回 { id, mealDate, itemCount } */
async function create({ mealDate, remark, items }) {
  const date = mealDate || todayInShanghai();
  const transaction = await sequelize.transaction();
  try {
    // 校验 items 1~50、quantity 1~99（路由已校验，这里防御性再兜底）
    if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
      throw AppError.badRequest('items 需为 1~50 项');
    }

    // 批量重查菜品：必须上架且未删除
    const ids = items.map(i => Number(i.dishId));
    const dishes = await Dish.findAll({
      where: { id: ids, status: 1, deletedAt: null },
      transaction
    });
    const dishMap = new Map(dishes.map(d => [d.id, d]));

    const now = new Date();
    const normalized = [];
    for (const item of items) {
      const id = Number(item.dishId);
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        throw AppError.badRequest('菜品数量需为 1~99');
      }
      const dish = dishMap.get(id);
      if (!dish) throw AppError.badRequest(`菜品 #${id} 不可用`);
      normalized.push({
        dishId: id,
        dishName: dish.name,
        coverUrl: dish.coverUrl || null,
        quantity: qty
      });
    }

    const itemCount = normalized.reduce((sum, i) => sum + i.quantity, 0);
    const record = await MenuRecord.create({
      mealDate: date,
      itemCount,
      remark: remark || null,
      createdAt: now
    }, { transaction });

    await MenuItem.bulkCreate(
      normalized.map(i => ({
        recordId: record.id,
        dishId: i.dishId,
        dishName: i.dishName,
        coverUrl: i.coverUrl,
        quantity: i.quantity,
        createdAt: now
      })),
      { transaction }
    );

    await transaction.commit();
    return { id: record.id, mealDate: record.mealDate, itemCount: record.itemCount };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/** 历史列表：分页 + 日期筛选，每条 preview ≤3。返回 { list, total, page, pageSize } */
async function listHistory({ page, pageSize, startDate, endDate } = {}) {
  const { page: p, pageSize: size } = normalizePagination(page, pageSize);
  const where = {};
  if (startDate || endDate) {
    where.mealDate = {};
    if (startDate) where.mealDate[Op.gte] = startDate;
    if (endDate) where.mealDate[Op.lte] = endDate;
  }

  const { count, rows } = await MenuRecord.findAndCountAll({
    where,
    order: [['mealDate', 'DESC'], ['id', 'DESC']],
    limit: size,
    offset: (p - 1) * size,
    raw: false
  });

  // 批量取 preview：每条记录前 3 条明细（按 id 升序，即提交顺序）
  const recordIds = rows.map(r => r.id);
  const previewMap = await loadPreview(recordIds);

  const list = rows.map(r => ({
    id: r.id,
    mealDate: r.mealDate,
    itemCount: r.itemCount,
    createdAt: r.createdAt,
    preview: previewMap.get(r.id) || []
  }));

  return { list, total: count, page: p, pageSize: size };
}

/** 详情：含完整 items；记录不存在 → 404/2001 */
async function getDetail(id) {
  const record = await MenuRecord.findByPk(id);
  if (!record) throw AppError.notFound('菜单记录不存在');

  const items = await MenuItem.findAll({
    where: { recordId: id },
    order: [['id', 'ASC']],
    raw: false
  });

  return {
    id: record.id,
    mealDate: record.mealDate,
    itemCount: record.itemCount,
    items: items.map(toItemDto)
  };
}

/** 批量加载每条记录前 3 条明细 */
async function loadPreview(recordIds) {
  const map = new Map();
  if (!recordIds.length) return map;
  const rows = await MenuItem.findAll({
    where: { recordId: recordIds },
    order: [['id', 'ASC']],
    raw: false
  });
  for (const row of rows) {
    if (!map.has(row.recordId)) map.set(row.recordId, []);
    const arr = map.get(row.recordId);
    if (arr.length < 3) {
      arr.push({ dishName: row.dishName, coverUrl: row.coverUrl, quantity: row.quantity });
    }
  }
  return map;
}

function toItemDto(row) {
  return {
    dishId: row.dishId,
    dishName: row.dishName,
    coverUrl: row.coverUrl,
    quantity: row.quantity
  };
}

module.exports = { create, listHistory, getDetail };
