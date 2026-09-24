/**
 * 建表：dishes（菜品）
 * 依据：02-design/database-design.md §2.2 / §3
 *
 * 索引：idx_dishes_list (status, deleted_at, category_id, sort)、idx_dishes_name (name)
 * 外键：category_id → categories.id，ON DELETE SET NULL（分类删除后菜品变「未分类」）
 */
const TABLE = 'dishes';
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
        name: { type: DataTypes.STRING(64), allowNull: false },
        category_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        cover_url: { type: DataTypes.STRING(255), allowNull: true },
        thumb_url: { type: DataTypes.STRING(255), allowNull: true },
        description: { type: DataTypes.STRING(500), allowNull: true },
        spicy_level: { type: DataTypes.TINYINT, allowNull: true },
        cook_minutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        status: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
        sort: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
        deleted_at: { type: DataTypes.DATE, allowNull: true }
      },
      TABLE_OPTIONS
    );

    await queryInterface.addIndex(TABLE, {
      name: 'idx_dishes_list',
      fields: ['status', 'deleted_at', 'category_id', 'sort']
    });
    await queryInterface.addIndex(TABLE, {
      name: 'idx_dishes_name',
      fields: ['name']
    });

    await queryInterface.addConstraint(TABLE, {
      name: 'fk_dish_category',
      type: 'foreign key',
      fields: ['category_id'],
      references: { table: 'categories', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  }
};
