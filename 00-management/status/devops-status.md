# 运维状态（devops）

> 负责人：运维
> 更新时间：2026-09-24
> 当前任务：OPS-001 ~ OPS-003（已完成）

---

## 一、本次完成

| 任务 | 状态 | 交付物 |
| --- | --- | --- |
| OPS-001 Git 初始化与 `.gitignore` | 已完成（脚本就绪，`git init` 待本机安装 Git 后执行） | `.gitignore`、`.gitattributes`、`06-devops/scripts/git-init.ps1` |
| OPS-002 环境变量模板与说明 | 已完成 | `06-devops/.env.example` |
| OPS-003 本地一键启动脚本 | 已完成（端到端拉起待 BE-001 落地） | `06-devops/scripts/start-dev.ps1`、`start-dev.cmd`、`stop-dev.ps1`、`06-devops/README.md` |

---

## 二、本机环境实测

| 项 | 结果 | 影响 |
| --- | --- | --- |
| OS / Shell | Windows / PowerShell 5.1（RemoteSigned） | 脚本已按 Windows 优先编写 |
| Node / npm | v21.7.3 / 10.5.0 | 非推荐 18/20 LTS，脚本告警不阻断 |
| Git | 未安装 | **OPS-001 的真实 init 未执行**，需先 `winget install --id Git.Git -e` |
| MySQL | 未安装，3306 未监听 | 后端可起但数据库不可用，建议走 Docker（OPS-004） |
| Docker CLI | 存在（`C:\Program Files\Docker\Docker\resources\bin\docker.exe`） | `-WithDocker` 需 Docker Desktop 已启动且有 `docker-compose.yml` |

---

## 三、一条命令启动

```powershell
# 项目根目录执行
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\start-dev.ps1 -WithDocker -WithMobile
```

停止：

```powershell
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\stop-dev.ps1 -WithDocker
```

Git 初始化（安装 Git 后执行）：

```powershell
powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\git-init.ps1 -Commit
```

---

## 四、阻塞与待确认

1. **Git 未安装**：阻塞 OPS-001 的 `git init` 与首次提交（脚本已就绪）。
2. **OPS-004 未落地**：`-WithDocker` 依赖 `06-devops/docker-compose.yml`，当前缺文件会告警跳过。
3. **BE-001 / FE-001 未落地**：后端与前端工程目录为空，`start-dev.ps1` 会提示“尚未初始化”并跳过对应启动；不影响脚本本身可用性。
4. **ARCH-005 未打勾**：本次按已冻结的设计文档执行，最终评审请以用户结论为准。

---

## 五、下一步计划

1. OPS-004：`docker-compose.yml`（MySQL 8 映射 3307 + server 容器 + uploads / mysql-data 卷）。
2. OPS-010：本地部署与启动文档。
3. OPS-011：备份与恢复方案（`mysqldump` + `uploads` 打包）。
4. OPS-012：`07-delivery/release-checklist.md` 发布检查清单。
5. OPS-013：回滚方案。
