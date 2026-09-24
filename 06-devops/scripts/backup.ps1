<#
.SYNOPSIS
    cooking 数据备份脚本（OPS-011）

.DESCRIPTION
    产出一份「可直接恢复」的完整备份到 06-devops/backups/<时间戳>/：
      - db.sql        MySQL 全量逻辑备份（mysqldump，容器模式不用本机装 mysql 客户端）
      - uploads.zip   菜品图片目录（存在且非空时才打）
      - meta.json     备份元信息（时间、库名、来源、大小、git 提交号），便于事后核对
    保留策略：默认保留最近 10 份（-Keep 调整），其余自动清理。

.PARAMETER OutDir
    备份输出根目录，默认 06-devops/backups（已被 .gitignore 忽略）。

.PARAMETER Native
    备份本机直装的 MySQL（用 mysqldump 可执行文件），默认是容器模式。

.PARAMETER MysqldumpPath
    -Native 模式下 mysqldump 的路径，默认从 PATH 找。

.PARAMETER Keep
    保留份数，默认 10。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\backup.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\backup.ps1 -Keep 20 -OutDir D:\backup\cooking
#>

[CmdletBinding()]
param(
    [string]$OutDir,
    [switch]$Native,
    [string]$MysqldumpPath = 'mysqldump',
    [int]$Keep = 10
)

$ErrorActionPreference = 'Stop'

$Root        = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$OpsEnv      = Join-Path $Root '06-devops/.env'
$ServerEnv   = Join-Path $Root '04-backend/server/.env'
$UploadDir   = Join-Path $Root '04-backend/server/uploads'
$Container   = 'cooking-mysql'
if (-not $OutDir) { $OutDir = Join-Path $Root '06-devops/backups' }
Set-Location $Root

# 公共工具：Invoke-Docker（绕开 PS 5.1 把 docker 的 stderr 当致命错误的坑）、Get-EnvValue、Hide-Secret……
. (Join-Path $PSScriptRoot 'ops-common.ps1')

function Write-Step { param($m) Write-Host "[backup] $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "[backup] $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "[backup] $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "[backup] $m" -ForegroundColor Red }

function Get-SizeText([long]$bytes) {
    if ($bytes -ge 1GB) { return ('{0:N2} GB' -f ($bytes / 1GB)) }
    if ($bytes -ge 1MB) { return ('{0:N2} MB' -f ($bytes / 1MB)) }
    if ($bytes -ge 1KB) { return ('{0:N2} KB' -f ($bytes / 1KB)) }
    return "$bytes B"
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " cooking 数据备份（OPS-011）" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------
# 1. 配置
# ------------------------------------------------------------------
$envSource = if (Test-Path $OpsEnv) { $OpsEnv } else { $ServerEnv }
if (-not (Test-Path $envSource)) {
    Write-Err "找不到 .env（$OpsEnv），请先执行 init-env.ps1。"
    exit 1
}
$dbName  = Get-EnvValue $envSource 'DB_NAME';   if (-not $dbName)  { $dbName = 'cooking' }
$rootPwd = Get-EnvValue $envSource 'MYSQL_ROOT_PASSWORD'
$dbHost  = Get-EnvValue $envSource 'DB_HOST';   if (-not $dbHost)  { $dbHost = '127.0.0.1' }
$dbPort  = Get-EnvValue $envSource 'DB_PORT';   if (-not $dbPort)  { $dbPort = '3307' }
if (-not $rootPwd) {
    Write-Err ".env 缺少 MYSQL_ROOT_PASSWORD。"
    exit 1
}

$stamp    = Get-Date -Format 'yyyyMMdd-HHmmss'
$destDir  = Join-Path $OutDir $stamp
New-Item -ItemType Directory -Path $destDir -Force | Out-Null
$sqlFile  = Join-Path $destDir 'db.sql'
$zipFile  = Join-Path $destDir 'uploads.zip'
Write-Step ("备份目录：" + $destDir)

# ------------------------------------------------------------------
# 2. 数据库备份
# --single-transaction 保证不锁表；--routines/--triggers 防止漏掉存储过程与触发器
# ------------------------------------------------------------------
Write-Step "导出数据库 $dbName ..."
if ($Native) {
    Write-Host "        模式：本机 mysqldump（$MysqldumpPath）" -ForegroundColor DarkGray
    $dumpArgs = "-h $dbHost -P $dbPort -u root --single-transaction --routines --triggers --default-character-set=utf8mb4 --databases $dbName"
    # cmd.exe 重定向保证字节级原样落盘；PowerShell 管道会二次编码，容易把中文或二进制弄坏
    Invoke-Native -Exe 'cmd.exe' -Arguments @('/c', "set MYSQL_PWD=$rootPwd && `"$MysqldumpPath`" $dumpArgs > `"$sqlFile`" 2> `"$destDir\db.err`"")
    $code = $LASTEXITCODE
}
else {
    Write-Host "        模式：容器内 mysqldump（$Container）" -ForegroundColor DarkGray
    if (-not (Test-DockerDaemon)) { Write-Err "Docker 守护进程未运行，请先启动 Docker Desktop。"; exit 1 }
    if ((Get-DockerContainer) -notcontains $Container) {
        Write-Err "容器 $Container 未运行，先启动：docker compose -f .\06-devops\docker-compose.yml up -d mysql"
        exit 1
    }
    Invoke-Native -Exe 'cmd.exe' -Arguments @('/c', "docker exec -e MYSQL_PWD=$rootPwd $Container mysqldump -uroot --single-transaction --routines --triggers --default-character-set=utf8mb4 --databases $dbName > `"$sqlFile`" 2> `"$destDir\db.err`"")
    $code = $LASTEXITCODE
}

if ($code -ne 0 -or -not (Test-Path $sqlFile) -or (Get-Item $sqlFile -ErrorAction SilentlyContinue).Length -lt 100) {
    Write-Err "数据库导出失败（exit $code）。查看错误：$destDir\db.err"
    exit 2
}
Write-Ok ("数据库导出完成：" + (Get-SizeText (Get-Item $sqlFile).Length))
Remove-Item (Join-Path $destDir 'db.err') -ErrorAction SilentlyContinue

# ------------------------------------------------------------------
# 3. 图片目录备份
# ------------------------------------------------------------------
$hasUploads = $false
if (Test-Path $UploadDir) {
    $files = @(Get-ChildItem $UploadDir -Recurse -File -ErrorAction SilentlyContinue)
    if ($files.Count -gt 0) {
        Write-Step ("打包图片目录（{0} 个文件）..." -f $files.Count)
        Compress-Archive -Path (Join-Path $UploadDir '*') -DestinationPath $zipFile -CompressionLevel Optimal -Force
        Write-Ok ("图片打包完成：" + (Get-SizeText (Get-Item $zipFile).Length)) -ForegroundColor Green
        $hasUploads = $true
    }
}
if (-not $hasUploads) { Write-Warn "uploads 目录为空或不存在（BE-012 上传功能上线后才有内容），已跳过。" }

# ------------------------------------------------------------------
# 4. 元信息
# ------------------------------------------------------------------
$gitCommit = $null
$gitExe = Ensure-GitInPath
if ($gitExe) {
    $rev = Invoke-Native -Exe $gitExe -Arguments @('rev-parse', '--short', 'HEAD')
    # 仓库还没有首次提交时 git 会报 "Needed a single revision"，属正常情况，留空即可
    if ($LASTEXITCODE -eq 0 -and $rev) { $gitCommit = ($rev | Select-Object -First 1).Trim() }
}
$meta = [ordered]@{
    createdAt    = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    database     = $dbName
    mode         = if ($Native) { 'native' } else { 'docker-container' }
    mysqlPort    = $dbPort
    sqlSize      = (Get-Item $sqlFile).Length
    sqlName      = 'db.sql'
    hasUploads   = $hasUploads
    gitCommit    = $gitCommit
    restoreCmd   = "powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\restore.ps1 -From `"$destDir`""
}
# 同样用 UTF-8 无 BOM 写，避免某些 JSON 解析器把首字符的 BOM 当成正文报错
[System.IO.File]::WriteAllText((Join-Path $destDir 'meta.json'), ($meta | ConvertTo-Json -Depth 4), (New-Object System.Text.UTF8Encoding($false)))

# ------------------------------------------------------------------
# 5. 保留策略
# ------------------------------------------------------------------
$old = @(Get-ChildItem $OutDir -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -Skip $Keep)
if ($old.Count -gt 0) {
    Write-Step ("清理旧备份（保留最近 $Keep 份），共 {0} 份待删..." -f $old.Count)
    foreach ($d in $old) { Remove-Item $d.FullName -Recurse -Force -ErrorAction SilentlyContinue }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 备份完成" -ForegroundColor Cyan
Write-Host "------------------------------------------" -ForegroundColor Cyan
Write-Host ("   目录      " + $destDir)
Write-Host ("   数据库    db.sql  " + (Get-SizeText (Get-Item $sqlFile).Length))
if ($hasUploads) { Write-Host ("   图片      uploads.zip  " + (Get-SizeText (Get-Item $zipFile).Length)) }
Write-Host ("   恢复命令  powershell -ExecutionPolicy Bypass -File .\\06-devops\\scripts\\restore.ps1 -From `"" + $destDir + "`"")
Write-Host "------------------------------------------" -ForegroundColor Cyan
Write-Host " 建议：重要节点（版本上线前）额外把最新一份拷到机器外的 U 盘 / 网盘。" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
