# 数据备份与恢复方案（OPS-011）

> 依赖：Docker Compose 的 MySQL 容器（默认）或本机 MySQL 8。
> 脚本：`06-devops/scripts/backup.ps1`、`06-devops/scripts/restore.ps1`、`06-devops/scripts/backup-drill.ps1`
> npm 入口：`npm run db:backup`、`npm run db:restore`、`npm run db:drill`（自动化演练）

---

## 1. 备份内容

一次备份 = 一个时间戳目录 `06-devops/backups/<yyyyMMdd-HHmmss>/`：

| 文件 | 内容 | 来源 |
| --- | --- | --- |
| `db.sql` | MySQL 全量逻辑备份（`mysqldump --single-transaction --routines --triggers --databases cooking`） | 容器内 mysqldump，不需要本机装客户端 |
| `uploads.zip` | 菜品图片目录 `04-backend/server/uploads`（空目录则跳过） | Compress-Archive |
| `meta.json` | 创建时间、库名、导出模式、文件大小、git 提交号、恢复命令 | backup.ps1 写入 |

特性：`--single-transaction` 不锁表，可以在服务运行时备份；导出走 `cmd.exe` 重定向（字节级落盘），避免 PowerShell 管道重编码把中文或二进制弄坏。

---

## 2. 执行备份

```powershell
# 默认：容器模式，输出到 06-devops/backups，保留最近 10 份
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\backup.ps1

# 等价 npm
npm run db:backup

# 自定义：输出到 D 盘，保留 20 份
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\backup.ps1 -OutDir D:\backup\cooking -Keep 20

# 本机 MySQL 模式
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\backup.ps1 -Native `
    -MysqldumpPath "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe"
```

备份目录已被 `.gitignore` 忽略（含数据库内容，禁止入库）。

---

## 3. 执行恢复

```powershell
# 交互确认（推荐）：会打印备份元信息并要求输入 yes
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\restore.ps1 -From .\06-devops\backups\20260924-101500

# 只恢复库，不动图片
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\restore.ps1 -From .\06-devops\backups\20260924-101500 -SkipUploads

# 只恢复图片
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\restore.ps1 -From .\06-devops\backups\20260924-101500 -UploadsOnly -Yes
```

流程：定位 SQL →（非 `-Yes` 时二次确认）→ `mysql` 导入 → 统计表数量核对 → 解压图片（先落临时目录再覆盖，避免中途失败留下半成品）。

⚠ 恢复会覆盖同名表与同名图片文件；脚本不会自动帮你备份当前数据，**执行前先跑一次 backup.ps1**。

---

## 4. 恢复演练（必做）

只在真出事时才第一次跑恢复脚本，等于没有方案。

### 4.1 一条命令自动演练（推荐）

```powershell
npm run db:drill
# 想留下演练备份人工翻看：
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\backup-drill.ps1 -KeepBackup
```

`backup-drill.ps1` 会**真跑一遍完整链路**，而不是看文档脑补：

1. 在业务库建演练表 `_ops_drill`，写入一行「中文 + 英文」样本；
2. 调用**正式的** `backup.ps1` 全量备份（输出到 `%TEMP%\cooking-backup-drill`，不占用正式备份配额）；
3. `DROP` 演练表，模拟数据丢失；
4. 调用**正式的** `restore.ps1` 从刚才那份备份恢复；
5. 用 `HEX()` 做**字节级比对**——中文只要有一个字节被二次编码就会被抓出来，肉眼看「没乱码」不算数；
6. 清理演练表与演练备份，输出 PASS / FAIL 摘要（失败退出码非 0，失败时保留现场便于排查）。

全程不碰真实业务表：`mysqldump --databases` 只重建备份时刻存在的表，不会 DROP 备份之后新建的表。

### 4.2 手工演练（每季度一次，和自动化二选一即可）

1. `npm run db:backup` 拿一份当前数据；
2. 故意改动一条数据（例如后台改某道菜的名字）；
3. `restore.ps1 -From <刚才那份>`；
4. `npm run db:check` + 后台页面确认数据回到改动前；
5. 在 `07-delivery/release-checklist.md` 记录演练结果。

### 4.3 演练脚本踩过的两个 PowerShell 坑（写新脚本时照抄规避）

| 坑 | 现象 | 规避 |
| --- | --- | --- |
| 双引号里写 `"$dbName.$DrillTbl"` | 被解析成**属性访问**（在字符串 `cooking` 上取名为 `_ops_drill` 的属性 → `$null`），SQL 变成 `FROM  WHERE ...` | 写成 `${dbName}.${DrillTbl}` 显式界定变量边界 |
| `$rows = 函数` 且函数只输出一行 | 拿到的是**标量字符串**，`$rows[0]` 取的是第一个字符而不是第一行 | 一律写成 `$rows = @(函数)` 强制成数组 |
| `docker exec` 未分配 TTY | 容器内 stderr 会并进 stdout，SQL 报错不体现在退出码里 | 调用后检查输出里是否含 `^ERROR `（脚本内已实现） |

---

## 5. 备份策略建议（家庭场景）

| 场景 | 频率 | 保留 |
| --- | --- | --- |
| 日常开发 | 需要时手动 | 10 份 |
| 每次发版前 | **必须** | 至少保留「发版前那一份」直到下一版本稳定 |
| 长期运行 | 每周一次（Windows 任务计划程序触发 `backup.ps1`） | 最近 4 周 + 每月最后一份 |
| 重要数据 | 手动拷到 U 盘 / 网盘各一份 | 异地，别只放在同一块硬盘上 |

Windows 定时备份示例（每周日 03:00）：

```powershell
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument '-ExecutionPolicy Bypass -File "E:\AICode\cooking\06-devops\scripts\backup.ps1"' `
    -WorkingDirectory 'E:\AICode\cooking'
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 03:00
Register-ScheduledTask -TaskName 'cooking-weekly-backup' -Action $action -Trigger $trigger -Description 'cooking 数据库周备份'
```

---

## 6. 常见故障

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `容器 cooking-mysql 未运行` | 容器停了 | `docker compose -f .\06-devops\docker-compose.yml up -d mysql` |
| 导出的 `db.sql` 小于 100 字节 | 导出失败 | 看备份目录下的 `db.err`；确认 root 口令与数据卷一致 |
| 恢复后后台登录失败 | 恢复的是旧库，管理员账号跟着回滚了 | 用旧账号登录；或用 seeder 重建账号（BE-016） |
| 图片恢复后仍 404 | 后端静态目录没指向 `uploads` | 确认 `.env` 的 `UPLOAD_DIR` 与 docker-compose 挂载一致 |
| `Access denied` | root 口令与卷内不一致 | 见 deploy.md 的「改了 .env 密码」处理办法 |
