# 项目进度

## 2026-11-25

### ARCH-005 技术方案卡点关闭

- 技术方案 v1.0（架构 / 7 张表结构 / 15 个接口字段 / 环境变量模板）自 2026-09-24 产出后，实现已全程按此执行，未改动任何已冻结字段。
- 用户确认按既定方案继续执行，ARCH-005「用户评审并冻结技术方案」标记为**已完成**，`02-design/technical-architecture.md` 状态同步更新为「已确认冻结」。
- 当前阶段：工程初始化完成；后端业务接口 BE-010~015、C 端 FE-010~017、后台 AD-010~016、测试与交付尚未开始。
- 代码已在 2026-09-25 全部提交（最近提交 `61288b6 update`，15 个文件），工作区干净。

### BE-010 分类接口 + AD-012 分类管理页（2026-11-25 完成并验证）

- BE-010：补 `src/models/category.js` 与 `src/models/index.js`（统一加载入口），实现 C 端 `GET /api/categories`（仅启用、按 sort 升序）与后台 `/api/admin/categories` 的 GET/POST/PUT/DELETE（JWT 鉴权、名称唯一 2002、删除返回 affectedDishes）。
- AD-012：`03-frontend/admin/src/pages/Categories.vue` + `src/api/categories.js`，列表（含加载失败重试/空状态）、新增/编辑弹窗、删除二次确认与影响提示。
- 用户已在浏览器验证：C 端裸开 `GET /api/categories` 返回 4 个分类（HTTP 200），后台登录后增删改查全链路无问题。
- 任务板 BE-010、AD-012 均标记已完成。

### 下一步

### BE-011 菜品接口 + AD-013/014 菜品管理页（2026-11-25 完成并验证）

- BE-011：补 `dish.js` / `ingredient.js` / `dishIngredient.js` 模型并追加 `models/index.js` 导出，新增 `adminDishes.js` / `adminIngredients.js` 路由 + controller/service；实现后台菜品增删改查、上下架、分页筛选（分类/状态/关键词）、`includeDeleted`，食材联想（≤20 条），新增菜品时不存在食材自动创建。
- 工作区曾因后端 agent 误判"Docker/数据库未启动"卡住，复核确认容器 `cooking-mysql` healthy、3307/3000 正常，`/api/health` 返回 `db=up`，已回复提示词让其继续。
- 发现代码未实现文档约定的 `page`/`pageSize` 默认值（不传报 500 `NaN`），已在 AD-013 提示词中要求前端显式传参，属可接受的已知缺口，未改后端。
- 查询类接口已由 WorkBuddy 用真实登录 Token 验证通过：列表 30 条、分类筛选 8 条、状态筛选、关键词"鸡蛋" 7 条、详情含 2 食材、食材联想"蛋"→鸡蛋。
- AD-013/014：`Dishes.vue` + `api/dishes.js`，列表（分页/分类/状态/关键词筛选、上下架、删除二次确认）+ 新增/编辑弹窗（含食材联想与手输新名），用户已在浏览器验证增删改查全链路无问题。
- 任务板 BE-011、AD-013、AD-014 均标记已完成。

### 下一步

1. 后端 BE-012 图片上传接口（独立依赖 BE-001，可先做）或 BE-013 菜品查询接口（C 端数据依赖，做完后才能动 FE-010~013）。
2. 之后依次推进 BE-014/015 → C 端 FE-010~017 / 后台 AD-015/016 → TEST-001~006 → DELIVERY-001。

## 2026-09-25

### 运维收口（OPS-010 / 011 / 012 / 013 完成）

| 编号 | 交付物 | 验证方式与结果 |
| --- | --- | --- |
| OPS-010 | `06-devops/deploy.md` | 首次上手三步（`npm run env:init` → `npm run db:image` → `npm run dev`）；方案 A 容器 / 方案 B 本机 MySQL 8；3306 冲突改 3307；改口令后卷重建办法；故障表 |
| OPS-011 | `06-devops/backup-restore.md` + `backup.ps1` / `restore.ps1` / **`backup-drill.ps1`** | `npm run db:drill` 一键演练，**本机实测 PASS**：样本 `恢复演练-中文ABC123`，备份前后 `HEX()` 完全一致（`E681A2…313233`），退出码 0 |
| OPS-012 | `07-delivery/release-checklist.md` | 9 节清单；安全项为硬性；发布前必须跑 `npm run db:drill`；含回滚记录表 |
| OPS-013 | `06-devops/rollback.md` | 代码 / 数据 / 环境三条回滚路径 + 决策表 + 耗时与丢数据评估 |

**本次新产出**：`06-devops/scripts/backup-drill.ps1`（npm 入口 `npm run db:drill`），把「备份 → 删表 → 恢复 → 字节比对 → 清理」固化成一条命令，避免恢复方案只在纸面上成立。

**演练中修掉的 3 个真实缺陷**（已写入 `backup-restore.md` §4.3，写新脚本时照抄规避）：

1. 双引号里写 `"$dbName.$DrillTbl"` 会被 PowerShell 当成**属性访问**（→ `$null`），SQL 实际变成 `FROM  WHERE ...`；改成 `${dbName}.${DrillTbl}`。
2. `$rows = 函数` 且函数只输出一行时拿到的是**标量字符串**，`$rows[0]` 取的是首字符而非首行；一律用 `@()` 包住。
3. `docker exec` 未分配 TTY 时容器内 stderr 会并进 stdout，SQL 报错**不体现在退出码**里；调用后需检查输出是否含 `^ERROR `（脚本内已实现）。

**脚本健康度**：`npm run ops:check` → 11/11 通过（UTF-8 BOM + CRLF + 语法 0 错误）。

### 当前状态（2026-09-25）

- 运维侧（OPS-001~004、010~013）**全部完成**，可在 Windows 上一键拉起整套服务（后端 3000 + MySQL 容器 3307）。
- 仓库已 `git init`（`main`）并完成**首次提交 `9e31ba4`**（48 个文件）；`git status` 干净，`git ls-files` 复查无 `.env` / `node_modules` / `uploads` / `logs` / `backups` 入库。远端未关联，需要时自行 `git remote add origin <地址>` + `git push -u origin main`（脚本不代劳）。
- ~~技术方案（ARCH-005）仍待用户评审~~（已于 2026-11-25 确认冻结并关闭，见文首记录）；BE-001~003 已完成，FE-001/FE-002 已开发并通过用户验收；已安装 NVM for Windows 并切换 Node 20.19.5 LTS，FE-001/FE-002 生产构建复测通过。后端 Dockerfile 落地后可启用 `docker-compose.yml` 的 `full` profile。

### FE-001 C 端工程初始化（已验收）

| 项目 | 结果 |
| --- | --- |
| 工程 | `03-frontend/mobile`：Vue CLI 5 + Vue 2.7 + Vant 2 + vue-router 3 + Vuex 3 + axios |
| 开发服务 | `8080`，`/api` 代理到 `http://localhost:3000` |
| 基础能力 | 四路由 Tabbar（首页 / 总菜单 / 今日菜单 / 历史）、统一请求封装、今日菜单 Vuex + `cooking:cart:v1` localStorage |
| 验证 | `npm install` 成功；`npm run build` 退出码 0；开发服务器 `http://localhost:8080/` 返回 HTTP 200 |
| 范围边界 | 未实现具体业务页面、未使用 mock 数据；业务页面留给 FE-010~FE-017 |

### FE-002 后台工程初始化（已验收）

| 项目 | 结果 |
| --- | --- |
| 工程 | `03-frontend/admin`：Vue CLI 5 + Vue 2.7 + Element UI 2 + vue-router 3 + Vuex 3 + axios |
| 开发服务 | `8081`，`/api` 代理到 `http://localhost:3000` |
| 基础能力 | 登录/布局/首页/菜品/分类/记录路由骨架、侧边导航、Token 请求封装、1001 清 Token 跳登录、Vuex 鉴权状态 |
| 验证 | `npm install` 成功；`npm run serve -- --port 8081` 返回 HTTP 200；开发编译通过（无业务错误） |
| 验证 | 在 Node 20.19.5 LTS 下 `npm run build` 退出码 0；此前 Node 21.7.3 的 `Fatal process out of memory: Zone` 已不再复现。仅有 Webpack 体积/性能建议警告，不阻塞构建 |
| 范围边界 | 未实现登录接口、菜品/分类/上传/记录业务，分别留给 AD-010、AD-012~016 |

### Node 版本切换与前端构建复测（2026-09-25）

| 项目 | 结果 |
| --- | --- |
| NVM | 已安装 nvm-windows 1.2.1；`nvm current` = `v20.19.5` |
| Node/npm | Node `v20.19.5` / npm `10.8.2`；Node 20 为当前项目默认运行版本 |
| C 端构建 | `03-frontend/mobile` 执行 `npm run build`，退出码 0 |
| 后台构建 | `03-frontend/admin` 执行 `npm run build`，退出码 0 |
| 原问题 | Node 21.7.3 下的 `Fatal process out of memory: Zone` 已消失；当前仅保留 Webpack 体积/性能建议警告 |
| 切换命令 | `nvm list`、`nvm use 20.19.5`、`nvm current` |

### BE-016 种子数据与 BE-004 管理员鉴权（2026-09-25）

| 任务 | 结果 |
| --- | --- |
| BE-016 | `npm run seed` 成功；4 个分类、30 道菜、43 种食材、65 条关联、1 个管理员，菜单记录 0 条 |
| BE-004 | `POST /api/admin/login` 登录成功；`GET /api/admin/profile` JWT 验证成功；无 Token 返回 HTTP 401 / code 1001 |
| 依赖 | 新增 bcryptjs、express-validator、jsonwebtoken；敏感配置仍从 `.env` 读取 |

### 下一步

1. 后端接口 BE-010~015 → C 端页面 FE-010~017 / 后台页面 AD-010~016；
2. 测试 TEST-001~006 → 交付 DELIVERY-001。

## 2026-09-24

### 已完成

- 创建项目协作目录：`00-management` ~ `07-delivery`、`docs`、`.workbuddy`。
- 确认项目方向：家庭点菜小程序（C 端点菜 + 后台菜品管理）。
- 确认技术栈：C 端 Vue 2 + Vant，后台 Vue 2 + Element UI，后端 Node.js，需要数据库。
- 产出需求文档：
  - `00-management/project-charter.md`（项目目标、角色、MVP 范围）
  - `01-requirements/prd.md`（完整 PRD v0.1）
  - `01-requirements/user-stories.md`（21 条用户故事）
  - `01-requirements/acceptance-criteria.md`（60+ 条验收标准）
  - `00-management/open-questions.md`（13 项待确认）
  - `00-management/task-board.md`（8 个阶段、40+ 任务）
  - `00-management/decisions.md`（决策记录）

### 当前状态（2026-09-24 更新）

**需求已冻结为 PRD v1.0，技术设计 v1.0 已产出，等待用户评审。**

用户已答复：

1. C 端为**移动端 H5 网页**（非微信小程序原生）；
2. **C 端免登录**，后台需登录；
3. 后端 **Express + MySQL**；
4. 推荐 **4 个菜**；
5. 推荐不满意时可在**总菜单**里按分类/关键词筛选，自行加入或删除。

新增产出：

- `02-design/technical-architecture.md`（架构、选型、目录、部署、安全）
- `02-design/database-design.md`（7 张表结构 + 建表 SQL + 索引）
- `02-design/api-design.md`（15 个接口，字段冻结）
- `06-devops/.env.example`（环境变量模板）

### 下一步

1. **用户评审技术方案**（架构 / 表结构 / 接口），确认后冻结；
2. 工程初始化：OPS-001~004（Git、环境变量、启动脚本、Docker Compose）、BE-001~004、FE-001~003；
3. 后端接口开发 BE-010 ~ BE-016；
4. C 端页面 FE-010 ~ FE-017（含总菜单页 FE-011）；
5. 后台页面 AD-010 ~ AD-016；
6. 测试 TEST-001 ~ TEST-006 → 交付 DELIVERY-001。

### CodeBuddy 协作环境（2026-09-24 配置）

为后续在 CodeBuddy 中开发，已创建：

- `CODEBUDDY.md`（项目记忆，启动时自动加载）
- `.codebuddy/rules/backend-rules.md`、`.codebuddy/rules/frontend-rules.md`
- `.codebuddy/agents/`：backend-developer、frontend-developer、tester、devops
- `docs/codebuddy-guide.md`（操作说明与指令模板）
- `docs/agent-workflow.md`（两种工作模式、任务闭环、交接规则、验收关卡）
- 工作模式澄清：模式 1 = 一个对话 + manual 切换角色（换角色前 `/clear`），模式 2 = 多对话并行（不同工程才能并行）。推荐先模式 1。
- `00-management/status/backend-status.md`、`frontend-status.md`（并行开发时的角色状态文件）

### 运维工程初始化 OPS-001~003（2026-09-24 完成）

**已完成产出**

| 文件 | 说明 |
| --- | --- |
| `.gitignore` | 忽略 `node_modules/`、`.env`(`.env.*.local`)、`uploads/*`、`logs/*`、`dist/`、`build/`、`mysql-data/`、`.vscode/`、`.idea/`；保留 `.gitkeep` 与 `.env.example` |
| `.gitattributes` | 统一换行符：`*.ps1/*.cmd/*.bat` 强制 CRLF，`*.sh` 强制 LF，二进制不转换 |
| `06-devops/.env.example` | 8 组变量逐项说明（用途 / 是否必填 / 默认值 / 注意事项）+ 上线前安全自检清单；作为唯一模板来源 |
| `06-devops/scripts/git-init.ps1` | Git 初始化 + 敏感文件体检（命中即自动 `git reset` 并退出）+ `.gitignore` 规则校验；不修改 git 配置、不自动 push |
| `06-devops/scripts/start-dev.ps1` | 一键启动：环境体检 → 生成 `.env` →（可选）Docker MySQL → `npm install` → 启动后端新窗口 → `/api/health` 轮询就绪 →（可选）8080/8081 前端 |
| `06-devops/scripts/start-dev.cmd` | 双击入口，自动绕过 PowerShell 执行策略 |
| `06-devops/scripts/stop-dev.ps1` | 按端口 3000/8080/8081 停止服务，自动跳过系统进程（PID ≤ 4、System、svchost 等） |
| `06-devops/README.md` | 运维说明：目录、端口、首次上手、脚本参数、环境变量、常见问题、待办 |

**验证结果（本机实测）**

- 三个 PowerShell 脚本：语法解析 0 错误（已统一为 UTF-8 **带 BOM** + CRLF，避免 PS 5.1 按 GBK 解码导致乱码/解析失败）。
- `Get-EnvValue` 从模板正确读出 `SERVER_PORT=3000`、`DB_PORT=3306`，未定义键返回空。
- `Test-HasScript`：dev=True / serve=False / 无 package.json=False。
- `Start-Project` 在目标目录未初始化时告警并返回 False，不会误开窗口。
- 已修复两个真实缺陷：脚本读取 `.env` 未指定 `-Encoding UTF8`（PS 5.1 下取不到值）；`stop-dev.ps1` 误用只读自动变量 `$PID`（改为 `$procId`）。

**待办（当时未做，已于 2026-09-24~25 补齐）**：OPS-004 `docker-compose.yml`、OPS-010 部署文档、OPS-011 备份恢复（含自动化演练脚本）、OPS-012 发布检查清单、OPS-013 回滚方案。

### 遗留问题

- ~~**本机未安装 Git**~~ → 已解决：Git 2.30.2 装在 `E:\software\Git`（未进 PATH，脚本自动探测）；仓库已 init 并完成首次提交 `9e31ba4`。
- ~~**本机未安装 MySQL**~~ → 已解决：Docker 容器 `cooking-mysql`（MySQL 8）已 healthy，宿主 3307 → 容器 3306。
- Node 实测 **v21.7.3**，架构要求 18/20 LTS（风险 T-03）；脚本仅告警不阻断，遇 `ERR_OSSL_EVP_UNSUPPORTED` 加 `-LegacyOpenSsl`。admin 生产构建已受本机 Node 内存异常影响，建议统一到 Node 18/20 LTS。
- sharp（图片缩略图）在 Windows 上可能安装失败，已设计降级方案。
- ~~ARCH-005（技术方案评审）未正式签字，但实际已按方案开工，建议补一次快速确认或直接关闭该卡点。~~ **已于 2026-11-25 解决（D-017，卡点关闭）。**

## 2026-09-25 工程初始化完成（Gate 1）

已完成并通过验证：OPS-001~004、OPS-010~013、BE-001~003、FE-001、FE-002。

- Git：6 次提交，工作区干净；`.gitignore` 覆盖 `.env` / `node_modules` / `**/uploads/*` / `**/logs/*` / `06-devops/backups/`。
- 后端：`04-backend/server` 完成 Express 4 + Sequelize 6 + mysql2 骨架，7 张表 migration 已执行，统一响应/错误码/日志就绪，`GET /api/health` 验证返回 `db=up`。
- C 端：`03-frontend/mobile`（Vue 2.7 + Vant 2 + router + vuex + axios）骨架完成并 `dist` 构建成功。
- 后台：`03-frontend/admin`（Vue 2.7 + Element UI 2）骨架完成，8081 开发服务验证通过。

### 已识别缺口（下一步必须补）

1. **缺 `src/models/`（Sequelize 模型）** —— 目前只有 migration，业务接口 BE-010+ 需要模型层，需在 BE-004 或之前补齐。
2. **缺 seeders（BE-016 种子数据）** —— 表已建好，随时可跑；建议优先做，前端联调才有真实数据。
3. `progress.md` 历史遗留描述已过时，本段为最新结论。
