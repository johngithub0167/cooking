/**
 * 建表：menu_records（菜单记录）
 * 依据：02-design/database-design.md §2.5 / §3
 *
 * 索引：idx_menu_date (meal_date)
 * 注意：本表只有 created_at，没有 updated_at（文档如此定义）
 */
const TABLE = 'menu_records';
const TABLE_OPTIONS = {
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci',
  engine: 'InnoDB',
  timestamps: false
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    await queryInterface.createTable(
      TABLE,
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        meal_date: { type: DataTypes.DATEONLY, allowNull: false },
        item_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        remark: { type: DataTypes.STRING(200), allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false }
      },
      TABLE_OPTIONS
    );

    await queryInterface.addIndex(TABLE, {
      name: 'idx_menu_date',
      fields: ['meal_date']
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  }
};
