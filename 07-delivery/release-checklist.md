# Release checklist（发布检查清单）

> 适用：家庭点菜单机版（Windows + Docker Compose）

> 用法：每次发版打印一份，逐条打勾，**任何一项未通过都不得上线**。
> 发布人员 / 日期写在表头，归档保存，回滚时第一件事就是翻它（配合 `06-devops/rollback.md`）。

---

## 版本信息

| 项 | 内容 |
| --- | --- |
| 版本号 / 标签 | `v______`（发布前务必打 tag：`git tag -a v1.0.1 -m "..."`） |
| 发布目标 | ☐ 本机 ☐ 家庭服务器 |
| 发布人 |  |
| 发布日期 |  |
| 代码 commit | `git log -1 --oneline` → `__________` |
| 回滚目标版本 | 上一个 tag：`__________` |
| 预计影响范围 |  |

---

## 一、发布前：环境与依赖

- [ ] Node 可用且版本合规（`node -v`，建议 18/20 LTS）
- [ ] Docker Desktop 已启动（`docker info` 不报错）
- [ ] `06-devops/.env` 存在且不是模板占位值（`.\06-devops\scripts\init-env.ps1` 生成过）
- [ ] 依赖安装完成（`npm install` 无 ERROR，允许 EBADENGINE 警告）

## 二、发布前：安全（硬性，一条不过即终止）

- [ ] `JWT_SECRET` 是随机串（非 `please_replace...`），且每次部署不同
- [ ] `MYSQL_ROOT_PASSWORD` / `MYSQL_PASSWORD` / `DB_PASSWORD` 是强口令且互相对应
- [ ] `ADMIN_DEFAULT_PASSWORD` 已改（或 seeder 建号后已后台改密）
- [ ] `CORS_ORIGIN` 已改为具体域名，**不是** `*`
- [ ] `NODE_ENV=production`
- [ ] `.env` 未被 Git 跟踪：`git ls-files | Select-String '(^|/)\.env$'` 输出为空
- [ ] `git check-ignore -v 06-devops/.env` 命中规则
- [ ] 代码里没有硬编码密码 / Token（`git grep -nE "(password|secret|token)\s*=\s*['\"][^'\"]+"` 人工复核）
- [ ] `uploads/`、`logs/`、`06-devops/backups/` 均未被跟踪

## 三、发布前：数据与备份

- [ ] **已执行备份**：`npm run db:backup`，记录备份目录 `__________`
- [ ] 备份内容完整：`db.sql` > 100 字节，有业务库名；有图片时 `uploads.zip` 存在
- [ ] **恢复演练已跑通**：`npm run db:drill` 输出「演练通过」（至少每季度一次 + 每次发版前，见 `06-devops/backup-restore.md` §4.1）
- [ ] migration 已执行（`npx sequelize-cli db:migrate:status` 全部 up）
- [ ] 新增 migration 都写了 `down`（否则无法按 migration 回滚）

## 四、发布前：代码质量

- [ ] `main` 分支，工作区干净（`git status` 无未提交内容）
- [ ] 测试已通过：`05-testing/` 的 TEST-002~005 结论无阻塞缺陷
- [ ] `npm ls --depth=0` 无缺失依赖；能正常 `npm run build`（前端）
- [ ] 后端能正常启动且 `/api/health` 返回 `code=0`
- [ ] 已按 `02-design/api-design.md` 与前端联调通过（字段名、错误码一致）

## 五、发布步骤（按顺序打勾）

1. [ ] 停旧服务：`npm run stop`（或 `.\06-devops\scripts\stop-dev.ps1 -WithDocker`）
2. [ ] 拉新版本：`git fetch && git checkout <版本>`（不要直接往 production 上改代码）
3. [ ] 装依赖：`npm install`（后端 + 两个前端）
4. [ ] 同步配置：`.env` 新增变量已按 `.env.example` 补齐
5. [ ] 执行 migration：`cd 04-backend/server && npx sequelize-cli db:migrate`
6. [ ] 启动服务：`docker compose -f .\06-devops\docker-compose.yml up -d mysql` → `npm run dev`
7. [ ] 观察日志 2 分钟无异常：`docker compose logs --tail 100 mysql`
8. [ ] 打 tag：`git tag -a v1.x.x -m "release: ..."`

## 六、发布后验证（每条都要真跑，不看代码）

- [ ] `npm run db:check` 全绿（容器 healthy、端口通、业务账号能登录）
- [ ] `http://localhost:3000/api/health` 返回 `{"code":0,...}`
- [ ] C 端：首页推荐出 4 道菜 → 换一批有变化
- [ ] C 端：加入今日菜单 → 数量增减 → 提交 → 成功页
- [ ] C 端：历史记录里能看到刚提交的菜单
- [ ] 后台：账号登录成功，登出后再访问被拦截
- [ ] 后台：新增菜品 + 上传图片 → C 端能搜到且图片正常显示
- [ ] 后台：下线 / 删除菜品 → C 端不再出现
- [ ] 图片能访问：`http://localhost:3000/uploads/...` 返回 200
- [ ] 移动端视口（DevTools 手机模式）排版正常
- [ ] 异常场景：错误的用户名密码返回统一错误结构，无堆栈泄露

## 七、发布后收尾

- [ ] 观察 30 分钟无报错（或次日复检一次）
- [ ] 备份目录保留（`06-devops/backups/`，勿删旧备份）
- [ ] 更新 `00-management/progress.md` 与 `task-board.md` 状态
- [ ] 本次清单归档，记录上述「版本信息」表
- [ ] 若回滚过，填写下面的回滚记录

## 八、回滚记录（出问题时填）

| 时间 | 触发原因 | 回滚类型（代码 / 数据 / 环境） | 目标版本 | 是否丢数据 | 恢复耗时 | 遗留问题 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

---

## 九、快速命令索引

```powershell
npm run db:backup     # 备份
npm run db:drill      # 备份→删表→恢复 自动化演练（发版前必跑）
npm run db:check      # 数据库自检
npm run stop          # 停服务
npm run dev:all       # 启全套
```

详细方案：
- 部署：`06-devops/deploy.md`
- 备份恢复：`06-devops/backup-restore.md`
- 回滚：`06-devops/rollback.md`
