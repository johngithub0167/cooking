# 回滚方案（OPS-013）

> 目的：发布出问题时，用**最短路径**把服务恢复到上一个可用版本，并把损失限制在可控范围。
> 适用范围：家庭点菜单机部署（Windows + Docker Compose）。第一版系统，一切以「快」和「不丢数据」为目标。

---

## 0. 三条铁律

1. **任何时候回滚前，先备份当前状态**（数据库 + 代码：`git rev-parse --short HEAD`）。回滚动作本身也可能出错。
2. **先判断回滚对象**：是「代码问题」还是「数据问题」。代码问题回滚代码，数据问题恢复备份，**不要混着做**。
3. **回滚后必须验证**：`npm run db:check` + `/api/health` + 后台登录 + 首页推荐 + 提交菜单（最小冒烟）。

---

## 1. 判断该回滚什么

| 现象 | 判断 | 动作 |
| --- | --- | --- |
| 新版本部署后页面白屏 / 接口 500 | 代码问题 | §2 代码回滚 |
| 数据库 migration 执行到一半失败 | 代码 + 数据都有 | §2 代码回滚 + §3.2 按 migration 回滚数据 |
| 数据被误删 / 菜品错乱 | 纯数据问题 | §3.1 备份恢复（代码不用动） |
| 容器起不来、端口冲突 | 环境问题 | §4 环境回滚 |
| 图片丢失 | 数据问题 | §3.1 的 uploads.zip 恢复 |

### 1.1 回滚代价速查（选方案前先看这张）

| 回滚类型 | 预计耗时 | 是否丢数据 | 前置条件 | 适用 |
| --- | --- | --- | --- | --- |
| 代码回滚（切 tag / commit） | 3~10 分钟 | **否** | 发版时打过 tag 或能认出目标 commit | 新版本有 bug，数据结构没变 |
| 配置回滚（改 `.env`） | 1~3 分钟 | **否** | 记得上一版参数值 | 只改了端口 / CORS / 密钥之类 |
| 备份回灌（整库） | 5~15 分钟 | **是**（备份之后的新数据全丢） | 有可用备份（`06-devops/backups/`） | 数据被误删、批量错乱 |
| 按 migration 回退 | 2~5 分钟 | 部分（只退结构，数据看 `down` 怎么写） | migration 写了 `down` | migration 执行到一半失败 |
| 环境重建（`down -v`） | 15~30 分钟 | **是（全部）** | 有 seeder（BE-016）；先尝试过备份 | 数据卷损坏且无备份 |

> 判断顺序：**能不碰数据的，就别碰数据**。代码回滚最安全，整库恢复代价最大。

---

## 2. 代码回滚

### 2.1 找到目标版本

```powershell
git log --oneline -10                 # 找到上一个正常提交，例如 a1b2c3d
git tag                                # 若发版时打过 tag，优先用 tag（推荐做法）
```

> 规范要求：每次发版都要打 tag（`git tag -a v1.0.1 -m "..." `），否则回滚时只能靠肉眼认 commit。

### 2.2 回滚步骤

```powershell
cd E:\AICode\cooking

# ① 停服务
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\stop-dev.ps1

# ② 回到目标版本（保留改动，便于事后复盘）
git checkout <目标commit或tag>

# ③ 重装依赖（依赖变了才需要）
npm install

# ④ 重启
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\start-dev.ps1

# ⑤ 验证（见 §5）
```

### 2.3 需要「彻底放弃新版本」时

```powershell
git checkout main
git reset --hard <目标commit>     # ⚠ 会丢掉之后的本地提交，确认已备份或已推送
```

硬性要求：`git reset --hard` 之前必须确认目标版本之后的改动要么已推送远端，要么明确不再需要。**操作前请先执行备份脚本。**

---

## 3. 数据回滚

### 3.1 从备份恢复（推荐）

```powershell
# ① 先给当前状态留一份（哪怕它是坏的，也便于事后取证）
npm run db:backup

# ② 挑出要恢复的那份（按时间选）
Get-ChildItem .\06-devops\backups | Sort-Object Name -Descending

# ③ 恢复
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\restore.ps1 -From .\06-devops\backups\<那份的时间戳>

# ④ 自检
npm run db:check
```

注意：恢复会把数据整体退回到备份那一刻，**备份之后的新数据（比如新提交的菜单记录）会丢失**。若只是误删少量数据，优先人工补录而不是整库恢复。

### 3.2 按 migration 回滚（BE-002 之后可用）

```powershell
cd 04-backend\server
npx sequelize-cli db:migrate:undo        # 回退最近一次 migration
npx sequelize-cli db:migrate:undo:all    # ⚠ 全部回退到初始状态
```

前提：migration 里写了 `down`（Sequelize CLI 默认生成）。**没有 down 的 migration 无法自动撤销**，只能靠备份恢复。

### 3.3 只想回滚配置（不改数据）

改动仅在 `.env` 时：把 `06-devops/.env` 改回上一版参数 → `.\06-devops\scripts\start-dev.ps1`（脚本会自动同步到后端 `.env`）→ 重启生效。

> **重要**：MySQL 的账号密码是容器首次初始化时写死的（在数据卷里），改 `.env` 不会改变已存在的账号。这类「配置回滚」必须走 `down -v` 重建或直接用 root 手工改。

---

## 4. 环境回滚

| 场景 | 操作 |
| --- | --- |
| 容器配置改坏了 | `docker compose -f .\06-devops\docker-compose.yml down` → 用 git 恢复 compose 文件 → `up -d mysql` |
| 数据卷损坏且无可用备份 | `down -v` 删卷 → `up -d mysql` 重建空库 → BE-016 的 seeder 重灌种子数据（**业务数据会丢失**，务必先尝试备份） |
| 端口改动导致连不上 | 改回 `.env` 的 `DB_PORT`（容器 3307 / 本机 3306），重启后端 |

---

## 5. 回滚后验证清单（每一条都要真跑）

- [ ] `npm run db:check` 通过（容器 healthy、业务账号可登录）
- [ ] `http://localhost:3000/api/health` 返回 `code=0`
- [ ] 后台能登录，菜品列表能打开
- [ ] C 端首页能出推荐，换一批有变化
- [ ] 提交一次菜单 → 历史记录出现该条
- [ ] 图片能正常显示（`/uploads/...`）
- [ ] 确认版本：`git log -1 --oneline` 显示的正是目标版本

---

## 6. 回滚记录模板（事后补进 `07-delivery/release-checklist.md`）

| 时间 | 触发原因 | 回滚类型 | 目标版本 | 是否丢数据 | 恢复耗时 | 遗留问题 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-24 22:10 | 推荐接口 500 | 代码回滚 | a1b2c3d | 否 | 8 分钟 | 无 |
