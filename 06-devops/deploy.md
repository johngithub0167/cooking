# cooking 部署与启动说明（OPS-010）

| 项 | 内容 |
| --- | --- |
| 适用版本 | 技术架构 v1.0 |
| 目标环境 | Windows 10/11 + Docker Desktop（推荐）或本机 MySQL 8 |
| 前置任务 | OPS-001~004 |
| 相关脚本 | `06-devops/scripts/*.ps1` |

---

## 0. 端口总表（勿随意改动，与架构文档第 6 节一致）

| 服务 | 端口 | 访问地址 | 说明 |
| --- | --- | --- | --- |
| 后端 Node（Express） | 3000 | `http://localhost:3000` | `/api/*` 接口、`/uploads/*` 静态资源、`/api/health` 健康检查 |
| C 端 H5（dev） | 8080 | `http://localhost:8080` | devServer proxy `/api` → 3000 |
| 管理后台（dev） | 8081 | `http://localhost:8081` | devServer proxy `/api` → 3000 |
| MySQL（容器） | **3307** → 容器 3306 | `127.0.0.1:3307` | 本机 Node 进程用 3307；容器内互联用 `mysql:3306` |
| MySQL（本机直装） | 3306 | `127.0.0.1:3306` | 不走 Docker 时用它，`.env` 里 `DB_PORT=3306` |

> 为什么容器对外是 3307：部分机器已装过 MySQL/phpStudy 套件会占住 3306（风险 T-02）。改端口不动任何业务代码，只改 `.env` 的 `DB_PORT`。

---

## 1. 环境要求

| 依赖 | 版本 | 本机现状 | 安装方式 |
| --- | --- | --- | --- |
| Node.js | ≥ 18（架构推荐 18/20 LTS） | v21.7.3 | 见 §6「Node 版本说明」 |
| npm | 随 Node 附带 | 10.5.0 | — |
| Docker Desktop | 任意 4.x | 20.10.22（CLI）/ Compose v2.15.1 | `winget install --id Docker.DockerDesktop -e` |
| Git | ≥ 2.30 | 2.30.2（`E:\software\Git`，Git Bash 可用） | `winget install --id Git.Git -e` |
| MySQL | 8.x | 由 Docker 提供（本机已有的是 phpStudy 遗留的 **5.5**，不用它） | 见 §3 |

---

## 2. 首次启动（推荐：三条命令）

```powershell
# 全部在项目根目录 E:\AICode\cooking 执行
cd E:\AICode\cooking

# ① 生成本机真实配置（随机生成 MySQL 口令、JWT 密钥、初始管理员密码）
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\init-env.ps1

# ② 拉起 MySQL 8 容器（首次会拉镜像，约几分钟；之后秒起）
docker compose -f .\06-devops\docker-compose.yml up -d mysql

# ③ 一键启动整套服务（后端 + 自动检测数据库）
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\start-dev.ps1
```

更省事的做法：**跳过 ②**，直接执行 ③。脚本检测到 3307 无监听时会自动帮你执行 `docker compose up -d mysql` 并等待健康检查通过。

等价的 npm 入口（Windows 上同样调用 PowerShell 脚本）：

```bash
npm run env:init     # 等价于 ①
npm run db:up        # 等价于 ②
npm run db:check     # 数据库连通性自检
npm run db:backup    # 备份
npm run db:drill     # 备份→删表→恢复 自动化演练（验证备份真的能救回来）
npm run dev          # 等价于 ③（只起后端）
npm run dev:all      # 后端 + C 端 + 后台
npm run stop         # 停止本地服务
```

**验证是否成功**：

| 检查项 | 命令 | 期望结果 |
| --- | --- | --- |
| 容器健康 | `docker inspect -f '{{.State.Health.Status}}' cooking-mysql` | `healthy` |
| 端口监听 | `netstat -ano \| findstr :3307` | 有 LISTENING |
| 账号联通 | `npm run db:check` | 「业务账号登录成功」 |
| 后端健康 | 浏览器打开 `http://localhost:3000/api/health` | `{"code":0,...}`（BE-001 之后才有） |

---

## 3. 数据库两种方案

### 方案 A：Docker 容器（默认 / 推荐）

- 数据落在 named volume `cooking-mysql-data`，**删容器不丢数据**。
- 首次初始化时自动执行：建库 `cooking`（utf8mb4）+ 建应用账号 `MYSQL_USER/MYSQL_PASSWORD` 并授权。
- 常用命令：

```powershell
docker compose -f .\06-devops\docker-compose.yml up -d mysql     # 启动
docker compose -f .\06-devops\docker-compose.yml ps              # 状态
docker compose -f .\06-devops\docker-compose.yml logs --tail 100 mysql  # 看日志
docker compose -f .\06-devops\docker-compose.yml stop mysql      # 停止（数据保留）
docker compose -f .\06-devops\docker-compose.yml down            # 停止并删容器（数据仍在卷里）
docker compose -f .\06-devops\docker-compose.yml down -v         # ⚠ 连数据卷一起删，等于清库
docker exec -it cooking-mysql mysql -uroot -p                    # 进 mysql 命令行
```

> 改了 `.env` 里的 `MYSQL_ROOT_PASSWORD` / `MYSQL_USER` / `MYSQL_PASSWORD` 后，已有数据卷 **不会** 生效，必须 `down -v` 再 `up -d`（会清库，先备份）。

### 方案 B：本机直装 MySQL 8（无 Docker 时）

1. 安装 MySQL Community Server 8.0（<https://dev.mysql.com/downloads/mysql/>，选 Windows MSI）。
2. 建库并建账号：

   ```sql
   CREATE DATABASE cooking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'cooking'@'%' IDENTIFIED BY '<强口令>';
   GRANT ALL PRIVILEGES ON cooking.* TO 'cooking'@'%';
   FLUSH PRIVILEGES;
   ```

3. 生成配置时声明走本机：`powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\init-env.ps1 -NativeDb`（写 `DB_PORT=3306`）。
4. 备份脚本相应加 `-Native` 参数：`.\06-devops\scripts\backup.ps1 -Native -MysqldumpPath "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe"`。

> 注意：本机 phpStudy 遗留的 MySQL 是 **5.5**，版本过旧（Sequelize 6 需要 5.7+），**不要**拿它跑本项目。

---

## 4. 容器化部署（连后端一起进容器，需 BE-001 之后）

后端容器默认挂在 compose 的 `full` profile 下——日常开发更推荐本机 `npm run dev`（可断点调试），只有联调打包或单机部署时才用：

```powershell
# 需要 04-backend/server 下有 Dockerfile与 package.json
docker compose -f .\06-devops\docker-compose.yml --profile full up -d --build
docker compose -f .\06-devops\docker-compose.yml logs -f server
docker compose -f .\06-devops\docker-compose.yml --profile full down
```

容器内约定：`DB_HOST=mysql`、`DB_PORT=3306`（compose 已自动覆盖，无需改 `.env`）、`UPLOAD_DIR=/app/uploads`、`LOG_DIR=/app/logs`，上传与日志都做了目录挂载，容器删了文件还在。

后端 Dockerfile 需由 BE-001 提供，建议写法：

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

---

## 5. 生产 / 半生产注意事项

| 项 | 要求 |
| --- | --- |
| `NODE_ENV` | 设为 `production`，错误响应不再返回堆栈（架构 8 节） |
| `CORS_ORIGIN` | 必须改成具体域名，不能是 `*` |
| `JWT_SECRET` | 每台机器不同，至少 32 位随机（init-env.ps1 已生成 48 位） |
| 初始管理员密码 | seeder 建完账号后立即改密，并清理 `.env` 里的明文 |
| 进程托管 | 家庭单机可用 `pm2 start src/server.js --name cooking`；或直接用 compose 的 `server` 服务 |
| HTTPS | 第一版不做（架构第 7 节），上公网再补 Nginx + 证书 |
| 日志轮转 | `logs/` 目录定期清理，见 README「常见问题」 |

---

## 6. 故障排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `Error processing tar file / open //./pipe/docker_engine_linux` | Docker Desktop 没起来或还在启动 | 打开 Docker Desktop，等右下角图标不再转圈，再执行 `docker info` 验证 |
| 后端报 `SequelizeConnectionRefusedError` | DB 端口不对或容器没起来 | `npm run db:check`；确认 `DB_PORT` 是 3307（容器）还是 3306（本机） |
| 报 `Access denied for user 'cooking'` | `.env` 改过密码但数据卷是旧的 | `docker compose down -v && docker compose up -d mysql`（会清库，先备份） |
| `EADDRINUSE: address already in use` | 3000 / 8080 / 8081 / 3307 端口被别的进程占着 | `.\06-devops\scripts\stop-dev.ps1` 释放端口，或改 `.env` 里的端口 |
| 脚本输出中文乱码 / 报奇怪语法错 | PowerShell 5.1 按 GBK 读了无 BOM 的 UTF-8 脚本 | 已统一把 `.ps1` 存成 UTF-8 **带 BOM**；如自行新增脚本请同样处理 |
| `npm install` 报 `ERR_OSSL_EVP_UNSUPPORTED` | Node 17+ 跑老 webpack | 用 `-LegacyOpenSsl` 参数启动，或把 Node 切到 20 LTS |
| 上传图片 404 | `uploads` 挂载或静态路径不对 | 确认后端 `app.use('/uploads', express.static(...))` 与容器内 `/app/uploads` 挂载一致 |
| 改了 `.env` 不生效 | dotenv 只在进程启动时读一次 | 重启后端（nodemon 会自动重启） |

### Node 版本说明（本机 v21.7.3）

- **对后端（Express + Sequelize + mysql2 + jsonwebtoken + bcryptjs）没有影响**，可以直接跑。
- 风险点在前端构建：Vue CLI 5 是 webpack 5，Node 21 下可用；但少数老依赖可能触发 `ERR_OSSL_EVP_UNSUPPORTED`（脚本已内置 `-LegacyOpenSsl` 兜底）。
- Node 21 是奇数版（非 LTS，已停止维护周期），团队统一建议 **Node 20 LTS**。切换到 20 无需改任何代码。

---

## 7. 停止与卸载

```powershell
# 停服务（端口释放）
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\stop-dev.ps1 -WithDocker

# 彻底清理容器 + 卷（会清库，慎用！先 npm run db:backup）
docker compose -f .\06-devops\docker-compose.yml down -v
```
