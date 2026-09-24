# 06-devops 运维说明

> 负责：运维（devops）
> 范围：Git 初始化、环境变量模板、一键启动脚本、Docker Compose、部署 / 备份 / 回滚 / 发布检查方案
> 端口约定：后端 3000、C 端 dev 8080、后台 dev 8081、MySQL 3306（**容器对外映射 3307**）
> 更新时间：2026-09-25
> 任务状态：OPS-001 / 002 / 003 / 004 / 010 / 011 / 012 / 013 已完成（OPS-001 的首次提交待你确认执行，见 §7）

---

## 1. 目录说明

| 路径 | 说明 |
| --- | --- |
| `.env.example` | 环境变量**唯一模板**，真实 `.env` 由它生成 |
| `.env` | 本机真实配置（含密码，**已被 .gitignore 忽略，绝不入库**） |
| `docker-compose.yml` | MySQL 8（宿主 3307）+ 可选后端 `server`（`full` profile） |
| `deploy.md` | 部署与启动文档（OPS-010） |
| `backup-restore.md` | 备份与恢复方案（OPS-011） |
| `rollback.md` | 回滚方案（OPS-013） |
| `../07-delivery/release-checklist.md` | 发布检查清单（OPS-012） |
| `scripts/ops-common.ps1` | 公共工具库（`Invoke-Native` / `Invoke-Docker` / `Resolve-GitExe`…），被其它脚本 dot-source |
| `scripts/start-dev.ps1` | 一键启动（后端 + MySQL + 可选前端），Windows 主脚本 |
| `scripts/start-dev.cmd` | 双击入口，自动绕过 PowerShell 执行策略 |
| `scripts/stop-dev.ps1` | 按端口停止本地服务（3000 / 8080 / 8081，可加 `-WithDocker`） |
| `scripts/init-env.ps1` | 由模板生成本机 `.env`（随机口令 / JWT 密钥） |
| `scripts/db-check.ps1` | 数据库自检：容器健康 → 端口 → 建库授权 → 业务账号登录 |
| `scripts/pull-db-image.ps1` | 拉 MySQL 8 镜像，官方源超时自动回退镜像加速源 |
| `scripts/backup.ps1` / `restore.ps1` | 数据库 + uploads 备份 / 恢复 |
| `scripts/backup-drill.ps1` | 备份 / 恢复**自动化演练**：写样本 → 备份 → 删表 → 恢复 → `HEX()` 字节级比对 → 清理 |
| `scripts/git-init.ps1` | Git 仓库初始化 + 敏感文件体检 |
| `scripts/check-scripts.ps1` | 脚本自检：UTF-8 BOM / CRLF / 语法 |
| `backups/` | 备份产物（按时间戳分目录，**已被忽略**） |

---

## 2. 首次上手（一条命令启动）

### 2.1 前置条件

| 依赖 | 要求 | 本机实测 | 处理 |
| --- | --- | --- | --- |
| Node.js | 建议 18 / 20 LTS | **v21.7.3（非 LTS，仅告警不阻断）** | 报 `ERR_OSSL_EVP_UNSUPPORTED` 时用 `npm run dev:ossl` |
| npm | 随 Node 安装 | 10.5.0 | — |
| Git | ≥ 2.30 | **2.30.2，装在 `E:\software\Git`** | 未进 PATH 也没关系，脚本会自动探测并临时加入会话 PATH |
| Docker Desktop | 任意 4.x | 20.10.22（CLI）/ Compose v2.15.1 | 需提前启动，等托盘图标不再转圈 |
| MySQL 8 | 容器提供 | 容器 `cooking-mysql`（3307）已 healthy | 不走 Docker 见 `deploy.md` §3 方案 B |

> 本机另有 phpStudy 遗留的 MySQL **5.5**，版本过旧（Sequelize 6 要 5.7+），**不要**拿它跑本项目。

### 2.2 一把梭：三条命令（其实只要最后一条）

在项目根目录 `E:\AICode\cooking` 执行：

```powershell
cd E:\AICode\cooking

# ① 生成本机真实配置（随机生成 MySQL 口令、JWT 密钥、初始管理员密码）
npm run env:init

# ② 首次拉 MySQL 8 镜像（官方源慢会自动切加速源）；已有镜像可跳过
npm run db:image

# ③ 一条命令启动整套服务（后端 + 自动拉起 MySQL 容器 + 健康检查）
npm run dev
```

> **日常最常用的就是 `npm run dev`。** 脚本检测到 3307 未监听时会自动执行 `docker compose up -d mysql` 并等待容器 healthy，
> 缺依赖自动 `npm install`，起来后轮询 `http://localhost:3000/api/health` 判定就绪。
> 想连前端一起起：`npm run dev:all`（C 端 8080 + 后台 8081，需 FE-001 / FE-002 已初始化）。

等价的 PowerShell 直呼（不用 npm 时）：

```powershell
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\start-dev.ps1 -WithDocker -WithMobile
```

也可以直接**双击** `06-devops\scripts\start-dev.cmd`（等价不带参数启动）。

### 2.3 停止服务

```powershell
npm run stop                                              # 释放 3000/8080/8081
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\stop-dev.ps1 -WithDocker   # 顺带停容器
```

脚本会自动跳过系统进程（PID ≤ 4、System、svchost 等）。

### 2.4 npm 命令总表

| 命令 | 作用 |
| --- | --- |
| `npm run env:init` | 生成 / 更新本机 `.env` |
| `npm run dev` | 启动后端（+ 自动拉起 MySQL） |
| `npm run dev:all` | 后端 + C 端 + 后台 |
| `npm run dev:ossl` | 同上，带 OpenSSL legacy 兜底 |
| `npm run stop` | 停本地服务 |
| `npm run db:image` | 拉 MySQL 8 镜像（慢时自动换源） |
| `npm run db:up` / `db:down` / `db:restart` / `db:logs` / `db:ps` | 容器生命周期 |
| `npm run db:check` | 数据库自检（含建库授权） |
| `npm run db:backup` / `db:restore` | 备份 / 恢复 |
| `npm run db:drill` | 备份 → 删表 → 恢复 的自动化演练（字节级校验，失败退出码非 0） |
| `npm run ops:check` | 运维脚本自检（`-- -Fix` 自动修 BOM/换行） |
| `npm run ops:git-init` | Git 初始化 + 敏感文件体检（`-Commit` 才提交） |

---

## 3. 脚本参数速查

### `start-dev.ps1`

| 参数 | 作用 | 备注 |
| --- | --- | --- |
| `-WithDocker` | 显式用 Docker Compose 拉起 MySQL 8 | 不加也会在 3307 无监听时自动拉起 |
| `-WithMobile` | 同时启动 C 端（8080） | 需 FE-001 已初始化 `03-frontend/mobile` |
| `-WithAdmin` | 同时启动管理后台（8081） | 需 FE-002 已初始化 `03-frontend/admin` |
| `-SkipInstall` | 跳过 `npm install` | 依赖已装好时加快启动 |
| `-LegacyOpenSsl` | 给子进程设 `NODE_OPTIONS=--openssl-legacy-provider` | 报 `ERR_OSSL_EVP_UNSUPPORTED` 时用 |

```powershell
.\06-devops\scripts\start-dev.ps1                          # 只起后端
.\06-devops\scripts\start-dev.ps1 -SkipInstall             # 依赖装过了，快速重启
.\06-devops\scripts\start-dev.ps1 -WithDocker -WithMobile  # 后端 + MySQL 容器 + C 端
```

### `db-check.ps1`

```powershell
npm run db:check                                          # 等价于 -Wait
.\06-devops\scripts\db-check.ps1 -Wait -CreateDb          # 等待就绪并建库授权
```

依次检查：Docker 守护 → 容器存在/运行/healthy → 端口连通 → 库 `cooking` 存在 → 业务账号可登录。

### `backup.ps1` / `restore.ps1`

```powershell
npm run db:backup                                         # 输出到 06-devops/backups/<时间戳>，保留最近 10 份
.\06-devops\scripts\backup.ps1 -OutDir D:\backup\cooking -Keep 20
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\restore.ps1 -From .\06-devops\backups\20260924-101500
```

`restore.ps1` 支持 `-SkipUploads` / `-UploadsOnly` / `-Yes`（跳过二次确认）。**执行前务必先备份当前数据**。

### `git-init.ps1`

```powershell
npm run ops:git-init                                      # init + add + 敏感文件体检（不提交）
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\git-init.ps1 -Commit
```

内置两道体检：暂存区若出现 `.env` / `node_modules` / `uploads` / `logs` / `dist` / `mysql-data` 会自动 `git reset` 并退出；再用 `git check-ignore` 验证关键路径确实被忽略。脚本**不改任何 git 配置、不自动关联远端、不自动 push**。

---

## 4. 环境变量

模板：`06-devops/.env.example`（每个变量都标注了用途 / 是否必填 / 默认值 / 注意事项），项目只维护这一份。

```powershell
Copy-Item .\06-devops\.env.example .\04-backend\server\.env
```

上线 / 交接前必做：

- [ ] `JWT_SECRET` 换成随机串：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] `DB_PASSWORD`、`ADMIN_DEFAULT_PASSWORD` 换成强密码（真实值只存在于本机 `.env`）
- [ ] `CORS_ORIGIN` 改成具体域名，不再用 `*`
- [ ] `NODE_ENV=production`
- [ ] 确认 `.env` 未被跟踪：`git ls-files | Select-String '(^|/)\.env$'` 应无输出

---

## 5. 文档索引

| 场景 | 看哪里 |
| --- | --- |
| 第一次装环境、起服务、端口不通 | `deploy.md` |
| 容器起不来、`.env` 改了不生效、OpenSSL 报错 | `deploy.md` §6 |
| 备份 / 恢复 / 定时备份 / 演练 | `backup-restore.md` |
| 发版出问题要回滚 | `rollback.md` + `../07-delivery/release-checklist.md` 第八节 |
| 每次发版逐条打勾 | `../07-delivery/release-checklist.md` |

---

## 6. 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| 脚本输出中文乱码、报奇怪语法错 | PS 5.1 按 GBK 读了无 BOM 的 UTF-8 脚本。跑 `npm run ops:check -- -Fix` 统一修成 UTF-8 BOM + CRLF |
| 脚本在 `docker` / `git` / `npm` 处莫名中断 | 这些原生命令写 stderr 会被 PS 5.1 当致命错误。所有调用已统一走 `ops-common.ps1` 的 `Invoke-Native`，新脚本请照抄 |
| `npm run db:drill` 报「写入失败或字符集异常」 | 多为自己写的查询/解析踩了 PS 坑（属性访问误判、单行输出变标量） | 见 `backup-restore.md` §4.3 的三条规避规则 |
| `无法将"git"项识别为 cmdlet` | 未进 PATH。`ops-common.ps1` 的 `Resolve-GitExe` 会扫 PATH + 常见安装目录 + 注册表，并临时加进会话 PATH |
| `docker pull` 卡在几十 KB/s | 官方源被限，改 `npm run db:image`（自动切 dockerproxy / daocloud / 163 加速源） |
| 后端起来但健康检查失败 | 多为数据库连不上。`npm run db:check` 看具体环节 |
| 3306 端口被占用 | 容器方案用 3307（`.env` 的 `DB_PORT=3307`），见架构风险 T-02 |
| `ERR_OSSL_EVP_UNSUPPORTED` | Node 17+ 跑老 webpack 的已知问题，用 `npm run dev:ossl` |
| `EBADENGINE` 警告 | Node 非 LTS 时出现，告警不阻断；建议切 20 LTS |
| 3000/8080/8081 被别的程序占用 | 先 `npm run stop`；仍占用用 `netstat -ano \| findstr :3000` 查 PID |
| Docker Compose 起不来 | Docker Desktop 未启动，脚本只告警不阻断后端启动 |

---

## 7. 完成情况

| 编号 | 任务 | 交付物 | 状态 |
| --- | --- | --- | --- |
| OPS-001 | Git 仓库与 `.gitignore` | `.gitignore`、`.gitattributes`、`scripts/git-init.ps1` | 已完成（已 `git init` + `add` + 敏感文件体检通过；**首次提交待确认**：`npm run ops:git-init -- -Commit`） |
| OPS-002 | 环境变量模板 | `.env.example` + `scripts/init-env.ps1` | 已完成 |
| OPS-003 | 一键启动脚本 | `start-dev.ps1`（+ `.cmd` 入口）、`stop-dev.ps1` | 已完成 |
| OPS-004 | Docker Compose | `docker-compose.yml`（MySQL 3307 + `full` profile 的 server） | 已完成 |
| OPS-010 | 部署文档 | `deploy.md` | 已完成 |
| OPS-011 | 备份恢复方案 | `backup-restore.md` + `backup.ps1` / `restore.ps1` / `backup-drill.ps1` | 已完成（「备份→删表→恢复」闭环已脚本化，可 `npm run db:drill` 随时复验） |
| OPS-012 | 发布检查清单 | `../07-delivery/release-checklist.md` | 已完成 |
| OPS-013 | 回滚方案 | `rollback.md` | 已完成 |
