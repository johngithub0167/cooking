/**
 * 分类业务服务（BE-010）
 * 分层：service 只写业务规则，不碰 req/res；HTTP 细节交给 controller。
 */
const { sequelize, Category } = require('../models');
const { AppError } = require('../utils/errors');

const PUBLIC_FIELDS = ['id', 'name', 'sort'];
const ADMIN_FIELDS = ['id', 'name', 'sort', 'status', 'createdAt', 'updatedAt'];

/** C 端：只返回启用分类，按 sort 升序。 */
async function listPublic() {
  return Category.findAll({
    attributes: PUBLIC_FIELDS,
    where: { status: 1 },
    order: [['sort', 'ASC'], ['id', 'ASC']],
    raw: true
  });
}

/** 后台：全部分类（含停用），按 sort 升序。 */
async function listAdmin() {
  return Category.findAll({
    attributes: ADMIN_FIELDS,
    order: [['sort', 'ASC'], ['id', 'ASC']],
    raw: true
  });
}

/** 名称查重：命中则 2002/409；excludeId 用于更新时排除自身。 */
async function assertNameAvailable(name, excludeId) {
  const where = { name };
  if (excludeId) {
    const { Op } = require('sequelize');
    where.id = { [Op.ne]: excludeId };
  }
  const exists = await Category.findOne({ where, attributes: ['id'], raw: true });
  if (exists) throw AppError.conflict('分类名称已存在');
}

/** 是否有有效值（排除 undefined 与 null；校验器允许 null 表示“不更新”） */
function hasValue(value) {
  return value !== undefined && value !== null;
}

/** 后台：新增分类。数据库时间列 NOT NULL 且模型关闭 timestamps，需手动填时间。 */
async function create(payload) {
  await assertNameAvailable(payload.name);
  const now = new Date();
  const values = {
    name: payload.name,
    createdAt: now,
    updatedAt: now
  };
  // 未传/null 时不写该字段，交由数据库默认值（sort=100、status=1）处理
  if (hasValue(payload.sort)) values.sort = payload.sort;
  if (hasValue(payload.status)) values.status = payload.status;
  const row = await Category.create(values);
  return pickAdminFields(row);
}

/** 后台：部分更新，只覆盖请求中实际提供的字段。 */
async function update(id, payload) {
  const row = await Category.findByPk(id);
  if (!row) throw AppError.notFound('分类不存在');

  if (hasValue(payload.name)) {
    await assertNameAvailable(payload.name, id);
    row.name = payload.name;
  }
  if (hasValue(payload.sort)) row.sort = payload.sort;
  if (hasValue(payload.status)) row.status = payload.status;
  row.updatedAt = new Date();
  await row.save();
  return pickAdminFields(row);
}

/**
 * 后台：删除分类。
 * 事务内先把该分类下菜品 category_id 置 NULL 并取影响行数，再删分类；
 * 与数据库外键 ON DELETE SET NULL 效果一致，且能拿到准确的 affectedDishes。
 */
async function remove(id) {
  const transaction = await sequelize.transaction();
  try {
    const row = await Category.findByPk(id, { transaction });
    if (!row) throw AppError.notFound('分类不存在');

    const queryInterface = sequelize.getQueryInterface();
    const affectedDishes = await queryInterface.bulkUpdate(
      'dishes',
      { category_id: null },
      { category_id: id },
      { transaction }
    );

    await row.destroy({ transaction });
    await transaction.commit();
    return { affectedDishes };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

function pickAdminFields(row) {
  const data = row.get ? row.get({ plain: true }) : row;
  return {
    id: data.id,
    name: data.name,
    sort: data.sort,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
}

module.exports = { listPublic, listAdmin, create, update, remove };
