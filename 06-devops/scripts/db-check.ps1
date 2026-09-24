<#
.SYNOPSIS
    cooking 数据库连通性自检（OPS-004 配套）

.DESCRIPTION
    一条命令确认「数据库到底能不能连、库在不在、业务账号通不通」，排查后端连不上时的第一站：
      1. 容器是否运行 / 健康（healthcheck 用 mysqladmin ping）
      2. 宿主机映射端口是否监听（默认 3307）
      3. cooking 库是否存在，不存在则按需建库（utf8mb4）
      4. 业务账号（MYSQL_USER / MYSQL_PASSWORD）是否有库权限
      5. 打印后端应该用的连接参数（密码自动打码）

.PARAMETER CreateDb
    库不存在时自动建库（CREATE DATABASE cooking CHARACTER SET utf8mb4）。

.PARAMETER Wait
    容器还在初始化时等待健康，最多 -TimeoutSec 秒。

.PARAMETER TimeoutSec
    等待超时秒数，默认 90。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\db-check.ps1 -Wait -CreateDb
#>

[CmdletBinding()]
param(
    [switch]$CreateDb,
    [switch]$Wait,
    [int]$TimeoutSec = 90
)

$ErrorActionPreference = 'Stop'

$Root        = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ComposeFile = Join-Path $Root '06-devops/docker-compose.yml'
$OpsEnv      = Join-Path $Root '06-devops/.env'
$ServerEnv   = Join-Path $Root '04-backend/server/.env'
$Container   = 'cooking-mysql'
Set-Location $Root

# 公共工具：Invoke-Docker（绕开 PS 5.1 把 docker 的 stderr 当致命错误的坑）、Get-EnvValue、Hide-Secret……
. (Join-Path $PSScriptRoot 'ops-common.ps1')

function Write-Step { param($m) Write-Host "[db-check] $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "[db-check] $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "[db-check] $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "[db-check] $m" -ForegroundColor Red }

function Ensure-MysqlContainer {
    # 容器没起来就拉起来；返回 $true / $false 表示最终是否在跑
    $argList = @('compose', '-f', $ComposeFile, '--env-file', $OpsEnv, 'up', '-d', 'mysql')
    Invoke-Docker -Arguments $argList | Out-Null
    Start-Sleep -Seconds 3
    return ((Get-DockerContainer) -contains $Container)
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " cooking 数据库自检（OPS-004）" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------
# 1. 读取配置（优先 06-devops/.env）
# ------------------------------------------------------------------
if (-not (Test-Path $OpsEnv) -and -not (Test-Path $ServerEnv)) {
    Write-Err "找不到 06-devops/.env 或 04-backend/server/.env，请先执行："
    Write-Host "        powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\init-env.ps1"
    exit 1
}

$envSource = if (Test-Path $OpsEnv) { $OpsEnv } else { $ServerEnv }
$dbName  = Get-EnvValue $envSource 'DB_NAME';       if (-not $dbName)  { $dbName = 'cooking' }
$dbUser  = Get-EnvValue $envSource 'MYSQL_USER';    if (-not $dbUser)  { $dbUser = 'cooking' }
$dbPass  = Get-EnvValue $envSource 'MYSQL_PASSWORD'
$rootPwd = Get-EnvValue $envSource 'MYSQL_ROOT_PASSWORD'
$hostPort= Get-EnvValue $envSource 'DB_PORT';       if (-not $hostPort){ $hostPort = '3307' }
Write-Step ("配置来源：" + $envSource.Replace($Root + '\', ''))
Write-Host ("        库名 {0} / 业务账号 {1} / 密码 {2} / 宿主机端口 {3}" -f $dbName, $dbUser, (Hide-Secret $dbPass), $hostPort) -ForegroundColor DarkGray

if (-not $dbPass -or -not $rootPwd) {
    Write-Err ".env 里缺少 MYSQL_PASSWORD 或 MYSQL_ROOT_PASSWORD（常见原因：直接复制模板没跑 init-env.ps1）。"
    exit 1
}

# ------------------------------------------------------------------
# 2. Docker 与容器状态
# ------------------------------------------------------------------
Write-Step "检查 Docker 与容器 $Container ..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Err "未检测到 docker。本机 MySQL 自建方案见 06-devops/deploy.md。"
    exit 1
}
if (-not (Test-DockerDaemon)) {
    Write-Err "Docker 守护进程未运行，请先启动 Docker Desktop。"
    exit 1
}

if ((Get-DockerContainer) -contains $Container) {
    Write-Ok "容器已在运行。"
}
else {
    if ((Get-DockerContainer -All) -contains $Container) {
        Write-Warn "容器存在但未运行，正在启动（docker compose up -d mysql）..."
    }
    else {
        Write-Warn "尚未创建容器，正在创建并启动（首次需拉取 mysql:8.0 镜像，可能较慢）..."
    }
    if (-not (Ensure-MysqlContainer)) {
        Write-Err "容器启动失败。看日志：docker compose -f .\06-devops\docker-compose.yml logs --tail 100 mysql"
        exit 1
    }
    Write-Ok "容器已启动。"
}

if ($Wait) {
    Write-Step "等待健康检查通过（最多 $TimeoutSec 秒）..."
    $ok = $false
    for ($i = 0; $i -lt ($TimeoutSec / 3); $i++) {
        Start-Sleep -Seconds 3
        $hc = Invoke-Docker -Arguments @('inspect', '-f', '{{.State.Health.Status}}', $Container) -Quiet
        if ($hc -eq 'healthy') { $ok = $true; break }
    }
    if (-not $ok) { Write-Warn "等待超时，容器仍未 healthy（首次初始化要 1~2 分钟属正常，可重试 -Wait）。" }
}
$hcNow = Invoke-Docker -Arguments @('inspect', '-f', '{{.State.Health.Status}}', $Container) -Quiet
Write-Host ("        容器健康状态：" + $hcNow) -ForegroundColor DarkGray

if ((Get-NetTCPConnection -LocalPort ([int]$hostPort) -State Listen -ErrorAction SilentlyContinue)) {
    Write-Ok "宿主机端口 $hostPort 已监听（Node 进程用 DB_HOST=127.0.0.1 / DB_PORT=$hostPort 连它）。"
}
else {
    Write-Warn "宿主机端口 $hostPort 未监听，检查 docker-compose.yml 的 ports 映射。"
}

# ------------------------------------------------------------------
# 3. 容器内查询（tools：mysql / mysqladmin 镜像自带）
# ------------------------------------------------------------------
Write-Step "容器内查看数据库列表..."
$databases = Invoke-Docker -Arguments @('exec', '-e', "MYSQL_PWD=$rootPwd", $Container, 'mysql', '-uroot', '-N', '-B', '-e', 'SHOW DATABASES;') -Quiet
if ($LASTEXITCODE -ne 0) {
    Write-Err "root 登录容器内 MySQL 失败。若刚改过 .env 密码，已有数据卷不会跟着变，需要删卷重建：docker compose down -v && docker compose up -d mysql"
    exit 2
}
$dbList = @($databases | Where-Object { $_ -and $_ -notmatch '^(information_schema|mysql|performance_schema|sys)$' })
Write-Host ("        业务库：" + ($dbList -join ', ')) -ForegroundColor DarkGray

if ($dbList -notcontains $dbName) {
    if ($CreateDb) {
        Write-Step "建库 $dbName（utf8mb4）..."
        $createSql = "CREATE DATABASE IF NOT EXISTS $dbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        $grantSql  = "GRANT ALL PRIVILEGES ON $dbName.* TO '$dbUser'@'%'; FLUSH PRIVILEGES;"
        Invoke-Docker -Arguments @('exec', '-e', "MYSQL_PWD=$rootPwd", $Container, 'mysql', '-uroot', '-e', $createSql) -Quiet | Out-Null
        Invoke-Docker -Arguments @('exec', '-e', "MYSQL_PWD=$rootPwd", $Container, 'mysql', '-uroot', '-e', $grantSql) -Quiet | Out-Null
        Write-Ok "已建库并给 $dbUser 授权。"
    }
    else {
        Write-Warn "库 $dbName 不存在。加 -CreateDb 自动建库，或用备份恢复：.\06-devops\scripts\restore.ps1"
    }
}
else {
    Write-Ok "库 $dbName 已存在。"
}

# ------------------------------------------------------------------
# 4. 业务账号连通性（后端实际用的账号）
# ------------------------------------------------------------------
Write-Step "用业务账号 $dbUser 验证连接..."
$version = Invoke-Docker -Arguments @('exec', '-e', "MYSQL_PWD=$dbPass", $Container, 'mysql', '-u', $dbUser, '-N', '-B', '-e', 'SELECT VERSION();') -Quiet
if ($LASTEXITCODE -eq 0 -and $version) {
    Write-Ok "业务账号登录成功，MySQL 版本：$version"
}
else {
    Write-Err "业务账号登录失败。核对 .env 中 MYSQL_USER / MYSQL_PASSWORD 与数据卷内的实际账号是否一致。"
    Write-Host "        账号是在数据卷首次初始化时创建的；改 .env 不会变更已有卷，需 down -v 重建。"
    exit 3
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 后端连接参数（写在 .env 里）："
Write-Host "   本机 Node 运行： DB_HOST=127.0.0.1  DB_PORT=$hostPort  DB_USER=$dbUser  DB_PASSWORD=$(Hide-Secret $dbPass)  DB_NAME=$dbName"
Write-Host "   容器内运行：   DB_HOST=mysql      DB_PORT=3306     （compose 已自动覆盖，无需改 .env）"
Write-Host " 常用命令："
Write-Host "   进入 mysql：  docker exec -it $Container mysql -uroot -p"
Write-Host "   看容器日志：  docker compose -f .\06-devops\docker-compose.yml logs --tail 100 mysql"
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
