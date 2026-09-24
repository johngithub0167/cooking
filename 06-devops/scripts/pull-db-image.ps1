<#
.SYNOPSIS
    拉取 MySQL 8 镜像（OPS-004 配套），官方源慢到不可用时自动回退国内镜像加速源。

.DESCRIPTION
    背景：本机实测直连 Docker Hub 只有约 25KB/s，拉一个 mysql:8.0（约 800MB）要几小时。
    解决办法是先走官方源，超过 -TimeoutSec 秒还没拉完就换镜像加速源，拉完打 tag 成正式名字，
    这样 06-devops/docker-compose.yml 里写的 image: mysql:8.0 不用改。

    镜像加速源本身是会失效的，用 -Mirror 换；脚本会依次尝试多个候选：
      1. dockerproxy.com
      2. docker.m.daocloud.io
      3. hub-mirror.c.163.com

.PARAMETER Image
    目标镜像，默认 mysql:8.0。

.PARAMETER TimeoutSec
    单个源最多等多少秒，超时就换下一个源，默认 180。

.PARAMETER Mirror
    优先使用的镜像加速源域名（不带 https://）。

.PARAMETER Force
    本地已有同名镜像时仍然重新拉取（用于升版本或镜像损坏）。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\pull-db-image.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\pull-db-image.ps1 -TimeoutSec 300 -Force
#>

[CmdletBinding()]
param(
    [string]$Image = 'mysql:8.0',
    [int]$TimeoutSec = 180,
    [string]$Mirror = 'dockerproxy.com',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# 公共工具：Invoke-Docker / Invoke-Native（绕开 PS 5.1 把原生命令 stderr 当致命错误的坑）
. (Join-Path $PSScriptRoot 'ops-common.ps1')

$Root     = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogDir   = Join-Path $Root '06-devops/logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
Set-Location $Root

function Write-Step { param($m) Write-Host "[pull-image] $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "[pull-image] $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "[pull-image] $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "[pull-image] $m" -ForegroundColor Red }

# 本地是否已有该镜像（只看 RepoTag，不管中间层缓存）
function Test-ImageLocal([string]$img) {
    $found = Invoke-Docker -Arguments @('images', '--format', '{{.Repository}}:{{.Tag}}') -Quiet
    return (@($found) -contains $img)
}

# 拉一个源，超时就放弃返回 $false
function Start-Pull([string]$img, [int]$timeout) {
    $log = Join-Path $LogDir 'pull-image.log'
    $err = Join-Path $LogDir 'pull-image.err'
    Remove-Item $log, $err -ErrorAction SilentlyContinue

    $proc = Start-Process -FilePath 'docker' -ArgumentList @('pull', $img) -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $log -RedirectStandardError $err

    $waited = 0
    while (-not $proc.HasExited -and $waited -lt $timeout) {
        Start-Sleep -Seconds 10
        $waited += 10
    }
    if (-not $proc.HasExited) {
        Write-Warn "拉取 $img 超过 $timeout 秒仍未完成，放弃并切换源。"
        $proc.Kill()
        return $false
    }
    if ($proc.ExitCode -eq 0) { Write-Ok "拉取成功：$img"; return $true }
    Write-Warn "拉取 $img 失败（exit $($proc.ExitCode)）。错误摘要："
    if (Test-Path $err) { Get-Content $err -Encoding UTF8 -Tail 5 | ForEach-Object { Write-Host ('        ' + $_) -ForegroundColor DarkGray } }
    return $false
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 拉取 MySQL 镜像（OPS-004）" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Err "未检测到 docker，请先安装 Docker Desktop：winget install --id Docker.DockerDesktop -e"
    exit 1
}
if (-not (Test-DockerDaemon)) {
    Write-Err "Docker 守护进程未运行，请先启动 Docker Desktop。"
    exit 1
}

if (-not $Force -and (Test-ImageLocal $Image)) {
    Write-Ok "本地已有 $Image，无需重新拉取（要强制重拉加 -Force）。"
    exit 0
}

# 拆出仓库名与标签：mysql:8.0 -> mysql / 8.0
$parts = $Image -split ':', 2
$repo = $parts[0]
$tag  = if ($parts.Length -gt 1) { $parts[1] } else { 'latest' }

Write-Step "尝试官方源：$Image（最多等 $TimeoutSec 秒）..."
if (Start-Pull $Image $TimeoutSec) { exit 0 }

# 官方源不行，换镜像加速源。官方短名（如 mysql）在加速源上的路径是 <mirror>/library/mysql
$mirrors = @($Mirror, 'docker.m.daocloud.io', 'hub-mirror.c.163.com', 'dockerproxy.com') | Select-Object -Unique
foreach ($m in $mirrors) {
    $mirrorImage = "$m/library/${repo}:${tag}"
    Write-Step "尝试镜像加速源：$m -> $mirrorImage"
    if (Start-Pull $mirrorImage $TimeoutSec) {
        Invoke-Docker -Arguments @('tag', $mirrorImage, $Image) | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Err "打 tag 失败：$mirrorImage -> $Image"; exit 2 }
        Write-Ok "已把 $mirrorImage 打标为 $Image，compose 无需修改。"
        Write-Host "        提示：镜像加速源会失效，下次失败请换 -Mirror 换个源。" -ForegroundColor DarkGray
        exit 0
    }
}

Write-Err "所有源都失败了。可选办法："
Write-Host "        1. 给 Docker Desktop 配代理 / 镜像加速器（Settings -> Docker Engine -> registry-mirrors）"
Write-Host "        2. 多试几次，晚点再拉（跨国网络波动很常见）"
Write-Host "        3. 不走容器，改用本机直装 MySQL 8，见 06-devops/deploy.md「方案 A」"
exit 3
