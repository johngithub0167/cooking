# 后端状态记录

> 用途：并行开发时后端会话只改本文件，避免多个会话同时改 `task-board.md` 造成覆盖。
> 阶段结束后由项目负责人合并进 `00-management/task-board.md` 与 `progress.md`。

## 当前任务

BE-003 已完成（等待用户验证）；BE-001~003 全部完成，等待进入 BE-004（管理员鉴权）或按你的安排继续。

## 已完成接口

| 任务编号 | 接口 | 状态 | 验证结果 |
| --- | --- | --- | --- |
| BE-001 | GET /api/health | 已完成 | `{"code":0,"message":"ok","data":{"status":"ok","db":"up","dbLatencyMs":5,...}}`（HTTP 200） |

> 说明：本文件原先把 `/api/health` 记在 BE-003 下；按本次任务拆分（BE-001 骨架含健康检查）归属 BE-001。

## 阻塞与待确认

- 无阻塞。
- 待确认（已在 BE-001 开工前提出，用户未逐条回复，按方案默认执行）：
  1. BE-001 只装 `express/sequelize/mysql2/dotenv/cors/morgan` + dev(`nodemon/sequelize-cli`)；`express-validator/jsonwebtoken/bcryptjs/multer` 留到 BE-004/010/012。
  2. 不新建 `04-backend/server/.env.example`，模板唯一来源仍是 `06-devops/.env.example`。
  3. `/api/health` 未在 api-design.md 的 15 个业务接口内，DB 不可用时返回 **HTTP 500 + code 5000**（按错误码表 5000→500，不用 503）。
  4. `04-backend/server/.env` 由 `06-devops/.env` 直接复制得到，未重新生成口令（避免与容器数据卷账号不匹配）。
  5. BE-002 计划跑一次 `migrate → undo → migrate` 验证 `down` 可用（当前库为空开发库）。

## 交付记录

### BE-001 初始化后端工程骨架（2026-09-25）

```text
日期：2026-09-25
任务编号：BE-001
完成内容：
  - 04-backend/server 工程初始化：package.json（scripts: dev/start/migrate/migrate:undo/migrate:status/seed）
  - 配置读取（src/config/index.js，dotenv + 必填校验，无任何硬编码口令/端口/密钥）
  - 数据库连接（src/config/database.js，Sequelize 6 + mysql2，连接池、utf8mb4、东八区、underscored）
  - 统一响应（src/utils/response.js：ok/created/fail/paginate，结构 {code,message,data}）
  - 统一错误（src/utils/errors.js：AppError + 9 个错误码，对齐 api-design 1.2）
  - 请求日志（src/middlewares/requestLogger.js，morgan 接入 logger，健康检查默认不打）
  - 应用日志（src/utils/logger.js，按天写 logs/app-<日期>.log）
  - GET /api/health（route → controller → service 分层，真实探活 SELECT 1）
  - 404 与错误兜底中间件、优雅退出（SIGINT/SIGTERM）
修改/新增文件：
  04-backend/server/package.json、.sequelizerc、
  src/config/{index,database,sequelize-cli}.js、
  src/utils/{response,errors,logger}.js、
  src/middlewares/{requestLogger,notFound,errorHandler}.js、
  src/services/healthService.js、src/controllers/healthController.js、
  src/routes/{index,health}.js、src/app.js、src/server.js、
  uploads/.gitkeep、logs/.gitkeep、.env（复制自 06-devops/.env，已 gitignore）
验证方式：
  npm install → node src/server.js → curl http://localhost:3000/api/health
  curl -i http://localhost:3000/api/xxx（404 分支）
  node -e 覆盖 DB_PORT=3399 调用 healthService.check()（DB 不可用分支）
验证结果：
  - 健康检查 HTTP 200：code=0，db=up，dbLatencyMs=3~5ms
  - 404：HTTP 404，{"code":2001,"message":"接口不存在：GET /api/xxx","data":null}
  - DB 不可用：{"status":"error","db":"down","dbError":"connect ECONNREFUSED 127.0.0.1:3399"} → 控制器映射为 HTTP 500 + code 5000
  - 依赖版本：express 4.22.3 / sequelize 6.37.8 / mysql2 3.24.4 / dotenv 16.6.1 / cors 2.8.6 / morgan 1.12.1 / sequelize-cli 6.6.5 / nodemon 3.1.14
  - logs/app-2026-09-25.log 正常落盘（984 字节）
未解决问题 / 待确认：
  - 见上方「阻塞与待确认」5 条
建议下一步：
  BE-002：按 database-design.md 写 7 张表 migration 并执行建表（含 down 回滚验证）
```

### BE-002 七张表 migration 与建表（2026-09-25）

```text
日期：2026-09-25
任务编号：BE-002
完成内容：
  - 7 个 migration 文件（按外键依赖顺序）：
    categories → dishes → ingredients → dish_ingredients → menu_records → menu_items → admins
  - 每个 migration 都实现 down（dropTable）
  - 表选项统一：ENGINE=InnoDB / CHARSET=utf8mb4 / COLLATE=utf8mb4_unicode_ci / timestamps:false
    （时间列由 migration 显式建 created_at / updated_at，避免 Sequelize 再自动加一组 camelCase 列）
修改/新增文件：
  src/migrations/20260925010000-create-categories.js
  src/migrations/20260925010100-create-dishes.js
  src/migrations/20260925010200-create-ingredients.js
  src/migrations/20260925010300-create-dish-ingredients.js
  src/migrations/20260925010400-create-menu-records.js
  src/migrations/20260925010500-create-menu-items.js
  src/migrations/20260925010600-create-admins.js
验证方式：
  npx sequelize-cli db:migrate / db:migrate:status / db:migrate:undo:all → 再 db:migrate
  information_schema 核对列名、类型、可空、默认值、索引、外键
  真实数据演练外键行为（写完即清理）
验证结果：
  - 7 张业务表 + SequelizeMeta，migrate:status 全部 up，退出码 0
  - 列结构逐项与 database-design.md §2 一致（含 ingredients / menu_records 无 updated_at）
  - 索引全部命中：uk_category_name、uk_ingredient_name、uk_admin_username（唯一）、
    idx_dishes_list(status,deleted_at,category_id,sort)、idx_dishes_name、uk_dish_ingredient、
    idx_ingredient、idx_menu_date、idx_record、idx_dish
  - 外键 4 个，名称与规则与文档一致：fk_dish_category(SET NULL)、fk_di_dish(CASCADE)、
    fk_di_ingredient(CASCADE)、fk_item_record(CASCADE)；menu_items.dish_id 未加外键（历史可读）
  - 7 张表 collation 均为 utf8mb4_unicode_ci
  - 行为演练：删分类→dish.category_id 置 NULL；删菜单记录→menu_items 级联删除；
    删菜品→dish_ingredients 级联删除且 menu_items 快照保留；用完已清理（残留 0 行）
  - down 验证：db:migrate:undo:all 逆序成功，库回到只剩 SequelizeMeta；随后重新 migrate 建回 7 张表
  - 建表后 /api/health 仍为 code=0 / db=up
未解决问题 / 待确认：
  - created_at / updated_at 为 NOT NULL 且无默认值（与文档一致）：裸 SQL 插入必须显式给值，
    Sequelize 模型（timestamps:true）会自动填充，BE-010 起由模型层写入，不影响使用。
  - 模型文件（src/models/*）尚未创建，属 BE-010 起随业务任务逐个补充；本次只建表。
建议下一步：
  BE-003：核对统一错误码与 api-design.md 第 1.2 节一致（0/1000/1001/1002/2001/2002/3001/3002/5000）
```

### BE-003 统一错误码与文档一致性核对（2026-09-25）

```text
日期：2026-09-25
任务编号：BE-003
完成内容：
  - 核对 src/utils/errors.js 的 9 个错误码与 api-design.md 第 1.2 节逐行一致，无多余、无缺失
  - 新增自检脚本 scripts/verify-error-codes.js + npm run verify:errors：
    起临时 Express（端口 3999，不占 3000）用真实 HTTP 请求逐个验证
    「错误码 → HTTP 状态 → 响应结构」，覆盖 13 类异常 + 404 兜底，支持 development / production 两种模式
修改/新增文件：
  scripts/verify-error-codes.js（新增）
  package.json（新增 verify:errors 脚本）
  src/utils/errors.js / src/middlewares/errorHandler.js（BE-001 已建，本任务核对未发现不一致，未改动）
验证方式：
  node scripts/verify-error-codes.js                      # development
  NODE_ENV=production node scripts/verify-error-codes.js  # production（额外校验不泄漏原始错误信息）
验证结果：
  - 错误码集合与文档完全一致（9 个：0/1000/1001/1002/2001/2002/3001/3002/5000）
    0→200、1000→400、1001→401、1002→403、2001→404、2002→409、3001→400、3002→400、5000→500
  - development 14/14 PASS，production 14/14 PASS，退出码均为 0
  - 覆盖场景：8 个 AppError 工厂方法、Sequelize 唯一约束(2002/409)、校验失败(1000/400)、
    外键约束(1000/400)、连接失败(5000/500)、未知异常(5000/500)、未匹配路径(2001/404)
  - 响应结构恒为 {code,message,data}（脚本逐条断言 key 集合）
  - 生产模式未知异常响应：{"code":5000,"message":"服务器内部错误","data":null}，
    堆栈只进日志不进响应体，无信息泄漏
未解决问题 / 待确认：
  - scripts/ 目录是架构 §3 里没有的（为可重复自检新增）。若你不希望后端出现该目录，
    可改为临时文件随跑随删，或挪到 05-testing/（需项目负责人确认归属）。
  - 1002（无权限）当前无使用方（BE-004 的 auth 中间件只用 1001），保留待用。
建议下一步：
  BE-004 管理员鉴权（登录、Token、中间件）；或按你的安排先补 src/models/* 模型定义
```
