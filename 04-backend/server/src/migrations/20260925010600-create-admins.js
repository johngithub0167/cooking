/**
 * 建表：admins（管理员）
 * 依据：02-design/database-design.md §2.7 / §3
 *
 * 唯一索引：uk_admin_username (username)
 * 注意：本表只有 created_at / last_login_at，没有 updated_at（文档如此定义）
 * password_hash 只存 bcryptjs 哈希，永不明文；查询时由模型 defaultScope 排除
 */
const TABLE = 'admins';
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
        username: { type: DataTypes.STRING(32), allowNull: false },
        password_hash: { type: DataTypes.STRING(128), allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false },
        last_login_at: { type: DataTypes.DATE, allowNull: true }
      },
      TABLE_OPTIONS
    );

    await queryInterface.addIndex(TABLE, {
      name: 'uk_admin_username',
      unique: true,
      fields: ['username']
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  }
};
