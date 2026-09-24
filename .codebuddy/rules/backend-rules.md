# 后端开发规则

适用范围：`04-backend/server/`

## 技术栈（不可更改）

Node.js + Express 4 + Sequelize 6 + mysql2 + jsonwebtoken + bcryptjs + multer + dotenv。

## 分层约定

```text
route  →  controller  →  service  →  model
```

- route 只注册路由与中间件；
- controller 只取参数、调 service、组装响应；
- service 写业务规则；
- model 只定义表结构与关联。

## 强制要求

1. 所有响应走 `src/utils/response.js`：`{ code: 0, message: 'ok', data }`。
2. 错误统一用 `AppError`，由 `errorHandler` 兜底；错误码见 `02-design/api-design.md` 第 1.2 节。
3. 参数一律用 express-validator 校验，禁止手写 if 堆砌。
4. 禁止字符串拼接 SQL，全部走 Sequelize 参数化。
5. 后台接口（`/api/admin/**`，登录除外）必须过 `auth` 中间件。
6. 查询菜品默认排除 `deleted_at IS NOT NULL`；只有后台 `includeDeleted=true` 才包含。
7. 创建菜单时必须重新查菜品写入名称与图片快照，不信任前端传的名称。
8. 配置一律从 `.env` 读，代码中不得出现硬编码的账号密码、端口、密钥。
9. 每次表结构变更必须新增 sequelize migration，并实现 `down`。
10. 不安装文档中未列出的依赖；确需新增先在 `decisions.md` 记录原因。

## 完成后

更新 `00-management/task-board.md` 中对应任务状态，并在 `00-management/progress.md` 追加一条记录。
