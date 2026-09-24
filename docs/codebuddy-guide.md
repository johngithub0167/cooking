# CodeBuddy 使用说明（cooking 项目）

> 面向：项目负责人（你）。目标：让你知道在 CodeBuddy 里怎么下达指令、Agent 怎么读到这些文档。
> 最后更新：2026-09-24

---

## 1. 第一步：用 CodeBuddy 打开正确的目录

**必须把 `E:\AICode\cooking` 作为工作区根目录打开**，不要打开 `E:\AICode`，也不要打开子目录。

原因：CodeBuddy 启动时会从当前目录往上找 `CODEBUDDY.md` 自动加载。只要打开对了目录，所有 Agent 就会自动获得：项目背景、技术选型、目录地图、强制规则。

验证方式：在 CodeBuddy 里输入 `/memory`，能看到本项目的记忆文件列表，其中应包含 `CODEBUDDY.md`。

---

## 2. 已经帮你准备好的东西

| 文件 | 作用 |
| --- | --- |
| `CODEBUDDY.md` | 项目记忆，启动时**自动加载**，所有会话共享 |
| `.codebuddy/rules/backend-rules.md` | 后端规则，自动加载 |
| `.codebuddy/rules/frontend-rules.md` | 前端规则，自动加载 |
| `.codebuddy/agents/backend-developer.md` | 后端 Agent 角色定义 |
| `.codebuddy/agents/frontend-developer.md` | 前端 Agent 角色定义 |
| `.codebuddy/agents/tester.md` | 测试 Agent 角色定义 |
| `.codebuddy/agents/devops.md` | 运维 Agent 角色定义 |

**要不要自己再建 Agent？** 已经建好了，不用再建。如果你想在 CodeBuddy 界面里改，路径是：设置 → Agent Tab → 选 Project → Create Agent（或直接编辑上面这几个 `.md` 文件）。

---

## 3. 到底开几个对话？（两种模式，都能用）

> 前面说的「一个对话切角色」和「开多个对话」**都对，是两种不同的工作模式**，按阶段选就行。

### 模式 1：一个对话 + 切换角色（**推荐你先用这个**）

- 操作：在同一个会话里，用界面的 **Agent 选择框**切换角色（manual 模式）；
- **换角色前先执行 `/clear` 清空会话历史**，避免后端代码和前端代码混在同一个上下文里「串味」；
- 优点：简单、不会互相覆盖文件、出问题好排查；
- 缺点：**只能串行**，一次干一件事；
- 适合：项目初期、还在熟悉流程的时候。

### 模式 2：多个对话，一个对话一个角色（想快一点时用）

- 操作：新建会话 → 每个会话各选一个角色 → 同时推进；
- 优点：后端写接口的同时前端能搭页面，省时间；
- 缺点：上下文不共享（靠 `CODEBUDDY.md` 自动加载补上），且**绝不能同时改同一个文件**；
- 前提：只有不同工程（后端 / 前端）才能并行；同一工程绝不开两个对话。

### 模式 3：agentic 自动派活（**本项目暂时别用**）

主 Agent 自己判断该调哪个子代理。省事，但**调用过程中不能中途打断**，跑偏了不好拉回来。熟悉之后再说。

### 本项目建议

```text
第一阶段（初始化 + 后端接口）：模式 1，一个对话串行推进
第二阶段（前端页面）：可以另开前端对话并行，也可以继续串行
测试阶段：单独开 tester 对话
```

## 3.1 怎么下达指令（三种写法）

### 写法 A：选好角色后直接说任务

1. 会话界面的 **Agent 选择框**里选 `backend-developer` 或 `frontend-developer`；
2. 直接输入任务，例如：

```text
任务：BE-001 初始化 Express 后端工程骨架。

先读：PROJECT_RULES.md、02-design/technical-architecture.md、02-design/api-design.md。

要求：
1. 只改 04-backend/server，不要动前端；
2. 不确定的地方标「待确认」，不要自行假设；
3. 完成后按交付格式输出。

先复述你的理解，等我确认再动手。
```

> 「先做 OPS-001~003」这种极简写法也能跑，但建议至少带上**必读文件 + 目录边界 + 先复述**这三样，能少踩很多坑。

### 写法 B：在对话里点名角色

```text
用 backend-developer 完成 BE-011 菜品管理接口。
```

### 写法 C：不想用 Agent 功能，直接贴角色说明

```text
你现在是本项目后端开发工程师，只负责 04-backend/server。
先读 CODEBUDDY.md 和 02-design/api-design.md，然后完成 BE-001。
```

---

## 4. 让 Agent 不跑偏的 5 个技巧

1. **给它任务编号**：用 `task-board.md` 里的编号（BE-011、FE-011…），别用模糊的「把菜品功能做一下」。
2. **要求先复述再动手**：第一句加上「先读 XX 文档，复述你的理解，等我确认再写代码」。这一步能拦掉 80% 的跑偏。
3. **明确边界**：写明「只改 `04-backend/server`，不要动前端」。
4. **要求对照验收标准自检**：让它完成后逐条对照 `acceptance-criteria.md` 里的 AC 编号说明达成情况。
5. **让它更新看板**：每个任务结束要求更新 `00-management/task-board.md` 和 `progress.md`，进度才不会丢。

---

## 5. 第一轮可以直接复制的指令（按顺序发）

> 角色已经在界面选好了就不用再说「你是 XX 角色」，但**边界、必读文件、暂停点**一定要写。

### 第 1 条：devops（OPS-001 ~ OPS-003）

```text
任务：OPS-001 到 OPS-003，按顺序逐个完成，每完成一个先汇报，不要一口气全做完再说。

先读：PROJECT_RULES.md、02-design/technical-architecture.md 第 6/7/8 节、06-devops/.env.example。

要求：
1. OPS-001：Git 初始化 + .gitignore（必须忽略 node_modules、.env、uploads、logs）；
2. OPS-002：完善 .env.example，每个变量加中文注释说明用途；
3. OPS-003：写 Windows 可用的启动脚本，优先用 npm script；
4. 只改根目录配置文件和 06-devops/，不要碰任何业务代码，不要建 03-frontend 或 04-backend 里的东西；
5. 每完成一个任务按交付格式汇报一次。

先复述你的执行计划，等我确认再动手。
```

### 第 2 条：backend（BE-001 ~ BE-003）

> 前提：MySQL 已经能连上。开工前先让它确认数据库可用。

```text
任务：BE-001 到 BE-003，按顺序逐个完成，每完成一个先停下来等我验证，不要连着做完。

先读：PROJECT_RULES.md、02-design/technical-architecture.md、
02-design/database-design.md、02-design/api-design.md、.codebuddy/rules/backend-rules.md。

开工前先做一件事：确认 MySQL 可用（数据库 cooking 是否存在、账号密码能否连上）。
连不上就停下来告诉我，不要自己改数据库配置去迁就。

要求：
1. BE-001：在 04-backend/server 下按 technical-architecture.md 第 3 节初始化
   Express 4 + Sequelize 6 + mysql2 工程，实现配置读取、数据库连接、
   统一响应、统一错误处理、请求日志，并加 GET /api/health；
2. BE-002：按 database-design.md 写全部 7 张表的 migration 并执行建表；
3. BE-003：确认统一错误码与文档一致；
4. 本次不要写任何业务接口，不要碰前端目录；
5. 完成后告诉我启动命令，我会自己跑一遍验证。

先复述你的执行计划，等我确认再动手。
```

### 第 3 条：backend（BE-016 种子数据，单独发）

> 建议单独发，因为它依赖建表成功，而且内容量大，混在一起容易出错。

```text
任务：BE-016 种子数据。

要求：
1. 写 seeder，预置 4 个分类（荤菜、素菜、汤羹、主食）和约 30 道常见家常菜；
2. 每道菜要有名称、分类、一句话描述、2~5 个食材、辣度、烹饪时长；
3. 图片字段留空（前端会用占位图）；
4. 用 .env 里的管理员账号配置创建初始管理员；
5. 执行 seeder 后，用查询确认数据真的写进去了，再把结果告诉我。
```

### 第 4 条以后

后续每个任务都套这个格式：

```text
任务：[编号]。

先读：[文档路径]

要求：
1. [具体要求]
2. 只改 [目录]，不要动其他模块；
3. 不确定的地方标「待确认」，不要自行假设；
4. 完成后按交付格式输出。

先复述你的理解和执行计划，等我确认再动手。
```

---

## 6. 更早版本的详细模板（备用）

### 给后端（工程初始化）

```text
你现在使用 backend-developer 角色。

任务：BE-001 初始化 Express 后端工程骨架。

必读文件（读完再动手）：
- PROJECT_RULES.md
- 02-design/technical-architecture.md
- 02-design/database-design.md
- 02-design/api-design.md
- .codebuddy/rules/backend-rules.md

要求：
1. 在 04-backend/server 下初始化 Express 4 + Sequelize 6 + mysql2 工程；
2. 目录结构按 technical-architecture.md 第 3 节；
3. 先只做：配置读取、数据库连接、统一响应、统一错误处理、请求日志、健康检查接口 GET /api/health；
4. 本次不要写业务接口；
5. 完成后按交付格式输出，并更新 task-board.md 与 progress.md。

读完先复述你的理解和执行计划，等我确认后再写代码。
```

### 给前端（C 端骨架）

```text
你现在使用 frontend-developer 角色，本次只做 C 端（03-frontend/mobile）。

任务：FE-001 初始化 Vue 2 + Vant 2 工程。

必读文件（读完再动手）：
- PROJECT_RULES.md
- 02-design/api-design.md
- 01-requirements/acceptance-criteria.md（C 端部分）
- .codebuddy/rules/frontend-rules.md

要求：
1. 初始化 Vue CLI 5 + Vue 2.7 + Vant 2 + vue-router 3 + Vuex 3 + axios；
2. devServer 端口 8080，/api 代理到 http://localhost:3000；
3. 先只做：路由骨架、Tabbar（首页/总菜单/今日菜单/历史）、请求封装、今日菜单 Vuex + localStorage；
4. 本次不要做具体业务页面；
5. 完成后按交付格式输出，并更新 task-board.md 与 progress.md。

读完先复述你的理解和执行计划，等我确认后再写代码。
```

### 给运维

```text
你现在使用 devops 角色。

任务：OPS-001 ~ OPS-003。

必读：PROJECT_RULES.md、02-design/technical-architecture.md 第 6/7/8 节、06-devops/.env.example。

要求：
1. Git 初始化 + .gitignore（忽略 node_modules、.env、uploads、logs）；
2. 完善 .env.example 说明；
3. 写一键启动脚本，保证 Windows 可用；
4. 不修改业务代码。
```

---

## 7. 常用命令

| 命令 | 用途 |
| --- | --- |
| `/init` | 让 CodeBuddy 分析项目生成/更新 CODEBUDDY.md |
| `/agents` | 查看和管理 Agent 角色 |
| `/memory` | 查看当前加载了哪些记忆文件 |
| `/model` | 切换模型 |
| `/config` | 配置语言等偏好（建议设为简体中文） |

---

## 8. 推荐开工顺序

**模式 1（一个对话切角色，串行）** —— 推荐第一次用：

```text
同一个对话里依次切换角色：
devops   → Git + .env + 启动脚本        （OPS-001~003）  /clear
backend  → 工程骨架 + 建表              （BE-001~003）  /clear
backend  → 种子数据                     （BE-016，单独发一条指令）
backend  → 业务接口                     （BE-010~015）  /clear
frontend → C 端页面（先打通一条链路）   （FE-010~017）  /clear
frontend → 后台页面                     （AD-010~016）  /clear
tester   → 用例 + 执行 + 报告           （TEST-001~006）  /clear
devops   → 部署 + 发布检查              （OPS-010~013）
```

每换一个角色就 `/clear` 一次，效果和开新会话差不多，但不用管并行冲突。

**模式 2（多对话并行）** —— 熟悉后再用：

```text
对话 A：backend  → 先做 OPS-001~003 + BE-001~003 + BE-010~015
对话 B：frontend → 等接口就绪后做 FE-010~017（前期只做骨架）
对话 C：tester   → 阶段完成后介入
```

**铁律：不要同时让多个 Agent 改同一个文件；同一个工程内一次只开一个会话。**
