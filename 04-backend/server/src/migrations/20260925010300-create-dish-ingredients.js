/**
 * 建表：dish_ingredients（菜品-食材关联）
 * 依据：02-design/database-design.md §2.4 / §3
 *
 * 唯一索引：uk_dish_ingredient (dish_id, ingredient_id)
 * 普通索引：idx_ingredient (ingredient_id)
 * 外键：dish_id → dishes.id（CASCADE）、ingredient_id → ingredients.id（CASCADE）
 */
const TABLE = 'dish_ingredients';
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
        dish_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        ingredient_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        amount_note: { type: DataTypes.STRING(50), allowNull: true }
      },
      TABLE_OPTIONS
    );

    await queryInterface.addIndex(TABLE, {
      name: 'uk_dish_ingredient',
      unique: true,
      fields: ['dish_id', 'ingredient_id']
    });
    await queryInterface.addIndex(TABLE, {
      name: 'idx_ingredient',
      fields: ['ingredient_id']
    });

    await queryInterface.addConstraint(TABLE, {
      name: 'fk_di_dish',
      type: 'foreign key',
      fields: ['dish_id'],
      references: { table: 'dishes', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    await queryInterface.addConstraint(TABLE, {
      name: 'fk_di_ingredient',
      type: 'foreign key',
      fields: ['ingredient_id'],
      references: { table: 'ingredients', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  }
};
