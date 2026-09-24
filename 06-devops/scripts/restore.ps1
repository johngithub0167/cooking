<#
.SYNOPSIS
    cooking 数据恢复脚本（OPS-011）

.DESCRIPTION
    从 backup.ps1 产出的备份目录（或某个 .sql 文件）恢复：
      1. db.sql  ->  容器/本机 MySQL（不会删库，只是重灌表结构与数据，缺失的表会重建）
      2. uploads.zip  ->  04-backend/server/uploads（同名文件覆盖）
    默认会先列出恢复对象并要求二次确认，脚本化调用请加 -Yes。

    ⚠ 恢复会覆盖现有数据。生产环境执行前务必先跑一次 backup.ps1 留今天的后路。

.PARAMETER From
    备份目录（含 db.sql / meta.json）或 .sql 文件路径，必填。

.PARAMETER SkipUploads
    只恢复数据库，不动图片目录。

.PARAMETER UploadsOnly
    只恢复图片目录，不动数据库。

.PARAMETER Native
    恢复到本机直装的 MySQL（用 mysql 客户端），默认容器模式。

.PARAMETER MysqlPath
    -Native 模式下 mysql 客户端路径，默认从 PATH 找。

.PARAMETER Yes
    跳过交互式确认（CI / 无人值守时用）。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\restore.ps1 -From .\06-devops\backups\20260924-101500

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\restore.ps1 -From .\06-devops\backups\20260924-101500 -SkipUploads -Yes
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$From,
    [switch]$SkipUploads,
    [switch]$UploadsOnly,
    [switch]$Native,
    [string]$MysqlPath = 'mysql',
    [switch]$Yes
)

$ErrorActionPreference = 'Stop'

$Root      = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$OpsEnv    = Join-Path $Root '06-devops/.env'
$ServerEnv = Join-Path $Root '04-backend/server/.env'
$UploadDir = Join-Path $Root '04-backend/server/uploads'
$Container = 'cooking-mysql'
Set-Location $Root

# 公共工具：Invoke-Docker（绕开 PS 5.1 把 docker 的 stderr 当致命错误的坑）、Get-EnvValue、Hide-Secret……
. (Join-Path $PSScriptRoot 'ops-common.ps1')

function Write-Step { param($m) Write-Host "[restore] $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "[restore] $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "[restore] $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "[restore] $m" -ForegroundColor Red }

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " cooking 数据恢复（OPS-011）" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------
# 1. 定位备份内容
# ------------------------------------------------------------------
$candidate = Join-Path $Root $From
if (-not (Test-Path $candidate)) { $candidate = $From }
if (-not (Test-Path $candidate)) {
    Write-Err "找不到备份路径：$From"
    exit 1
}

if ((Get-Item $candidate).PSIsContainer) {
    $backupDir = $candidate
    $sqlFiles = @(Get-ChildItem $backupDir -Filter '*.sql' -File | Sort-Object Name -Descending)
    if ($sqlFiles.Count -eq 0) {
        Write-Err "备份目录里没有 .sql 文件：$backupDir"
        exit 1
    }
    $sqlFile = $sqlFiles[0].FullName
    $zipFile = Join-Path $backupDir 'uploads.zip'
    if (-not (Test-Path $zipFile)) { $zipFile = $null }
}
else {
    $backupDir = Split-Path -Parent $candidate
    $sqlFile   = $candidate
    $zipFile   = $null
}

$metaFile = Join-Path $backupDir 'meta.json'
if (Test-Path $metaFile) {
    $meta = Get-Content $metaFile -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-Step ("备份信息：创建于 {0} / 库 {1} / 模式 {2}" -f $meta.createdAt, $meta.database, $meta.mode)
}
Write-Host ("   SQL      " + $sqlFile) -ForegroundColor White
Write-Host ("   大小     " + [math]::Round((Get-Item $sqlFile).Length / 1KB, 1) + " KB") -ForegroundColor White
if ($zipFile) { Write-Host ("   图片     " + $zipFile) -ForegroundColor White } else { Write-Host "   图片     备份中没有 uploads.zip" -ForegroundColor DarkGray }
Write-Host ""

if (-not $Yes) {
    Write-Warn "恢复会覆盖当前数据库中的同名表，图片目录同名文件也会被替换。"
    $ans = Read-Host "确认继续请输入 yes（其它任意输入则取消）"
    if ($ans -ne 'yes') {
        Write-Host "[restore] 已取消，未做任何改动。" -ForegroundColor Yellow
        exit 0
    }
}

# ------------------------------------------------------------------
# 2. 读取配置
# ------------------------------------------------------------------
$envSource = if (Test-Path $OpsEnv) { $OpsEnv } else { $ServerEnv }
if (-not (Test-Path $envSource)) { Write-Err "找不到 .env，请先执行 init-env.ps1。"; exit 1 }
$dbName  = Get-EnvValue $envSource 'DB_NAME';  if (-not $dbName) { $dbName = 'cooking' }
$rootPwd = Get-EnvValue $envSource 'MYSQL_ROOT_PASSWORD'
$dbHost  = Get-EnvValue $envSource 'DB_HOST';  if (-not $dbHost) { $dbHost = '127.0.0.1' }
$dbPort  = Get-EnvValue $envSource 'DB_PORT';  if (-not $dbPort) { $dbPort = '3307' }
if (-not $rootPwd) { Write-Err ".env 缺少 MYSQL_ROOT_PASSWORD。"; exit 1 }

# ------------------------------------------------------------------
# 3. 恢复数据库
# ------------------------------------------------------------------
if (-not $UploadsOnly) {
    Write-Step "导入数据库 $dbName ..."
    if ($Native) {
        Invoke-Native -Exe 'cmd.exe' -Arguments @('/c', "set MYSQL_PWD=$rootPwd && `"$MysqlPath`" -h $dbHost -P $dbPort -u root --default-character-set=utf8mb4 < `"$sqlFile`"")
        $code = $LASTEXITCODE
    }
    else {
        if (-not (Test-DockerDaemon)) { Write-Err "Docker 守护进程未运行，请先启动 Docker Desktop。"; exit 1 }
        if ((Get-DockerContainer) -notcontains $Container) {
            Write-Err "容器 $Container 未运行，先启动：docker compose -f .\06-devops\docker-compose.yml up -d mysql"
            exit 1
        }
        # mysql 客户端在 docker exec 里读 stdin，用 cmd 重定向保证字节级一致
        Invoke-Native -Exe 'cmd.exe' -Arguments @('/c', "docker exec -i -e MYSQL_PWD=$rootPwd $Container mysql -uroot --default-character-set=utf8mb4 < `"$sqlFile`"")
        $code = $LASTEXITCODE
    }

    if ($code -ne 0) {
        Write-Err "数据库导入失败（exit $code）。常见原因：备份文件损坏、字符集冲突、磁盘空间不足。"
        exit 2
    }
    Write-Ok "数据库导入完成。"

    Write-Step "校验恢复结果..."
    if ($Native) {
        $tables = Invoke-Native -Exe 'cmd.exe' -Arguments @('/c', "set MYSQL_PWD=$rootPwd && `"$MysqlPath`" -h $dbHost -P $dbPort -u root -N -B -e `"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$dbName';`"")
    }
    else {
        $tables = Invoke-Docker -Arguments @('exec', '-e', "MYSQL_PWD=$rootPwd", $Container, 'mysql', '-uroot', '-N', '-B', '-e', "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$dbName';") -Quiet
    }
    Write-Host ("        库 $dbName 现有表数量：" + ($tables | Out-String).Trim()) -ForegroundColor DarkGray
}

# ------------------------------------------------------------------
# 4. 恢复图片
# ------------------------------------------------------------------
if (-not $SkipUploads -and $zipFile -and (Test-Path $zipFile)) {
    Write-Step "解压图片到 $UploadDir ..."
    if (-not (Test-Path $UploadDir)) { New-Item -ItemType Directory -Path $UploadDir -Force | Out-Null }
    # 临时目录 + 移动，避免解压直接覆盖导致中途失败留下半成品
    $tmp = Join-Path $env:TEMP ('cooking-restore-' + [System.Guid]::NewGuid().ToString('N').Substring(0, 8))
    Expand-Archive -Path $zipFile -DestinationPath $tmp -Force
    Copy-Item (Join-Path $tmp '*') $UploadDir -Recurse -Force
    Remove-Item $tmp -Recurse -Force
    $cnt = @(Get-ChildItem $UploadDir -Recurse -File -ErrorAction SilentlyContinue).Count
    Write-Ok ("图片恢复完成，当前 uploads 共 {0} 个文件。" -f $cnt)
}
elseif (-not $SkipUploads) {
    Write-Warn "备份中没有 uploads.zip，跳过图片恢复。"
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 恢复完成" -ForegroundColor Cyan
Write-Host "------------------------------------------" -ForegroundColor Cyan
Write-Host " 下一步建议："
Write-Host "   1. 跑自检：powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\db-check.ps1"
Write-Host "   2. 重启后端使连接重建：powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\start-dev.ps1"
Write-Host "   3. 后台登录页验证账号可用（若恢复的是旧库，账号是旧的那份）"
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
