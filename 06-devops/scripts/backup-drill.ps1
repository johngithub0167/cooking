<#
.SYNOPSIS
    cooking 备份/恢复演练脚本（OPS-011 的「每季度必做演练」自动化版）

.DESCRIPTION
    真的走一遍完整链路，而不是看文档脑补：
      1. 在业务库里建一张演练表 _ops_drill，塞一行「中文 + 英文」的样本数据
      2. 调用正式的 backup.ps1 做一次全量备份（输出到临时目录，不占用正式备份配额）
      3. 把演练表 DROP 掉（模拟数据丢失）
      4. 调用正式的 restore.ps1 从刚才那份备份恢复
      5. 核对恢复回来的字节是否与原始样本完全一致（用 HEX() 比对，中文一个字节都不能错）
      6. 清理：删演练表、删演练备份

    全程不碰真实业务表：mysqldump --databases 产出的备份只重建备份时刻存在的表，
    不会 DROP 备份之后新建的表，所以对已有数据无害。

    任何一步失败都会留下现场（演练表/备份目录）便于排查，并输出 FAIL 摘要与非 0 退出码。

.PARAMETER KeepBackup
    保留本次演练产生的备份目录，便于人工翻看（默认演练结束即删除）。

.PARAMETER OutDir
    演练备份的输出根目录，默认 %TEMP%\cooking-backup-drill。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\backup-drill.ps1

.EXAMPLE
    npm run db:drill
#>

[CmdletBinding()]
param(
    [switch]$KeepBackup,
    [string]$OutDir
)

$ErrorActionPreference = 'Stop'

$Root      = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$OpsEnv    = Join-Path $Root '06-devops/.env'
$ServerEnv = Join-Path $Root '04-backend/server/.env'
$Container = 'cooking-mysql'
$DrillTbl  = '_ops_drill'
if (-not $OutDir) { $OutDir = Join-Path $env:TEMP 'cooking-backup-drill' }
Set-Location $Root

# 公共工具：Invoke-Native（绕开 PS 5.1 把原生命令 stderr 当致命错误的坑）、Get-EnvValue、Hide-Secret
. (Join-Path $PSScriptRoot 'ops-common.ps1')

function Write-Step { param($m) Write-Host "[drill] $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "[drill] $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "[drill] $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "[drill] $m" -ForegroundColor Red }

# 中英混排样本：重点是「有没有被字符集二次编码」——只看肉眼是不可靠的
$sample      = '恢复演练-中文ABC123'
$expectedHex = -join ([System.Text.Encoding]::UTF8.GetBytes($sample) | ForEach-Object { $_.ToString('X2') })

function Invoke-Mysql {
    <# 在容器内执行 mysql 客户端。务必带 --default-character-set=utf8mb4：
       客户端默认按 latin1 解释入参，中文会被二次编码成乱码（本机实测踩过）。 #>
    param([string]$Sql, [switch]$Raw)

    $envArgs = @('exec', '-e', "MYSQL_PWD=$script:rootPwd", $Container, 'mysql', '-uroot', '--default-character-set=utf8mb4')
    if ($Raw) { $envArgs += @('-N', '-B', '-e', $Sql) } else { $envArgs += @('-e', $Sql) }
    $out = @(Invoke-Docker -Arguments $envArgs -Quiet | Where-Object { $null -ne $_ })

    # docker exec 未分配 TTY 时会把容器内 stderr 并进 stdout，SQL 报错不会体现在退出码里，
    # 只会混在输出行里 —— 这里显式挑出来，避免「看起来执行了，其实报错了」。
    $errLine = $out | Where-Object { $_ -match '^ERROR ' } | Select-Object -First 1
    if ($errLine) {
        Write-Err ("SQL 执行失败：" + $errLine)
        Write-Err ("出错语句：" + $Sql)
    }
    return $out
}

$script:rootPwd = $null
$drillDir = $null

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " cooking 备份 / 恢复演练（OPS-011）" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------
# 1. 前置检查
# ------------------------------------------------------------------
Write-Step "检查配置与运行环境..."
$envSource = if (Test-Path $OpsEnv) { $OpsEnv } else { $ServerEnv }
if (-not (Test-Path $envSource)) { Write-Err "找不到 .env（$OpsEnv），请先执行 init-env.ps1。"; exit 1 }
$dbName = Get-EnvValue $envSource 'DB_NAME'; if (-not $dbName) { $dbName = 'cooking' }
$script:rootPwd = Get-EnvValue $envSource 'MYSQL_ROOT_PASSWORD'
if (-not $script:rootPwd) { Write-Err ".env 缺少 MYSQL_ROOT_PASSWORD。"; exit 1 }
Write-Host ("        库 {0} / root 口令 {1}" -f $dbName, (Hide-Secret $script:rootPwd)) -ForegroundColor DarkGray

if (-not (Test-DockerDaemon)) { Write-Err "Docker 守护进程未运行，请先启动 Docker Desktop。"; exit 1 }
if ((Get-DockerContainer) -notcontains $Container) {
    Write-Err "容器 $Container 未运行，先启动：npm run db:up"
    exit 1
}
Write-Ok "Docker 与容器 $Container 就绪。"

if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

# ------------------------------------------------------------------
# 2. 造演练数据
# ------------------------------------------------------------------
Write-Step ("写入演练数据到 {0}.{1} ..." -f $dbName, $DrillTbl)
Invoke-Mysql -Sql "CREATE DATABASE IF NOT EXISTS $dbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; DROP TABLE IF EXISTS ${dbName}.${DrillTbl}; CREATE TABLE ${dbName}.${DrillTbl}(id INT PRIMARY KEY, note VARCHAR(64) CHARACTER SET utf8mb4); INSERT INTO ${dbName}.${DrillTbl} VALUES (1,'$sample'),(2,'ops drill');" | Out-Null
# 必须用 @() 包住：函数只输出一行时，$rows 会是「标量字符串」，
# 此时 $rows[0] 取的是第一个字符而不是第一行（PS 字符串可索引），极易误判为解析失败。
$rows = @(Invoke-Mysql -Sql "SELECT id, HEX(note) FROM ${dbName}.${DrillTbl} WHERE id=1;" -Raw)
$first = if ($rows.Count -gt 0) { [string]$rows[0] } else { '' }
$beforeHex = if ($first -match "`t") { ($first -split "`t")[1].Trim() } else { '' }
if ($beforeHex -ne $expectedHex) {
    Write-Err "写入失败或字符集异常：期望 HEX=$expectedHex，实际=$beforeHex"
    Write-Err ("mysql 原始输出：" + ($rows -join ' | '))
    exit 2
}
Write-Ok ("样本写入成功：" + $sample + "（HEX=" + $beforeHex + "）")

# ------------------------------------------------------------------
# 3. 备份（调用正式脚本，顺便把 backup.ps1 本身也验一遍）
# ------------------------------------------------------------------
Write-Step "执行 backup.ps1 ..."
Invoke-Native -Exe 'powershell.exe' -Arguments @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'backup.ps1'), '-OutDir', $OutDir, '-Keep', '5')
$dirs = @(Get-ChildItem $OutDir -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending)
if ($dirs.Count -eq 0 -or -not (Test-Path (Join-Path $dirs[0].FullName 'db.sql'))) {
    Write-Err "backup.ps1 没有产出 db.sql，演练终止。"
    exit 3
}
$drillDir = $dirs[0].FullName
Write-Ok ("备份产出：" + $drillDir)

# ------------------------------------------------------------------
# 4. 删表 + 恢复
# ------------------------------------------------------------------
Write-Step "删除演练表（模拟数据丢失）..."
Invoke-Mysql -Sql "DROP TABLE IF EXISTS ${dbName}.${DrillTbl};" | Out-Null
$left = @(Invoke-Mysql -Sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$dbName' AND table_name='$DrillTbl';" -Raw)
if (($left | Out-String).Trim() -ne '0') { Write-Err "演练表仍未删除，演练终止。"; exit 4 }
Write-Host "        演练表已删除。" -ForegroundColor DarkGray

Write-Step "执行 restore.ps1 恢复..."
Invoke-Native -Exe 'powershell.exe' -Arguments @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'restore.ps1'), '-From', $drillDir, '-SkipUploads', '-Yes')

# ------------------------------------------------------------------
# 5. 字节级校验
# ------------------------------------------------------------------
Write-Step "校验恢复结果..."
$rows = @(Invoke-Mysql -Sql "SELECT id, note, HEX(note) FROM ${dbName}.${DrillTbl} WHERE id=1;" -Raw)
$parts = if ($rows.Count -gt 0) { ([string]$rows[0] -split "`t") } else { @() }
$afterText = if ($parts.Count -ge 2) { $parts[1] } else { '' }
$afterHex  = if ($parts.Count -ge 3) { $parts[2].Trim() } else { '' }

$pass = ($afterHex -eq $expectedHex)
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
if ($pass) {
    Write-Host " 演练通过：备份 → 删除 → 恢复，字节完全一致" -ForegroundColor Green
}
else {
    Write-Host " 演练失败：数据未按预期还原" -ForegroundColor Red
}
Write-Host "------------------------------------------" -ForegroundColor Cyan
Write-Host ("   样本           " + $sample)
Write-Host ("   期望 HEX       " + $expectedHex)
Write-Host ("   恢复后 HEX     " + $afterHex)
Write-Host ("   恢复后文本     " + $afterText)
Write-Host ("   备份目录       " + $drillDir)
Write-Host "------------------------------------------" -ForegroundColor Cyan
Write-Host " 提示：重要的不是 hash 相等，而是这条链路每个季度都真跑一次。" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------
# 6. 清理
# ------------------------------------------------------------------
Write-Step "清理演练痕迹..."
Invoke-Mysql -Sql "DROP TABLE IF EXISTS ${dbName}.${DrillTbl};" | Out-Null
if (-not $KeepBackup) { Remove-Item $drillDir -Recurse -Force -ErrorAction SilentlyContinue }
Write-Ok "演练表已删除；备份目录" + $(if ($KeepBackup) { "按 -KeepBackup 保留。" } else { "已清理。" })

if (-not $pass) { exit 5 }
exit 0
