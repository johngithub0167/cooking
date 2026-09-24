/**
 * 建表：menu_items（菜单明细）
 * 依据：02-design/database-design.md §2.6 / §3
 *
 * 索引：idx_record (record_id)、idx_dish (dish_id)（推荐算法查「最近 7 天吃过」依赖它）
 * 外键：只有 record_id → menu_records.id（CASCADE）；
 *      dish_id 故意不加外键：菜品删除后历史仍可读（database-design.md §4 MenuItem 约定）
 * dish_name / cover_url 是快照字段，不随菜品变动。
 */
const TABLE = 'menu_items';
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
        record_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        dish_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        dish_name: { type: DataTypes.STRING(64), allowNull: false },
        cover_url: { type: DataTypes.STRING(255), allowNull: true },
        quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        created_at: { type: DataTypes.DATE, allowNull: false }
      },
      TABLE_OPTIONS
    );

    await queryInterface.addIndex(TABLE, {
      name: 'idx_record',
      fields: ['record_id']
    });
    await queryInterface.addIndex(TABLE, {
      name: 'idx_dish',
      fields: ['dish_id']
    });

    await queryInterface.addConstraint(TABLE, {
      name: 'fk_item_record',
      type: 'foreign key',
      fields: ['record_id'],
      references: { table: 'menu_records', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  }
};
