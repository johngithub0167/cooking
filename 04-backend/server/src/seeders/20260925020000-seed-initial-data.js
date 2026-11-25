/**
 * BE-016 初始种子数据
 * 依据：02-design/database-design.md §5
 *
 * 设计为可重复执行：按唯一名称查找，已存在的数据不重复插入；
 * 菜品食材关联按复合唯一键补齐，不覆盖已有业务数据。
 */
const bcrypt = require('bcryptjs');
const config = require('../config');

const now = new Date();

const categories = [
  { name: '荤菜', sort: 10, status: 1 },
  { name: '素菜', sort: 20, status: 1 },
  { name: '汤羹', sort: 30, status: 1 },
  { name: '主食', sort: 40, status: 1 }
];

const dishes = [
  ['番茄炒蛋', '荤菜', '酸甜下饭的家常快手菜', 0, 10, [['鸡蛋', '2 个'], ['西红柿', '2 个']]],
  ['红烧肉', '荤菜', '肥而不腻，酱香浓郁', 0, 60, [['五花肉', '500 克'], ['冰糖', '20 克']]],
  ['宫保鸡丁', '荤菜', '咸甜微辣，口感丰富', 1, 25, [['鸡胸肉', '300 克'], ['花生米', '50 克']]],
  ['鱼香肉丝', '荤菜', '酸甜微辣，配菜丰富', 1, 25, [['猪里脊', '250 克'], ['木耳', '适量']]],
  ['青椒肉丝', '荤菜', '下饭家常小炒', 1, 20, [['猪里脊', '250 克'], ['青椒', '2 个']]],
  ['可乐鸡翅', '荤菜', '咸甜入味，老少皆宜', 0, 40, [['鸡翅', '8 个'], ['可乐', '330 毫升']]],
  ['糖醋排骨', '荤菜', '酸甜酥香的经典菜', 0, 50, [['排骨', '500 克'], ['冰糖', '30 克']]],
  ['蒜香虾', '荤菜', '蒜香浓郁，鲜嫩爽口', 0, 15, [['鲜虾', '300 克'], ['大蒜', '适量']]],
  ['清炒时蔬', '素菜', '清淡爽口，简单快手', 0, 10, [['时令蔬菜', '400 克'], ['大蒜', '适量']]],
  ['地三鲜', '素菜', '软糯鲜香的东北家常菜', 0, 30, [['茄子', '1 根'], ['土豆', '1 个'], ['青椒', '1 个']]],
  ['麻婆豆腐', '素菜', '麻辣鲜香，入口嫩滑', 2, 20, [['嫩豆腐', '1 盒'], ['豆瓣酱', '1 勺']]],
  ['酸辣土豆丝', '素菜', '酸辣开胃，爽脆可口', 2, 15, [['土豆', '2 个'], ['干辣椒', '适量']]],
  ['干煸四季豆', '素菜', '香辣入味，口感干香', 1, 25, [['四季豆', '400 克'], ['猪肉末', '50 克']]],
  ['手撕包菜', '素菜', '清脆爽口的下饭菜', 1, 15, [['包菜', '半 个'], ['干辣椒', '适量']]],
  ['蚝油生菜', '素菜', '鲜嫩清爽，蒜香十足', 0, 10, [['生菜', '400 克'], ['蚝油', '1 勺']]],
  ['木耳炒鸡蛋', '素菜', '营养简单的家常小炒', 0, 15, [['木耳', '适量'], ['鸡蛋', '3 个']]],
  ['紫菜蛋花汤', '汤羹', '清淡鲜美，简单快手', 0, 10, [['紫菜', '1 小把'], ['鸡蛋', '1 个']]],
  ['冬瓜排骨汤', '汤羹', '清甜鲜美，汤味醇厚', 0, 70, [['冬瓜', '400 克'], ['排骨', '300 克']]],
  ['玉米胡萝卜排骨汤', '汤羹', '清甜营养的家常汤', 0, 70, [['玉米', '1 根'], ['胡萝卜', '1 根'], ['排骨', '300 克']]],
  ['酸辣汤', '汤羹', '酸辣开胃，暖胃驱寒', 2, 25, [['豆腐', '100 克'], ['木耳', '适量']]],
  ['菌菇鸡汤', '汤羹', '鲜香滋补，汤色清亮', 0, 60, [['鸡腿', '2 个'], ['香菇', '适量']]],
  ['鲫鱼豆腐汤', '汤羹', '汤鲜味美，营养丰富', 0, 45, [['鲫鱼', '1 条'], ['豆腐', '1 盒']]],
  ['扬州炒饭', '主食', '粒粒分明，配料丰富', 0, 20, [['米饭', '2 碗'], ['鸡蛋', '2 个']]],
  ['蛋炒饭', '主食', '简单快手，香气十足', 0, 15, [['米饭', '1 碗'], ['鸡蛋', '2 个']]],
  ['葱油拌面', '主食', '葱香浓郁，制作简单', 0, 15, [['面条', '200 克'], ['小葱', '适量']]],
  ['番茄鸡蛋面', '主食', '酸甜鲜美，汤面可口', 0, 20, [['面条', '200 克'], ['西红柿', '1 个'], ['鸡蛋', '1 个']]],
  ['香菇鸡肉粥', '主食', '软糯鲜香，营养暖胃', 0, 45, [['大米', '100 克'], ['鸡胸肉', '100 克'], ['香菇', '适量']]],
  ['猪肉白菜饺子', '主食', '家常鲜香，适合分享', 0, 60, [['猪肉馅', '300 克'], ['白菜', '300 克'], ['饺子皮', '适量']]],
  ['牛肉粉丝煲', '主食', '牛肉鲜嫩，粉丝爽滑', 1, 35, [['牛肉', '200 克'], ['粉丝', '1 把']]],
  ['鸡蛋灌饼', '主食', '外酥里嫩，早餐首选', 0, 20, [['面粉', '200 克'], ['鸡蛋', '2 个']]]
];

function rowsWithTimestamps(rows, extra = {}) {
  return rows.map((row) => ({ ...row, ...extra, created_at: now, updated_at: now }));
}

async function selectByNames(queryInterface, table, names, transaction) {
  if (!names.length) return [];
  const [rows] = await queryInterface.sequelize.query(
    `SELECT id, name FROM ${table} WHERE name IN (:names)`,
    { replacements: { names }, transaction }
  );
  return rows;
}

async function insertMissing(queryInterface, table, rows, transaction, key = 'name') {
  const existing = await selectByNames(queryInterface, table, rows.map((row) => row[key]), transaction);
  const existingNames = new Set(existing.map((row) => row[key]));
  const missing = rows.filter((row) => !existingNames.has(row[key]));
  if (missing.length) await queryInterface.bulkInsert(table, missing, { transaction });
  return selectByNames(queryInterface, table, rows.map((row) => row[key]), transaction);
}

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const categoryRows = rowsWithTimestamps(categories);
      const categoryRecords = await insertMissing(queryInterface, 'categories', categoryRows, transaction);
      const categoryIds = new Map(categoryRecords.map((row) => [row.name, row.id]));

      const dishRows = dishes.map(([name, category, description, spicyLevel, cookMinutes]) => ({
        name,
        category_id: categoryIds.get(category),
        cover_url: null,
        thumb_url: null,
        description,
        spicy_level: spicyLevel,
        cook_minutes: cookMinutes,
        status: 1,
        sort: 100
      }));
      const dishRecords = await insertMissing(queryInterface, 'dishes', rowsWithTimestamps(dishRows), transaction);
      const dishIds = new Map(dishRecords.map((row) => [row.name, row.id]));

      const ingredientNames = [...new Set(dishes.flatMap(([, , , , , ingredients]) => ingredients.map(([name]) => name)))];
      const ingredientRows = ingredientNames.map((name) => ({ name, created_at: now }));
      const ingredientRecords = await insertMissing(queryInterface, 'ingredients', ingredientRows, transaction);
      const ingredientIds = new Map(ingredientRecords.map((row) => [row.name, row.id]));

      const links = [];
      for (const [name, , , , , ingredients] of dishes) {
        for (const [ingredientName, amountNote] of ingredients) {
          links.push({ dish_id: dishIds.get(name), ingredient_id: ingredientIds.get(ingredientName), amount_note: amountNote });
        }
      }
      const [existingLinks] = await queryInterface.sequelize.query(
        'SELECT dish_id, ingredient_id FROM dish_ingredients WHERE dish_id IN (:dishIds)',
        { replacements: { dishIds: [...dishIds.values()] }, transaction }
      );
      const linkKeys = new Set(existingLinks.map((row) => `${row.dish_id}:${row.ingredient_id}`));
      const missingLinks = links.filter((row) => !linkKeys.has(`${row.dish_id}:${row.ingredient_id}`));
      if (missingLinks.length) await queryInterface.bulkInsert('dish_ingredients', missingLinks, { transaction });

      const username = config.admin.defaultUsername;
      const password = config.admin.defaultPassword;
      if (!username || !password) throw new Error('BE-016 需要在 .env 配置 ADMIN_DEFAULT_USERNAME 与 ADMIN_DEFAULT_PASSWORD');
      const [adminRows] = await queryInterface.sequelize.query(
        'SELECT id FROM admins WHERE username = :username LIMIT 1',
        { replacements: { username }, transaction }
      );
      if (!adminRows.length) {
        await queryInterface.bulkInsert('admins', [{
          username,
          password_hash: await bcrypt.hash(password, 10),
          created_at: now,
          last_login_at: null
        }], { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    // 种子不应删除已有业务数据；如需清空请使用数据库备份/管理工具显式操作。
    return undefined;
  }
};
