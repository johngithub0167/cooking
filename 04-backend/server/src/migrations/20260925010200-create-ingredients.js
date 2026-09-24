/**
 * 建表：ingredients（食材）
 * 依据：02-design/database-design.md §2.3 / §3
 *
 * 注意：本表只有 created_at，没有 updated_at（文档如此定义）
 */
const TABLE = 'ingredients';
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
        name: { type: DataTypes.STRING(32), allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false }
      },
      TABLE_OPTIONS
    );

    await queryInterface.addIndex(TABLE, {
      name: 'uk_ingredient_name',
      unique: true,
      fields: ['name']
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  }
};
