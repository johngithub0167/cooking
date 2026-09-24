/**
 * 建表：categories（分类）
 * 依据：02-design/database-design.md §2.1 / §3
 */
const TABLE = 'categories';
const TABLE_OPTIONS = {
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci',
  engine: 'InnoDB',
  // 时间字段由 migration 显式建（created_at / updated_at），不让 Sequelize 再自动加一组
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
        name: { type: DataTypes.STRING(32), allowNull: false },
        sort: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
        status: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      },
      TABLE_OPTIONS
    );

    await queryInterface.addIndex(TABLE, {
      name: 'uk_category_name',
      unique: true,
      fields: ['name']
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  }
};
