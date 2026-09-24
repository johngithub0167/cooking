<#
.SYNOPSIS
    cooking 运维脚本公共工具集（被各 ops 脚本 dot-source，不单独执行）

.DESCRIPTION
    这里放三样东西：
      1. Invoke-Docker —— docker 原生调用的安全包装
      2. Test-DockerDaemon / Get-DockerContainer —— 容器状态查询
      3. Get-EnvValue / Hide-Secret / Resolve-OpsEnv —— .env 读取与脱敏

    为什么非要包装一层 docker 调用：
    PowerShell 5.1 在 $ErrorActionPreference = 'Stop' 时，原生命令只要往 stderr 写
    哪怕一个字，都会被当成「终止性错误」把脚本整个打断。而 docker 偏偏把进度提示
    （"Network xxx Creating"、WARNING、"Pulling fs layer"）全写 stderr，
    于是 docker info / docker compose up / docker ps 都可能让脚本莫名其妙退出。
    Invoke-Docker 临时把 EAP 切成 Continue 再调，从而做到「错误可见、脚本不断」。
#>

function Invoke-Native {
    <#
    .SYNOPSIS
        安全执行任意原生可执行文件（docker / git / npm / cmd.exe / mysqldump ……）。

    .DESCRIPTION
        PowerShell 5.1 在 $ErrorActionPreference = 'Stop' 时，原生命令只要往 stderr 写一个字
        就会被当成终止性错误，直接把脚本打断 —— 哪怕你写了 2>$null 也一样（实测 git.exe 就踩过）。
        这里统一临时切成 Continue 再执行，做到「错误可见、脚本不断」，退出码照旧从 $LASTEXITCODE 取。

    .PARAMETER Exe 可执行文件名或完整路径。
    .PARAMETER Arguments 参数数组。
    .PARAMETER KeepStderr 把 stderr 合并进 stdout 返回；默认丢弃 stderr。

    .OUTPUTS 输出行（字符串数组）。
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Exe,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [switch]$KeepStderr
    )

    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($KeepStderr) {
            # 合并流里混着 ErrorRecord，统一还原成字符串，避免调用方拿到混合对象
            & $Exe @Arguments 2>&1 | ForEach-Object { if ($null -ne $_) { $_.ToString() } }
        }
        else {
            & $Exe @Arguments 2>$null
        }
    }
    finally {
        $ErrorActionPreference = $oldEap
    }
}

function Invoke-Docker {
    <#
    .SYNOPSIS
        安全执行 docker 命令。

    .PARAMETER Arguments
        docker 的子命令与参数数组，例如 @('ps','--format','{{.Names}}')。

    .PARAMETER Quiet
        丢弃 docker 的 stderr（进度提示 / 警告）。只关心执行结果时用。

    .OUTPUTS
        输出行（字符串数组）。退出码通过 $LASTEXITCODE 取得。
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [switch]$Quiet
    )

    if ($Quiet) {
        Invoke-Native -Exe 'docker' -Arguments $Arguments
    }
    else {
        Invoke-Native -Exe 'docker' -Arguments $Arguments -KeepStderr
    }
}

function Test-DockerDaemon {
    <#.SYNOPSIS 判断 Docker 守护进程是否可用（docker info 退出码为 0 即视为可用）。#>
    [CmdletBinding()]
    param()

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
    Invoke-Docker -Arguments @('info') -Quiet | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Get-DockerContainer {
    <#
    .SYNOPSIS 列出容器名。
    .PARAMETER All 包含已停止的容器（docker ps -a）。
    .OUTPUTS 容器名字符串数组。
    #>
    [CmdletBinding()]
    param([switch]$All)

    $argList = @('ps')
    if ($All) { $argList += '-a' }
    $argList += @('--format', '{{.Names}}')
    return @(Invoke-Docker -Arguments $argList -Quiet | Where-Object { $_ -and $_.Trim() -ne '' })
}

function Get-EnvValue {
    <#
    .SYNOPSIS 从 .env 里读一个键的值（取最后一次定义，支持行首空格）。
    .OUTPUTS 值字符串；文件不存在或无此键返回 $null。
    #>
    [CmdletBinding()]
    param(
        [string]$File,
        [string]$Key
    )

    if (-not $File -or -not (Test-Path $File)) { return $null }
    $line = Get-Content -Path $File -Encoding UTF8 -ErrorAction SilentlyContinue |
        Where-Object { $_ -match "^\s*$([regex]::Escape($Key))\s*=" } |
        Select-Object -Last 1
    if (-not $line) { return $null }
    return ($line -split '=', 2)[1].Trim()
}

function Hide-Secret {
    <#.SYNOPSIS 把口令打码成「前 2 位 + **** + 后 2 位」，用于日志输出。#>
    [CmdletBinding()]
    param([string]$Value)

    if (-not $Value) { return '(未设置)' }
    if ($Value.Length -le 4) { return '****' }
    return ($Value.Substring(0, 2) + '****' + $Value.Substring($Value.Length - 2))
}

function Resolve-OpsEnv {
    <#
    .SYNOPSIS 按「06-devops/.env 优先，其次 04-backend/server/.env」的规则定位配置文件。
    .OUTPUTS 存在则返回绝对路径，都不存在返回 $null。
    #>
    [CmdletBinding()]
    param(
        [string]$Root,
        [string]$ServerEnv
    )

    $opsEnv = Join-Path $Root '06-devops/.env'
    if (-not $ServerEnv) { $ServerEnv = Join-Path $Root '04-backend/server/.env' }
    if (Test-Path $opsEnv) { return $opsEnv }
    if (Test-Path $ServerEnv) { return $ServerEnv }
    return $null
}

function Resolve-GitExe {
    <#
    .SYNOPSIS
        定位 git.exe：PATH -> 常见安装目录 -> 注册表卸载信息（覆盖自定义安装路径）。

    .DESCRIPTION
        本机 Git 装在 E:\software\Git，PowerShell 会话的 PATH 里根本没有 git，
        直接用 Get-Command git 会误判成「没装 Git」。这里多兜几层。

    .OUTPUTS git.exe 绝对路径；找不到返回 $null。
    #>
    [CmdletBinding()]
    param()

    $cmd = Get-Command git -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = @(
        (Join-Path $env:ProgramFiles 'Git\cmd\git.exe'),
        (Join-Path $env:ProgramFiles 'Git\bin\git.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Git\cmd\git.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd\git.exe'),
        'E:\software\Git\cmd\git.exe',
        (Join-Path $env:LOCALAPPDATA 'Atlassian\SourceTree\git_local\cmd\git.exe')
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { return $c }
    }

    $regPaths = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    foreach ($rp in $regPaths) {
        $apps = Get-ItemProperty $rp -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName -like 'Git*' -and $_.InstallLocation }
        foreach ($app in $apps) {
            foreach ($sub in @('cmd\git.exe', 'bin\git.exe')) {
                $p = Join-Path $app.InstallLocation $sub
                if (Test-Path $p) { return $p }
            }
        }
    }
    return $null
}

function Ensure-GitInPath {
    <#
    .SYNOPSIS 把 git 所在目录加进「当前 PowerShell 会话」的 PATH，退出即还原，不污染系统环境变量。
    .OUTPUTS git.exe 绝对路径；找不到返回 $null。
    #>
    [CmdletBinding()]
    param()

    $exe = Resolve-GitExe
    if (-not $exe) { return $null }
    $binDir = Split-Path -Parent $exe
    if ($env:PATH -notlike "*$binDir*") { $env:PATH = "$binDir;$env:PATH" }
    return $exe
}
