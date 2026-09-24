# 技术架构设计

| 项 | 内容 |
| --- | --- |
| 版本 | v1.0 |
| 编写角色 | 技术负责人 |
| 日期 | 2026-09-24 |
| 依赖 | `01-requirements/prd.md` v1.0、`00-management/decisions.md` |
| 状态 | 待用户评审 |

---

## 1. 架构总览

```text
┌─────────────────────┐      ┌──────────────────────┐
│  C 端 H5（手机网页） │      │  管理后台（PC 网页）  │
│  Vue 2 + Vant 2     │      │  Vue 2 + Element UI  │
│  免登录             │      │  需登录（JWT）        │
└──────────┬──────────┘      └───────────┬──────────┘
           │  HTTP / JSON（/api）        │
           └──────────────┬──────────────┘
                          ▼
              ┌───────────────────────┐
              │  后端服务 Node.js     │
              │  Express 4            │
              │  ├─ router            │
              │  ├─ controller        │
              │  ├─ service           │
              │  └─ model (Sequelize) │
              └───────┬───────┬───────┘
                      │       │
                      ▼       ▼
              ┌──────────┐  ┌──────────────┐
              │ MySQL 8  │  │ 本地文件存储 │
              │          │  │ uploads/ 图片 │
              └──────────┘  └──────────────┘
```

三个工程彼此独立，通过 HTTP 接口通信，可分别启动与部署。

---

## 2. 技术选型

### 2.1 后端

| 用途 | 选型 | 版本 | 说明 |
| --- | --- | --- | --- |
| 运行时 | Node.js | 18 LTS / 20 LTS | 本机需 ≥ 18 |
| Web 框架 | Express | 4.x | 用户指定 |
| 数据库 | MySQL | 8.x | 用户指定 |
| ORM | Sequelize + mysql2 | 6.x / 3.x | 纯 JS，无需额外二进制引擎，本机部署最省事 |
| 迁移工具 | sequelize-cli | 6.x | 表结构变更用 migration 管理 |
| 参数校验 | express-validator | 7.x | 统一校验入口参数 |
| 管理员鉴权 | jsonwebtoken + bcryptjs | 9.x / 2.x | JWT 放 `Authorization: Bearer` |
| 文件上传 | multer | 1.x | 内存暂存 → 校验 → 落盘 |
| 图片处理 | sharp（可选） | 0.33 | 生成缩略图；安装失败可降级为「原图直出」 |
| 跨域 | cors | 2.x | 开发环境允许前端域名 |
| 日志 | morgan + 自定义 logger | - | 请求日志 + 错误日志 |
| 配置 | dotenv | 16.x | 所有配置走 `.env` |

### 2.2 C 端（移动端 H5）

| 用途 | 选型 |
| --- | --- |
| 框架 | Vue 2.7 |
| UI | Vant 2.13 |
| 路由 | vue-router 3.6 |
| 状态 | Vuex 3.6（只管今日菜单） |
| 请求 | axios |
| 构建 | Vue CLI 5（webpack 5） |
| 本地持久化 | localStorage（`cooking:cart:v1`） |

> 选 Vue CLI 而非 Vite 的原因：Vant 2 / Element UI 2 与 webpack 生态兼容最成熟，减少按需引入和旧依赖的踩坑成本。

### 2.3 管理后台（PC Web）

| 用途 | 选型 |
| --- | --- |
| 框架 | Vue 2.7 |
| UI | Element UI 2.15 |
| 路由 / 状态 / 请求 | vue-router 3.6 / Vuex 3.6 / axios |
| 构建 | Vue CLI 5 |

---

## 3. 目录结构

```text
E:/AICode/cooking/
├─ 00-management/                 项目管理文档
├─ 01-requirements/               需求文档
├─ 02-design/                     技术设计文档
├─ 03-frontend/
│  ├─ mobile/                     C 端 H5（Vue 2 + Vant）
│  │  ├─ public/
│  │  └─ src/
│  │     ├─ api/                  dishes.js / menus.js / recommend.js / categories.js
│  │     ├─ assets/
│  │     ├─ components/           DishCard.vue / CategoryTabs.vue / CartBar.vue / EmptyState.vue
│  │     ├─ pages/                Home.vue / Dishes.vue / Cart.vue / History.vue / DishDetail.vue / SubmitSuccess.vue
│  │     ├─ router/
│  │     ├─ store/                cart.js（今日菜单，localStorage 持久化）
│  │     ├─ utils/                request.js / storage.js
│  │     ├─ App.vue
│  │     └─ main.js
│  └─ admin/                      管理后台（Vue 2 + Element UI）
│     └─ src/
│        ├─ api/
│        ├─ layouts/              BasicLayout.vue
│        ├─ pages/                Login.vue / Dashboard.vue / Dishes/  / Categories/ / Records/
│        ├─ components/           ImageUpload.vue / DishForm.vue
│        ├─ router/               （含路由守卫）
│        ├─ store/
│        └─ utils/request.js
├─ 04-backend/
│  └─ server/                     Express 服务
│     ├─ src/
│     │  ├─ config/               index.js（读 .env）/ database.js
│     │  ├─ models/               index.js / dish.js / category.js / ingredient.js / dishIngredient.js / menuRecord.js / menuItem.js / admin.js
│     │  ├─ migrations/
│     │  ├─ seeders/              种子数据（约 30 道家常菜）
│     │  ├─ services/             dishService / categoryService / menuService / recommendService / uploadService / adminService
│     │  ├─ controllers/
│     │  ├─ routes/               index.js / dishes.js / categories.js / menus.js / recommend.js / admin.js / upload.js
│     │  ├─ middlewares/          auth.js / errorHandler.js / validator.js / notFound.js
│     │  ├─ utils/                response.js / errors.js / logger.js / seedRandom.js
│     │  └─ app.js / server.js
│     ├─ uploads/                 图片存储（gitignore）
│     ├─ .env.example
│     └─ package.json
├─ 05-testing/                    测试用例、接口脚本、测试报告
├─ 06-devops/                     docker-compose.yml、启动脚本、部署文档、备份脚本
├─ 07-delivery/                   发布检查清单、交付说明
└─ PROJECT_RULES.md
```

---

## 4. 后端分层与职责

| 层 | 职责 | 禁止 |
| --- | --- | --- |
| route | 只做路由注册与中间件挂载 | 写业务逻辑 |
| controller | 取参数、调 service、组装响应 | 直接写 SQL / 直接操作 req,res 业务判断 |
| service | 业务规则（推荐算法、菜单创建、删除校验） | 处理 HTTP 细节 |
| model | 数据表定义与关联 | 写业务规则 |

统一响应中间件：`utils/response.js` 提供 `ok(res, data)` 与 `fail(res, code, message)`。

统一错误：`utils/errors.js` 定义 `AppError{ code, message, httpStatus }`，由 `errorHandler` 兜底，返回统一结构。

---

## 5. 关键技术方案

### 5.1 鉴权

- 只有后台接口需要鉴权，路径前缀 `/api/admin/*`（登录与上传除外：上传也需鉴权）。
- 登录成功返回 JWT，有效期 12 小时，前端存 `localStorage`，请求头 `Authorization: Bearer <token>`。
- 中间件 `auth.js` 校验 Token，失败返回 401（错误码 1001）。
- 初始管理员账号：首次启动时由 seeder 创建，账号密码从 `.env` 读取，**不得写入代码仓库**。
- 密码用 bcryptjs 加盐哈希存储，数据库永不明文。

### 5.2 文件上传

- 接口：`POST /api/admin/upload/image`，字段名 `file`，需鉴权。
- 校验：mime 白名单 `image/jpeg|image/png|image/webp`；大小 ≤ 5MB；前后端双重校验。
- 存储：写入 `04-backend/server/uploads/YYYY/MM/`，文件名用 `uuid + 扩展名`。
- 数据库只存相对路径 `/uploads/2026/09/xxx.jpg`，返回给前端的 `url` 由后端拼接 `STATIC_BASE_URL`（默认空，前端用同源地址）。便于后续切换对象存储。
- 缩略图：用 sharp 生成宽度 400px 的 `-thumb` 文件；sharp 安装失败时降级为直接使用原图，并在日志中提示。
- 静态访问：`app.use('/uploads', express.static(uploadDir))`。

### 5.3 推荐算法

`recommendService.recommend({ size = 4, excludeIds = [] })`：

1. 取候选池：`dishes` 中 `deleted_at IS NULL AND status = 1`；
2. 查最近 7 天 `menu_items` 中出现过的 `dish_id`，标记为「近期已吃」；
3. 优先池 = 候选池 − 近期已吃 − excludeIds；
4. 用**以日期为种子的伪随机**（`seedRandom(YYYY-MM-DD)`）打乱优先池，保证同一天首次结果稳定；
5. 分类分散：按 `category_id` 分组轮流取，同一分类最多 2 个；
6. 不足 4 个时，依次放宽：允许「近期已吃」→ 允许已展示 → 返回全部并附提示 `notice`；
7. 换一批：前端把本轮已展示的 id 通过 `exclude` 传入，后端排除后重算（种子换为 `日期 + 轮次`）。

### 5.4 今日菜单（点菜车）

- 纯前端状态，存 Vuex + localStorage，不落库，直到提交。
- 数据结构：`{ [dishId]: { dishId, name, coverUrl, quantity } }`。
- 提交时只传 `{ items: [{ dishId, quantity }] }`，后端重新查菜品做名称/图片快照，防止前端篡改。
- 提交成功后清空 localStorage。

### 5.5 错误处理与日志

- 统一响应：`{ code, message, data }`，`code = 0` 表示成功。
- 4xx：参数错误（1000）、未授权（1001）、资源不存在（2001）、资源冲突（2002）。
- 5xx：系统错误（5000），日志记录堆栈，响应只返回通用提示。
- 日志：请求日志（方法、路径、耗时、状态码）+ 错误日志（堆栈）。日志文件放 `04-backend/server/logs/`（gitignore）。

### 5.6 配置与环境变量

所有配置通过 `.env` 注入，模板见 `06-devops/.env.example`，**禁止提交真实 `.env`**。

---

## 6. 端口与本地联调

| 服务 | 端口 | 说明 |
| --- | --- | --- |
| 后端 server | 3000 | `/api/*`、`/uploads/*` |
| C 端 mobile（dev） | 8080 | devServer proxy `/api` → `http://localhost:3000` |
| 后台 admin（dev） | 8081 | devServer proxy `/api` → `http://localhost:3000` |
| MySQL | 3306 | Docker 映射 3307 避免与本机已装 MySQL 冲突 |

生产（单机）：后端 serve 两个前端的 `dist` 静态产物，或由 Nginx 转发；第一版先用 Node 静态托管 + 反向代理说明。

---

## 7. 部署方案（第一版）

1. **本机直接启动**：安装 Node 18+ 与 MySQL 8 → 建库 → 执行 migration + seed → `npm start`。
2. **Docker Compose**（`06-devops/docker-compose.yml`）：`mysql:8` + `server` 两个容器，挂载 `uploads` 与 `mysql-data` 卷，一条命令启动。
3. 备份：定时导出 SQL（`mysqldump`）+ 打包 `uploads` 目录，脚本放 `06-devops/backup.sh`。
4. 第一版 HTTP 访问，不做 HTTPS（后续上公网再补）。

---

## 8. 安全方案

| 项 | 措施 |
| --- | --- |
| 管理员密码 | bcryptjs 哈希，salt rounds = 10 |
| 接口鉴权 | JWT + Bearer，后台接口默认拦截 |
| 上传文件 | 类型白名单、大小限制、随机文件名、禁止执行权限 |
| SQL 注入 | 全部走 Sequelize 参数化查询，禁止字符串拼接 SQL |
| XSS | 前端渲染走 Vue 默认转义；富文本不使用（描述为纯文本） |
| 敏感信息 | `.env` 与 `uploads`、`logs` 全部 gitignore |
| 错误信息 | 生产环境不返回堆栈 |

---

## 9. 性能与容量

- 家庭场景数据量极小（菜品百级、菜单记录千级），无需缓存。
- 列表分页默认 20 条，数据库加索引（见数据库设计）。
- 图片列表用缩略图，详情用原图。
- 搜索用 `LIKE '%kw%'`（数据量小，够用）；若后续数据量大再引入全文索引。

---

## 10. 技术风险

| 编号 | 风险 | 应对 |
| --- | --- | --- |
| T-01 | sharp 在 Windows 安装失败 | 降级：不生成缩略图，列表直接用原图；用构建参数开关 |
| T-02 | 本机 3306 端口被占用 | Docker 映射 3307，或改 `.env` 的 `DB_PORT` |
| T-03 | Vue 2 生态依赖老旧，安装报 EBADENGINE | 固定 Node 18，安装时忽略可选依赖警告；优先用已验证版本组合 |
| T-04 | 前后端并行开发接口不一致 | 以 `api-design.md` 为准，后端先用 seed 数据自测，前端按文档 mock |
| T-05 | 图片目录与数据库不同步（文件残留） | 删除菜品只逻辑删除，图片保留；后续再加清理任务 |

---

## 11. 后续可扩展点（不在第一版）

- 对象存储替换本地磁盘（只需改 `uploadService`）
- 采购清单（按食材汇总）→ 需 `dish_ingredients.amount_note` 规范化
- 收藏、评分、做法步骤
- 多家庭成员账号与点菜归属
- 数据统计页（点菜频次排行）
