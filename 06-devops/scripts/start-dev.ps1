<#
.SYNOPSIS
    cooking 本地一键启动脚本（OPS-003），Windows / PowerShell 环境可用

.DESCRIPTION
    按依赖顺序完成：环境体检 -> 准备 .env -> （可选）拉起 MySQL -> 安装依赖 -> 启动后端 -> 健康检查 -> （可选）启动前端。
    后端 / 前端各自在独立 PowerShell 窗口中运行，关闭对应窗口或执行 stop-dev.ps1 即可停止。

.PARAMETER WithDocker
    用 Docker Compose 拉起 MySQL 8（需先完成 OPS-004 的 06-devops/docker-compose.yml，且 Docker Desktop 已启动）。

.PARAMETER WithMobile
    同时启动 C 端（http://localhost:8080），需 FE-001 已完成 03-frontend/mobile 初始化。

.PARAMETER WithAdmin
    同时启动管理后台（http://localhost:8081），需 FE-002 已完成 03-frontend/admin 初始化。

.PARAMETER SkipInstall
    跳过 npm install（依赖已装好时可加快启动）。

.PARAMETER LegacyOpenSsl
    给子进程设置 NODE_OPTIONS=--openssl-legacy-provider。
    仅当安装依赖或启动时报 ERR_OSSL_EVP_UNSUPPORTED（Node 17+ 运行老 webpack 的常见错误）时才需要。

.PARAMETER NoDb
    完全跳过数据库环节（只跑前后端，或连远端数据库时使用）。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\start-dev.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\start-dev.ps1 -WithDocker -WithMobile
#>

[CmdletBinding()]
param(
    [switch]$WithDocker,
    [switch]$WithMobile,
    [switch]$WithAdmin,
    [switch]$SkipInstall,
    [switch]$LegacyOpenSsl,
    [switch]$NoDb
)

$ErrorActionPreference = 'Stop'

# 仓库根目录：06-devops/scripts -> 06-devops -> 根目录
$Root      = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ServerDir = Join-Path $Root '04-backend/server'
$MobileDir = Join-Path $Root '03-frontend/mobile'
$AdminDir  = Join-Path $Root '03-frontend/admin'
$EnvTpl    = Join-Path $Root '06-devops/.env.example'

Set-Location $Root

# 公共工具：Invoke-Docker（绕开 PS 5.1 把 docker 的 stderr 当致命错误的坑）、Get-EnvValue、Hide-Secret……
. (Join-Path $PSScriptRoot 'ops-common.ps1')

function Write-Step { param($m) Write-Host "[start-dev] $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "[start-dev] $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "[start-dev] $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "[start-dev] $m" -ForegroundColor Red }

# 判断 package.json 中是否存在某个 script
function Test-HasScript([string]$PackageJson, [string]$ScriptName) {
    if (-not (Test-Path $PackageJson)) { return $false }
    try {
        $json = Get-Content -Path $PackageJson -Raw -Encoding UTF8 | ConvertFrom-Json
        if (-not $json.scripts) { return $false }
        return ($json.scripts.PSObject.Properties.Name -contains $ScriptName)
    }
    catch { return $false }
}

# 用 Docker Compose 拉起 MySQL 8（OPS-004），等待健康检查通过后才返回
function Start-DockerMysql {
    $composeFile = Join-Path $Root '06-devops/docker-compose.yml'

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Warn "未检测到 docker 命令，无法拉起 MySQL 容器。"
        Write-Host "        安装 Docker Desktop：winget install --id Docker.DockerDesktop -e"
        Write-Host "        或改用本机 MySQL 8：见 06-devops/deploy.md「方案 A：本机直装 MySQL」"
        return $false
    }
    if (-not (Test-Path $composeFile)) {
        Write-Warn "未找到 $composeFile（OPS-004 未落地），无法拉起 MySQL 容器。"
        return $false
    }

    if (-not (Test-DockerDaemon)) {
        Write-Warn "Docker 守护进程未运行。请先启动 Docker Desktop，等待右下角图标不再转圈后重试。"
        return $false
    }
    if (-not (Test-Path (Join-Path $Root '06-devops/.env'))) {
        Write-Warn "缺少 06-devops/.env（compose 需要 MYSQL_ROOT_PASSWORD / MYSQL_PASSWORD），已自动调用 init-env.ps1 生成。"
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root '06-devops/scripts/init-env.ps1')
    }

    Write-Step "docker compose up -d mysql（首次要拉镜像，约几分钟，请耐心）..."
    $composeOut = Invoke-Docker -Arguments @('compose', '-f', $composeFile, '--env-file', (Join-Path $Root '06-devops/.env'), 'up', '-d', 'mysql')
    $code = $LASTEXITCODE
    if ($composeOut) { $composeOut | ForEach-Object { Write-Host ("        " + $_) -ForegroundColor DarkGray } }
    if ($code -ne 0) {
        Write-Err "docker compose 启动失败（exit $code），请看上方输出。"
        return $false
    }

    Write-Step "等待 MySQL 就绪（最多 3 分钟）..."
    $ready = $false
    for ($i = 0; $i -lt 90; $i++) {
        Start-Sleep -Seconds 2
        $conn = Get-NetTCPConnection -LocalPort ([int]$DbPort) -State Listen -ErrorAction SilentlyContinue
        if ($conn) {
            $hc = Invoke-Docker -Arguments @('inspect', '-f', '{{.State.Health.Status}}', 'cooking-mysql') -Quiet
            if ($LASTEXITCODE -eq 0 -and $hc -eq 'healthy') { $ready = $true; break }
            if (-not $hc) { $ready = $true; break }   # 无 healthcheck 的老镜像，端口通即认为可用
        }
    }
    if ($ready) {
        Write-Ok "MySQL 已就绪：127.0.0.1:$DbPort（容器内 3306，数据卷 cooking-mysql-data）"
        return $true
    }
    Write-Warn "等待超时仍未就绪。查看日志：docker compose -f .\06-devops\docker-compose.yml logs --tail 100 mysql"
    return $false
}

# 在新窗口中启动指定目录下的项目
function Start-Project([string]$Dir, [string]$Name, [string]$PreferredScript, [string]$FallbackScript) {
    $pkg = Join-Path $Dir 'package.json'
    if (-not (Test-Path $pkg)) {
        Write-Warn "$Name 尚未初始化（未找到 $pkg），跳过启动。"
        return $false
    }

    if (-not $SkipInstall) {
        if (Test-Path (Join-Path $Dir 'node_modules')) {
            Write-Host "        依赖已存在，跳过 npm install" -ForegroundColor DarkGray
        }
        else {
            Write-Step "安装 $Name 依赖（首次会慢，请耐心）..."
            Push-Location $Dir
            # npm 把进度条写 stderr，必须走 Invoke-Native，否则脚本会被 PowerShell 当成出错中断
            Invoke-Native -Exe 'npm' -Arguments @('install') -KeepStderr | ForEach-Object { Write-Host ("        " + $_) -ForegroundColor DarkGray }
            $code = $LASTEXITCODE
            Pop-Location
            if ($code -ne 0) {
                Write-Err "$Name npm install 失败（exit $code），跳过启动。详见上方输出。"
                return $false
            }
        }
    }

    $runScript = $PreferredScript
    if (-not (Test-HasScript $pkg $PreferredScript)) {
        $runScript = $FallbackScript
        Write-Warn "package.json 中没有 '$PreferredScript' 脚本，改用 '$FallbackScript'"
    }

    $envPrefix = ''
    if ($LegacyOpenSsl) { $envPrefix = "`$env:NODE_OPTIONS='--openssl-legacy-provider'; " }
    $cmd = "$envPrefix Set-Location '$Dir'; Write-Host '[$Name] $Dir' -ForegroundColor Cyan; npm run $runScript"

    Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $cmd | Out-Null
    Write-Ok "$Name 已在新窗口启动（npm run $runScript）"
    return $true
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " cooking 本地一键启动（OPS-003）" -ForegroundColor Cyan
Write-Host " 根目录：$Root" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------
# 1. 环境体检
# ------------------------------------------------------------------
Write-Step "检查运行环境..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err "未检测到 Node.js。请安装 Node 18 LTS 或 20 LTS：https://nodejs.org/zh-cn/download"
    exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Err "未检测到 npm（通常随 Node 一起安装，请重装 Node）。"
    exit 1
}

$nodeVer = Invoke-Native -Exe 'node' -Arguments @('-v')
$npmVer  = Invoke-Native -Exe 'npm'  -Arguments @('-v')
Write-Host ("        Node {0} / npm {1}" -f $nodeVer, $npmVer)
if ($nodeVer -match '^v(\d+)\.') {
    $major = [int]$Matches[1]
    if ($major -lt 18) {
        Write-Err "Node 版本过低（当前 $nodeVer），架构要求 18 LTS / 20 LTS，请先升级。"
        exit 1
    }
    if ($major -ne 18 -and $major -ne 20) {
        Write-Warn "当前 Node $nodeVer 不是推荐的 18/20 LTS（架构文档第 2.1 节）。可能遇到 EBADENGINE 或 ERR_OSSL_EVP_UNSUPPORTED。"
        Write-Host "        遇到 ERR_OSSL_EVP_UNSUPPORTED 时，加参数重试：-LegacyOpenSsl" -ForegroundColor DarkGray
    }
}
# 本机 Git 装在 E:\software\Git，PowerShell 的 PATH 里未必有；用 Ensure-GitInPath 兜底，避免误报
$null = Ensure-GitInPath
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Warn "未检测到 Git（仅影响版本管理，不影响启动）。安装：winget install --id Git.Git -e"
}

# ------------------------------------------------------------------
# 2. 准备后端目录与 .env
# ------------------------------------------------------------------
Write-Step "准备后端配置..."
if (-not (Test-Path $ServerDir)) {
    New-Item -ItemType Directory -Path $ServerDir -Force | Out-Null
    Write-Warn "04-backend/server 不存在，已创建空目录（后端工程由 BE-001 初始化）。"
}

# 环境来源优先级：06-devops/.env（init-env.ps1 生成的本机真实配置）> 模板占位值
$opsEnvFile = Join-Path $Root '06-devops/.env'
$envSource  = $EnvTpl
if (Test-Path $opsEnvFile) {
    $envSource = $opsEnvFile
    Write-Host "        检测到 $opsEnvFile，作为配置来源" -ForegroundColor DarkGray
}
else {
    Write-Warn "未找到 06-devops/.env，将用模板占位值生成后端 .env（数据库/后台登录会失败）。"
    Write-Host "            建议先执行：powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\init-env.ps1" -ForegroundColor Yellow
}

$envFile = Join-Path $ServerDir '.env'
if (-not (Test-Path $envFile)) {
    Copy-Item $envSource $envFile -Force
    Write-Ok "已从配置来源生成 $envFile"
}
elseif ($envSource -eq $opsEnvFile) {
    # 06-devops/.env 是唯一来源，每次启动强制同步，避免两份配置漂移
    Copy-Item $envSource $envFile -Force
    Write-Host "        已同步最新配置到后端 .env" -ForegroundColor DarkGray
}
else {
    Write-Host "        已存在 .env，跳过复制" -ForegroundColor DarkGray
}

$ServerPort = Get-EnvValue $envFile 'SERVER_PORT'
if (-not $ServerPort) { $ServerPort = '3000' }
$DbPort = Get-EnvValue $envFile 'DB_PORT'
if (-not $DbPort) { $DbPort = '3306' }
Write-Host ("        后端端口 $ServerPort / 数据库端口 $DbPort（取自 .env）") -ForegroundColor DarkGray

# ------------------------------------------------------------------
# 3. MySQL
#    默认行为：端口有监听 -> 直接用；没监听 -> 自动用 Docker Compose 拉起（一条命令到位）
#    -NoDb 完全跳过数据库环节（只想跑前端、或连远端数据库时用）
# ------------------------------------------------------------------
if ($NoDb) {
    Write-Step "已指定 -NoDb，跳过数据库环节。"
}
else {
    Write-Step "检查数据库（端口 $DbPort）..."
    $listening = $null
    try { $listening = Get-NetTCPConnection -LocalPort ([int]$DbPort) -State Listen -ErrorAction SilentlyContinue } catch { $listening = $null }

    if ($listening) {
        Write-Ok "检测到本机已有 MySQL 监听 $DbPort，直接复用。"
    }
    elseif ($WithDocker) {
        Start-DockerMysql
    }
    else {
        Write-Warn "端口 $DbPort 无监听，尝试用 Docker Compose 自动拉起 MySQL 8 ..."
        Start-DockerMysql
    }
}

# ------------------------------------------------------------------
# 4. 启动后端
# ------------------------------------------------------------------
Write-Step "启动后端服务..."
$backendStarted = Start-Project -Dir $ServerDir -Name 'backend' -PreferredScript 'dev' -FallbackScript 'start'

if ($backendStarted) {
    $healthUrl = "http://localhost:$ServerPort/api/health"
    Write-Step "等待后端健康检查 $healthUrl ..."
    $healthy = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        try {
            $resp = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 3
            if ($null -ne $resp -and $resp.code -eq 0) { $healthy = $true; break }
        }
        catch { }
        Write-Host "." -NoNewline
    }
    Write-Host ""
    if ($healthy) {
        Write-Ok "后端已就绪（/api/health 返回 code=0）。"
    }
    else {
        Write-Warn "60 秒内未通过健康检查，请到后端窗口查看日志。常见原因：MySQL 连不上、端口 $ServerPort 被占用、BE-001 尚未落地。"
    }
}

# ------------------------------------------------------------------
# 5. 可选：启动前端
# ------------------------------------------------------------------
if ($WithMobile) {
    Write-Step "启动 C 端（mobile）..."
    Start-Project -Dir $MobileDir -Name 'mobile' -PreferredScript 'serve' -FallbackScript 'dev' | Out-Null
}
if ($WithAdmin) {
    Write-Step "启动管理后台（admin）..."
    Start-Project -Dir $AdminDir -Name 'admin' -PreferredScript 'serve' -FallbackScript 'dev' | Out-Null
}

# ------------------------------------------------------------------
# 6. 结果汇总
# ------------------------------------------------------------------
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 启动完成，服务地址：" -ForegroundColor Cyan
Write-Host ("   后端   http://localhost:{0}     健康检查 /api/health，静态资源 /uploads" -f $ServerPort) -ForegroundColor White
if ($WithMobile) { Write-Host "   C 端   http://localhost:8080    （需 FE-001 已初始化）" -ForegroundColor White }
if ($WithAdmin)  { Write-Host "   后台   http://localhost:8081    （需 FE-002 已初始化）" -ForegroundColor White }
Write-Host ("   MySQL  127.0.0.1:{0}" -f $DbPort) -ForegroundColor White
Write-Host "------------------------------------------" -ForegroundColor Cyan
Write-Host " 停止服务：powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\stop-dev.ps1"
Write-Host " 或在对应的 PowerShell 窗口中按 Ctrl + C"
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
