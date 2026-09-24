# cooking 项目 - CodeBuddy 项目记忆

> 本文件在 CodeBuddy 启动时**自动加载**，是所有 Agent 的公共上下文。
> 项目根目录：`E:/AICode/cooking`。**必须用 CodeBuddy 打开这个目录作为工作区**，否则本文件不生效。

## 1. 项目是什么

家庭点菜小程序：家人打开手机 H5 看推荐/点菜，管理员在后台维护菜品库（分类、图片、描述、食材）。

## 2. 技术基线（已冻结，不得擅自更改）

| 层次 | 选型 |
| --- | --- |
| C 端 | 移动端 H5 网页，Vue 2.7 + Vant 2，**免登录** |
| 后台 | PC Web，Vue 2.7 + Element UI 2，需登录（JWT） |
| 后端 | Node.js + Express 4 + Sequelize 6 + mysql2 |
| 数据库 | MySQL 8，库名 `cooking`，字符集 utf8mb4 |
| 图片 | 后端本地磁盘 `uploads/`，数据库只存相对路径 |
| 端口 | 后端 3000 / C 端 dev 8080 / 后台 dev 8081 / MySQL 3306 |

## 3. 目录地图

```text
00-management/   项目管理：project-charter / task-board / progress / decisions / open-questions
01-requirements/ 需求：prd.md / user-stories.md / acceptance-criteria.md
02-design/       技术设计：technical-architecture.md / database-design.md / api-design.md
03-frontend/mobile/   C 端 H5（Vue2 + Vant）
03-frontend/admin/    管理后台（Vue2 + Element UI）
04-backend/server/    Express 服务
05-testing/      测试用例与报告
06-devops/       环境变量模板、Docker、部署与备份
07-delivery/     发布检查清单
PROJECT_RULES.md 协作总规则
```

## 4. 按角色必读文件（动手前必须先读）

| 角色 | 必读 |
| --- | --- |
| 后端 | `PROJECT_RULES.md` + `02-design/api-design.md` + `02-design/database-design.md` + `02-design/technical-architecture.md` |
| 前端（C 端） | `PROJECT_RULES.md` + `02-design/api-design.md` + `01-requirements/acceptance-criteria.md`（C 端部分） |
| 前端（后台） | `PROJECT_RULES.md` + `02-design/api-design.md` + `01-requirements/acceptance-criteria.md`（后台部分） |
| 测试 | `01-requirements/acceptance-criteria.md` + `02-design/api-design.md` |
| 运维 | `02-design/technical-architecture.md` 第 6、7 节 + `06-devops/.env.example` |

## 5. 强制规则

1. **先读文档再动手**：未读取第 4 节对应文件前，不得写代码。
2. **接口字段以 `02-design/api-design.md` 为准**。需要改字段必须先更新该文档 + `00-management/decisions.md`，再改代码。
3. **不得擅自改技术选型**（框架、ORM、数据库、UI 库）。
4. 需求中不确定的地方标记「待确认」，**不得自行假设业务规则**。
5. **一次只做一个任务编号**（如 BE-011），不要顺手改别的模块。
6. 不提交真实密码、Token 到代码与文档；敏感配置只放 `.env`（不入库）。
7. 每个任务完成后必须更新状态：优先写 `00-management/status/` 下对应角色的状态文件；**并行开发时禁止直接改 `task-board.md`**（多个会话同时改会互相覆盖）。
8. 发现其他模块问题：**只记录，不越权修改**。
9. 不得为通过测试而删除测试或降低验收标准。
10. 先打通一条最小链路（推荐 → 加入 → 提交 → 历史），再扩展其他功能。

## 6. 交付格式（每次完成任务必须输出）

```text
任务编号：
完成内容：
修改/新增文件：
验证方式（命令或操作路径）：
验证结果：
未解决问题 / 待确认：
建议下一步：
```

## 7. 当前阶段

需求 v1.0 与技术设计 v1.0 已完成，等待用户评审。评审通过后按以下顺序开工：

1. 工程初始化（Git、.env、后端骨架、前端骨架）
2. 后端接口 BE-010 ~ BE-016
3. C 端页面 FE-010 ~ FE-017（重点是 FE-011 总菜单页）
4. 后台页面 AD-010 ~ AD-016
5. 测试 → 交付

任务清单与编号见 `00-management/task-board.md`。

## 8. 扩展阅读

@PROJECT_RULES.md
