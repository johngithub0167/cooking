<#
.SYNOPSIS
    cooking 本地服务停止脚本（OPS-003 配套）

.DESCRIPTION
    按端口停止本地开发服务：后端 3000、C 端 8080、管理后台 8081。
    只结束「监听这些端口的进程」，并跳过系统进程（PID <= 4 / System / svchost），避免误杀。

.PARAMETER WithDocker
    同时停止 06-devops 下的 Docker Compose 容器（docker compose stop）。

.PARAMETER Ports
    自定义要释放的端口列表，默认 3000, 8080, 8081。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\stop-dev.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\stop-dev.ps1 -WithDocker
#>

[CmdletBinding()]
param(
    [switch]$WithDocker,
    [int[]]$Ports = @(3000, 8080, 8081)
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root

# 公共工具：Invoke-Docker（绕开 PS 5.1 把 docker 的 stderr 当致命错误的坑）
. (Join-Path $PSScriptRoot 'ops-common.ps1')

# 无论如何都不能误杀的系统进程
$protectedNames = @('System', 'Idle', 'svchost', 'services', 'lsass', 'wininit', 'csrss')

foreach ($port in $Ports) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) {
        Write-Host "[stop-dev] 端口 $port 无监听进程，跳过。" -ForegroundColor DarkGray
        continue
    }

    $procIds = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $procIds) {
        if ($procId -le 4) {
            Write-Host "[stop-dev] 端口 $port 被系统进程占用（PID $procId），已跳过，请勿强行结束。" -ForegroundColor Yellow
            continue
        }
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if (-not $proc) { continue }
        if ($protectedNames -contains $proc.ProcessName) {
            Write-Host "[stop-dev] 端口 $port 由受保护进程占用（$($proc.ProcessName)，PID $procId），已跳过。" -ForegroundColor Yellow
            continue
        }
        Write-Host "[stop-dev] 停止端口 $port 占用进程：$($proc.ProcessName)（PID $procId）" -ForegroundColor Cyan
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

if ($WithDocker) {
    if (-not (Test-DockerDaemon)) {
        Write-Host "[stop-dev] Docker 不可用或未运行，跳过容器停止。" -ForegroundColor Yellow
    }
    else {
        Write-Host "[stop-dev] 停止 Docker Compose 容器..." -ForegroundColor Cyan
        Invoke-Docker -Arguments @('compose', '-f', (Join-Path $Root '06-devops/docker-compose.yml'), 'stop') | ForEach-Object { Write-Host ('        ' + $_) -ForegroundColor DarkGray }
    }
}

Write-Host "[stop-dev] 完成。" -ForegroundColor Green
