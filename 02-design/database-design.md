# 数据库设计

| 项 | 内容 |
| --- | --- |
| 版本 | v1.0 |
| 数据库 | MySQL 8.0 |
| 字符集 | `utf8mb4` / `utf8mb4_unicode_ci` |
| ORM | Sequelize 6（模型 + migration 管理） |
| 库名 | `cooking`（可通过 `.env` 的 `DB_NAME` 修改） |
| 日期 | 2026-09-24 |

---

## 1. 实体关系

```text
categories 1 ────< dishes >────< dish_ingredients >──── ingredients
                    │
                    │  (快照)
                    ▼
menu_records 1 ────< menu_items >──── dishes (可空，允许菜品被删)

admins（独立，后台登录用）
```

- 一个分类下有多个菜品；
- 菜品与食材是多对多，通过 `dish_ingredients` 关联；
- 一条菜单记录包含多个明细；明细保存菜品名称与图片快照，菜品删除后历史仍可读。

---

## 2. 表结构

### 2.1 categories（分类）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| name | VARCHAR(32) | NOT NULL, UNIQUE | 分类名，如 荤菜/素菜/汤/主食 |
| sort | INT | NOT NULL, DEFAULT 100 | 升序，越小越靠前 |
| status | TINYINT | NOT NULL, DEFAULT 1 | 1 启用，0 停用 |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | |

### 2.2 dishes（菜品）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| name | VARCHAR(64) | NOT NULL | 菜名，允许重名（新增时前端提示） |
| category_id | INT UNSIGNED | NULL, FK → categories.id | 分类删除后置 NULL（未分类） |
| cover_url | VARCHAR(255) | NULL | 相对路径，如 `/uploads/2026/09/xxx.jpg` |
| thumb_url | VARCHAR(255) | NULL | 缩略图相对路径，无缩略图时回退 cover_url |
| description | VARCHAR(500) | NULL | 一句话/一段描述 |
| spicy_level | TINYINT | NULL | 0 不辣 / 1 微辣 / 2 中辣 / 3 特辣 |
| cook_minutes | INT UNSIGNED | NULL | 预计烹饪时长（分钟） |
| status | TINYINT | NOT NULL, DEFAULT 1 | 1 上架，0 下架 |
| sort | INT | NOT NULL, DEFAULT 100 | 升序 |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | |
| deleted_at | DATETIME | NULL | 逻辑删除标记 |

索引：`idx_dishes_list (status, deleted_at, category_id, sort)`、`idx_dishes_name (name)`。

### 2.3 ingredients（食材）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INT UNSIGNED | PK | |
| name | VARCHAR(32) | NOT NULL, UNIQUE | 食材名，如 鸡蛋、西红柿 |
| created_at | DATETIME | NOT NULL | |

### 2.4 dish_ingredients（菜品-食材关联）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INT UNSIGNED | PK | |
| dish_id | INT UNSIGNED | NOT NULL, FK → dishes.id, ON DELETE CASCADE | |
| ingredient_id | INT UNSIGNED | NOT NULL, FK → ingredients.id | |
| amount_note | VARCHAR(50) | NULL | 用量说明，如「2 个」「适量」 |

唯一索引：`uk_dish_ingredient (dish_id, ingredient_id)`；索引：`idx_ingredient (ingredient_id)`。

### 2.5 menu_records（菜单记录）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INT UNSIGNED | PK | |
| meal_date | DATE | NOT NULL | 用餐日期，默认当天 |
| item_count | INT UNSIGNED | NOT NULL, DEFAULT 0 | 菜品份数合计 |
| remark | VARCHAR(200) | NULL | 备注（第一版前端可不传，预留） |
| created_at | DATETIME | NOT NULL | |

索引：`idx_menu_date (meal_date DESC)`。

### 2.6 menu_items（菜单明细）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INT UNSIGNED | PK | |
| record_id | INT UNSIGNED | NOT NULL, FK → menu_records.id, ON DELETE CASCADE | |
| dish_id | INT UNSIGNED | NULL | 菜品被删除后保留 id 但可能为 NULL |
| dish_name | VARCHAR(64) | NOT NULL | 菜名快照 |
| cover_url | VARCHAR(255) | NULL | 图片快照 |
| quantity | INT UNSIGNED | NOT NULL, DEFAULT 1 | 份数 |
| created_at | DATETIME | NOT NULL | |

索引：`idx_record (record_id)`、`idx_dish (dish_id)`（推荐算法查「最近 7 天吃过」用）。

### 2.7 admins（管理员）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | INT UNSIGNED | PK | |
| username | VARCHAR(32) | NOT NULL, UNIQUE | |
| password_hash | VARCHAR(128) | NOT NULL | bcryptjs 哈希 |
| created_at | DATETIME | NOT NULL | |
| last_login_at | DATETIME | NULL | |

---

## 3. 建表 SQL（初始 migration 参考）

```sql
CREATE TABLE categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(32) NOT NULL,
  sort INT NOT NULL DEFAULT 100,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_category_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dishes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL,
  category_id INT UNSIGNED NULL,
  cover_url VARCHAR(255) NULL,
  thumb_url VARCHAR(255) NULL,
  description VARCHAR(500) NULL,
  spicy_level TINYINT NULL,
  cook_minutes INT UNSIGNED NULL,
  status TINYINT NOT NULL DEFAULT 1,
  sort INT NOT NULL DEFAULT 100,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_dishes_list (status, deleted_at, category_id, sort),
  KEY idx_dishes_name (name),
  CONSTRAINT fk_dish_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ingredients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_ingredient_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dish_ingredients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  dish_id INT UNSIGNED NOT NULL,
  ingredient_id INT UNSIGNED NOT NULL,
  amount_note VARCHAR(50) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_dish_ingredient (dish_id, ingredient_id),
  KEY idx_ingredient (ingredient_id),
  CONSTRAINT fk_di_dish FOREIGN KEY (dish_id) REFERENCES dishes (id) ON DELETE CASCADE,
  CONSTRAINT fk_di_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE menu_records (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  meal_date DATE NOT NULL,
  item_count INT UNSIGNED NOT NULL DEFAULT 0,
  remark VARCHAR(200) NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_menu_date (meal_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE menu_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  record_id INT UNSIGNED NOT NULL,
  dish_id INT UNSIGNED NULL,
  dish_name VARCHAR(64) NOT NULL,
  cover_url VARCHAR(255) NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_record (record_id),
  KEY idx_dish (dish_id),
  CONSTRAINT fk_item_record FOREIGN KEY (record_id) REFERENCES menu_records (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admins (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(32) NOT NULL,
  password_hash VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL,
  last_login_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_admin_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> 实际建表由 `sequelize-cli` migration 执行，以上 SQL 为结构与索引的权威说明；若两者不一致，以本文档为准并修正 migration。

---

## 4. Sequelize 模型要点

| 模型 | 关键点 |
| --- | --- |
| Dish | `paranoid: false`（自己用 `deleted_at` 控制）；默认 scope 排除 `deleted_at IS NOT NULL`；关联 Category（belongsTo）、Ingredient（belongsToMany through DishIngredient） |
| Category | 删除分类时把其下菜品 `category_id` 置 NULL（用 `ON DELETE SET NULL` + 服务层提示） |
| Ingredient | 名称唯一 |
| DishIngredient | 复合唯一 |
| MenuRecord | hasMany MenuItem |
| MenuItem | 保存快照字段，不与 Dish 做强外键约束（`dish_id` 允许 NULL 且不加外键，避免菜品删除受限） |
| Admin | `password_hash` 字段不出现在任何查询返回中（模型 `defaultScope` 排除） |

时间字段统一用 Sequelize 的 `timestamps: true`，`createdAt = created_at`、`updatedAt = updated_at`；`deleted_at` 非 Sequelize paranoid 字段，需手写条件。

---

## 5. 初始数据（seeders）

| 类型 | 内容 |
| --- | --- |
| 分类 | 荤菜、素菜、汤羹、主食（4 个，可后续扩展） |
| 菜品 | 约 30 道常见家常菜（番茄炒蛋、红烧肉、清炒时蔬、紫菜蛋花汤…），含描述、食材、辣度、时长；图片留空，前端用占位图 |
| 管理员 | 从 `.env` 读取 `ADMIN_DEFAULT_USERNAME` / `ADMIN_DEFAULT_PASSWORD`，不存在则创建；默认仅用于首次登录，登录后建议改密码 |
| 菜单记录 | 不预置（历史由实际使用产生） |

---

## 6. 迁移与版本约定

1. 表结构变更必须新增 migration，禁止手工改库后不补文件；
2. migration 文件名格式：`YYYYMMDDHHMMSS-描述.js`；
3. 每次迁移前后需确认可回滚（`down` 必须实现）；
4. `uploads`、`logs` 不入数据库，只存路径。

---

## 7. 数据量与性能说明

- 家庭使用规模：菜品 ≤ 几百条，菜单记录 ≤ 几千条/年，无需分表与缓存；
- 搜索 `LIKE '%kw%'` 在千级数据下无性能问题；
- 推荐算法查询「最近 7 天已点菜品」依赖 `menu_items.dish_id` 索引与 `menu_records.meal_date` 索引。
