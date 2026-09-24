<#
.SYNOPSIS
    cooking 本机真实配置生成脚本（OPS-002 / OPS-004 配套）

.DESCRIPTION
    以 06-devops/.env.example 为模板，生成本机真实配置 06-devops/.env：
      1. 自动生成随机强口令：MYSQL_ROOT_PASSWORD / MYSQL_PASSWORD（= DB_PASSWORD）/ JWT_SECRET / ADMIN_DEFAULT_PASSWORD
      2. 默认按 Docker Compose 场景写入 DB_PORT=3307（容器映射端口）；本机直连 MySQL 加 -NativeDb 写 3306
      3. 同步生成 04-backend/server/.env（后端 dotenv 实际读取的那份）
    生成物均已被 .gitignore 忽略，不会进 Git。脚本幂等：已存在则跳过，-Force 才会覆盖重建。

.PARAMETER Force
    已存在 06-devops/.env 时也重新生成（会覆盖已有真实密码，请谨慎）。

.PARAMETER NativeDb
    使用本机 MySQL（3306）而非 Docker 容器映射端口（3307）。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\init-env.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\init-env.ps1 -Force -NativeDb
#>

[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$NativeDb
)

$ErrorActionPreference = 'Stop'

# 仓库根目录：06-devops/scripts -> 06-devops -> 根目录
$Root    = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$OpsDir  = Join-Path $Root '06-devops'
$TplFile = Join-Path $OpsDir '.env.example'
$EnvFile = Join-Path $OpsDir '.env'
$ServerDir = Join-Path $Root '04-backend/server'
$ServerEnv = Join-Path $ServerDir '.env'

Set-Location $Root

function Write-Step { param($m) Write-Host "[init-env] $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "[init-env] $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "[init-env] $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "[init-env] $m" -ForegroundColor Red }

# 生成 URL / shell 安全的随机串（仅大小写字母与数字，避免 special chars 在 compose / mysql 里被转义出错）
function New-RandomSecret([int]$Length = 32) {
    try {
        $bytes = New-Object 'byte[]' 64
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($bytes)
        $rng.Dispose()
        $s = [Convert]::ToBase64String($bytes) -replace '[^a-zA-Z0-9]', ''
    }
    catch {
        $s = ''
    }
    while ($s.Length -lt $Length) { $s += ([System.Guid]::NewGuid().ToString('N')) }
    return $s.Substring(0, $Length)
}

if (-not (Test-Path $TplFile)) {
    Write-Err "模板不存在：$TplFile"
    exit 1
}

if ((Test-Path $EnvFile) -and -not $Force) {
    Write-Warn "06-devops/.env 已存在，跳过生成（如需重建请加 -Force）。"
    if (Test-Path $ServerEnv) {
        Write-Host ("        后端配置已就绪：" + $ServerEnv) -ForegroundColor DarkGray
    }
    exit 0
}

Write-Step "从模板生成：$EnvFile"

# ------------------------------------------------------------------
# 生成随机密钥（真实值只落在这两个未被 Git 跟踪的文件里）
# ------------------------------------------------------------------
$mysqlRootPwd = New-RandomSecret 32
$appPwd       = New-RandomSecret 32
$jwtSecret    = New-RandomSecret 48
$adminPwd     = New-RandomSecret 16

$targetPort = if ($NativeDb) { '3306' } else { '3307' }

$overrides = @{
    'DB_PORT'                = $targetPort
    'DB_PASSWORD'            = $appPwd
    'MYSQL_ROOT_PASSWORD'    = $mysqlRootPwd
    'MYSQL_PASSWORD'         = $appPwd
    'MYSQL_DATABASE'         = 'cooking'
    'MYSQL_USER'             = 'cooking'
    'DB_NAME'                = 'cooking'
    'DB_USER'                = 'cooking'
    'JWT_SECRET'             = $jwtSecret
    'ADMIN_DEFAULT_PASSWORD' = $adminPwd
}

# 逐行处理模板：命中 KEY= 的行替换新值，其余原样保留（注释不丢）
$out = New-Object System.Collections.Generic.List[string]
$hit = @{}
foreach ($line in (Get-Content -Path $TplFile -Encoding UTF8)) {
    $replaced = $false
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
        $key = $Matches[1]
        if ($overrides.ContainsKey($key)) {
            $out.Add("$key=$($overrides[$key])")
            $hit[$key] = $true
            $replaced = $true
        }
    }
    if (-not $replaced) { $out.Add($line) }
}

# 模板里没写到的键（例如有人精简过模板）补在末尾，保证 compose 不会因缺变量而启动失败
foreach ($key in $overrides.Keys) {
    if (-not $hit.ContainsKey($key)) {
        Write-Warn "模板中缺少变量 $key，已追加到文件末尾。"
        $out.Add("$key=$($overrides[$key])")
    }
}

# 关键：UTF-8 不带 BOM。带 BOM 会让 dotenv 把第一行 KEY 名解析成 "锘?EF...KEY"，导致取不到值
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($EnvFile, $out, $utf8NoBom)
Write-Ok "已生成 $EnvFile（UTF-8 无 BOM）"

# ------------------------------------------------------------------
# 同步到后端目录
# ------------------------------------------------------------------
if (-not (Test-Path $ServerDir)) {
    New-Item -ItemType Directory -Path $ServerDir -Force | Out-Null
    Write-Warn "04-backend/server 不存在，已创建空目录（后端工程由 BE-001 初始化）。"
}
Copy-Item $EnvFile $ServerEnv -Force
Write-Ok "已同步到 $ServerEnv"

# ------------------------------------------------------------------
# 结果提示（只提示，不回显明文，避免屏幕 / 终端日志泄露）
# ------------------------------------------------------------------
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 本机真实配置已就绪（均已被 .gitignore 忽略）" -ForegroundColor Cyan
Write-Host "------------------------------------------" -ForegroundColor Cyan
Write-Host ("   06-devops/.env          Docker Compose 与后端配置来源（DB_PORT={0}）" -f $targetPort)
Write-Host "   04-backend/server/.env  后端 dotenv 实际读取（同内容副本）"
Write-Host "   随机生成：MYSQL_ROOT_PASSWORD / MYSQL_PASSWORD / DB_PASSWORD / JWT_SECRET / ADMIN_DEFAULT_PASSWORD"
Write-Host "------------------------------------------" -ForegroundColor Cyan
Write-Host " 查看某项明文（自行执行）："
Write-Host "   (Get-Content .\\06-devops\\.env | Select-String '^ADMIN_DEFAULT_PASSWORD=').Line"
Write-Host " 启动数据库：docker compose -f .\\06-devops\\docker-compose.yml up -d mysql"
Write-Host " 或一条命令：powershell -ExecutionPolicy Bypass -File .\\06-devops\\scripts\\start-dev.ps1 -WithDocker"
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Warn "提醒：上面生成的随机口令只在本地 .env 里，丢失后只能重生成（会导致已有容器密码对不上），请勿随手删除。"
