/**
 * 推荐服务（BE-014）
 *
 * 规则（api-design.md §2.4 / technical-architecture.md §5.3）：
 * 1. 候选池 = dishes 中 status=1 且 deleted_at IS NULL；
 * 2. 排除最近 7 天已点（menu_records + menu_items 原生参数化查询）；
 * 3. 排除 exclude；
 * 4. 分类分散：同分类最多 2 个；
 * 5. 以当天日期为种子做确定性伪随机；
 * 6. 候选不足逐层放宽，附 notice；菜品库为空返回空列表 + 专门提示。
 *
 * 不改 menuItem/menuRecord 模型文件：最近 7 天用 sequelize.query 原生查询。
 */
const { sequelize, Dish, Category } = require('../models');
const config = require('../config');
const { shuffleWithSeed } = require('../utils/seedRandom');

const NOTICE_RELAXED = '菜品较少，已为你放宽推荐条件';
const NOTICE_EMPTY = '还没有菜品，请先到后台添加';
const MAX_PER_CATEGORY = 2;

/** 服务端当天日期 YYYY-MM-DD（东八区） */
function todayKey() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 最近 N 天点过的 dish_id 集合（原生参数化查询，不依赖菜单模型文件） */
async function recentDishIds(days) {
  const since = new Date(Date.now() + 8 * 60 * 60 * 1000);
  since.setUTCDate(since.getUTCDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);
  const [rows] = await sequelize.query(
    `SELECT DISTINCT mi.dish_id AS dishId
       FROM menu_items mi
       INNER JOIN menu_records mr ON mi.record_id = mr.id
      WHERE mr.meal_date >= :since AND mi.dish_id IS NOT NULL`,
    { replacements: { since: sinceStr } }
  );
  return new Set(rows.map(r => Number(r.dishId)));
}

/** 主入口：返回 { list, notice } */
async function recommend({ size, excludeIds } = {}) {
  const target = Number(size) > 0 ? Number(size) : config.recommend.size;
  const exclude = new Set((excludeIds || []).map(Number).filter(n => Number.isInteger(n) && n > 0));
  const seed = todayKey();

  // 候选池：上架未删除，带分类名
  const dishes = await Dish.findAll({
    attributes: ['id', 'name', 'categoryId', 'coverUrl', 'thumbUrl', 'description'],
    where: { status: 1, deletedAt: null },
    include: [{ model: Category, attributes: ['name'], required: false }],
    raw: false
  });

  if (dishes.length === 0) {
    return { list: [], notice: NOTICE_EMPTY };
  }

  const pool = dishes.map(toRecommendDto);
  const recent = await recentDishIds(config.recommend.excludeDays);

  // 分层优先级：首选池 → 放宽(允许近期已点) → 再放宽(允许 exclude)
  const inExclude = d => exclude.has(d.id);
  const inRecent = d => recent.has(d.id);

  let candidates = pool.filter(d => !inRecent(d) && !inExclude(d));
  let relaxed = false;

  if (candidates.length < target) {
    relaxed = true;
    candidates = pool.filter(d => !inExclude(d));
  }
  if (candidates.length < target) {
    relaxed = true;
    candidates = pool.slice();
  }

  // 以当天种子打乱，再按分类分散取（同分类最多 2 个）
  const shuffled = shuffleWithSeed(candidates, seed);
  const picked = pickDiversified(shuffled, target);

  return {
    list: picked,
    notice: relaxed ? NOTICE_RELAXED : ''
  };
}

/**
 * 分类分散选举：按打乱后的顺序轮流取，同一 categoryId 最多 2 个。
 * 先轮转每个分类取第 1 个，再轮转取第 2 个，直到凑够 size 或无可选。
 */
function pickDiversified(shuffled, size) {
  const groups = new Map();
  for (const d of shuffled) {
    const key = d.categoryId || 0;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  }

  const picked = [];
  for (let round = 1; round <= MAX_PER_CATEGORY && picked.length < size; round += 1) {
    for (const [, arr] of groups) {
      if (arr.length < round) continue;
      picked.push(arr[round - 1]);
      if (picked.length >= size) break;
    }
  }
  return picked;
}

/** 按文档 §2.4 字段序列化（不含 ingredients/spicyLevel/cookMinutes 等） */
function toRecommendDto(row) {
  const data = row.get ? row.get({ plain: true }) : row;
  return {
    id: data.id,
    name: data.name,
    categoryId: data.categoryId,
    categoryName: data.Category ? data.Category.name : null,
    coverUrl: data.coverUrl,
    thumbUrl: data.thumbUrl,
    description: data.description
  };
}

module.exports = { recommend };
