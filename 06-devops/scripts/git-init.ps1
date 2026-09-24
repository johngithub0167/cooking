<#
.SYNOPSIS
    cooking 项目 Git 仓库初始化脚本（OPS-001）

.DESCRIPTION
    1. 检查本机是否已安装 Git（本机当前未安装时会给出安装命令并退出）
    2. 初始化仓库，默认分支 main
    3. 首次 git add，并强制校验 .env / node_modules / uploads / logs 不得入库
    4. 校验 .gitignore 规则是否生效
    5. 默认只 add 不 commit，确认无敏感文件后加 -Commit 再提交

.PARAMETER Commit
    加此参数才会创建首次提交；不加则只完成 add 与体检，由你人工确认后再提交。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\git-init.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\git-init.ps1 -Commit
#>

[CmdletBinding()]
param(
    [switch]$Commit
)

$ErrorActionPreference = 'Stop'

# 仓库根目录：06-devops/scripts -> 06-devops -> 根目录
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root

# 公共工具：Resolve-GitExe / Ensure-GitInPath / Get-EnvValue……
. (Join-Path $PSScriptRoot 'ops-common.ps1')

function Write-Step { param($m) Write-Host "[git-init] $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "[git-init] $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "[git-init] $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "[git-init] $m" -ForegroundColor Red }


Write-Step "仓库根目录：$Root"

# ------------------------------------------------------------------
# 1. 检查 Git
# ------------------------------------------------------------------
$gitExe = Ensure-GitInPath
if (-not $gitExe) {
    Write-Err "未检测到 git.exe（PATH、常见安装目录、注册表都没找到），无法初始化仓库。"
    Write-Host ""
    Write-Host "  安装方式一（推荐，Windows 11）：winget install --id Git.Git -e --source winget"
    Write-Host "  安装方式二（手动）：https://git-scm.com/download/win （安装时勾选 Git from the command line）"
    Write-Host "  若已装但不在这个列表里，请把 git.exe 所在目录加进 PATH 后重开终端。"
    Write-Host ""
    exit 1
}

# 只在当前 PowerShell 会话里生效，退出即还原，不会污染系统环境变量
$gitBinDir = Split-Path -Parent $gitExe
if ($env:PATH -notlike "*$gitBinDir*") { $env:PATH = "$gitBinDir;$env:PATH" }
Write-Ok ("Git 可用：" + (Invoke-Native -Exe $gitExe -Arguments @('--version')) + "    路径：" + $gitExe)

# ------------------------------------------------------------------
# 2. 初始化仓库（默认分支 main）
# ------------------------------------------------------------------
if (Test-Path (Join-Path $Root '.git')) {
    $branch = Invoke-Native -Exe $gitExe -Arguments @('rev-parse', '--abbrev-ref', 'HEAD')
    Write-Warn "已存在 .git 目录，跳过 git init（当前分支：$branch）"
}
else {
    # git init 会把 hint 提示写 stderr，必须走 Invoke-Native
    Invoke-Native -Exe $gitExe -Arguments @('init', '-b', 'main') | Out-Null
    if ($LASTEXITCODE -ne 0) {
        # 老版本 Git 不支持 -b 参数
        Invoke-Native -Exe $gitExe -Arguments @('init') | Out-Null
        Invoke-Native -Exe $gitExe -Arguments @('checkout', '-b', 'main') | Out-Null
    }
    Write-Ok "仓库已初始化，默认分支 main"
}

# ------------------------------------------------------------------
# 3. 检查提交身份（只读检查，不修改任何 git 配置）
# ------------------------------------------------------------------
$userEmail = Invoke-Native -Exe $gitExe -Arguments @('config', '--get', 'user.email')
$userName  = Invoke-Native -Exe $gitExe -Arguments @('config', '--get', 'user.name')
if (-not $userEmail -or -not $userName) {
    Write-Warn "尚未配置提交身份（当前 user.name='$userName' / user.email='$userEmail'）"
    Write-Host "        请自行执行（脚本不会改你的 git 配置）："
    Write-Host "          git config user.name  `"你的名字`""
    Write-Host "          git config user.email `"你的邮箱`""
}

# ------------------------------------------------------------------
# 4. 加入暂存区
# ------------------------------------------------------------------
Write-Step "执行 git add -A ..."
Invoke-Native -Exe $gitExe -Arguments @('add', '-A') | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Err "git add 失败"; exit 2 }

# ------------------------------------------------------------------
# 5. 体检一：敏感文件 / 依赖 / 产物不得入库
# ------------------------------------------------------------------
$staged = Invoke-Native -Exe $gitExe -Arguments @('ls-files')
$forbidden = @()
foreach ($f in $staged) {
    if ($f -match '(^|/)\.env$' -or
        $f -match '(^|/)node_modules/' -or
        $f -match '(^|/)uploads/[^/]+' -or
        $f -match '(^|/)logs/[^/]+' -or
        $f -match '(^|/)dist/' -or
        $f -match '(^|/)mysql-data/' -or
        $f -match '(^|/)\.vscode/' -or
        $f -match '(^|/)\.idea/') {
        $forbidden += $f
    }
}

if ($forbidden.Count -gt 0) {
    Write-Err "以下文件命中忽略规则却被暂存，已自动撤销 git add："
    $forbidden | ForEach-Object { Write-Host "        $_" -ForegroundColor Red }
    Invoke-Native -Exe $gitExe -Arguments @('reset', '-q') | Out-Null
    Write-Err "请修正 .gitignore 或移走敏感文件后重试。"
    exit 3
}
Write-Ok "体检通过：暂存区无 .env / node_modules / uploads / logs 等敏感或产物文件"

# ------------------------------------------------------------------
# 6. 体检二：.gitignore 规则是否真的生效
# ------------------------------------------------------------------
Write-Step "校验 .gitignore 规则："
$probe = @(
    '04-backend/server/.env',
    '04-backend/server/node_modules/express/package.json',
    '04-backend/server/uploads/2026/09/demo.jpg',
    '04-backend/server/logs/app.log',
    '03-frontend/mobile/dist/index.html'
)
$probeFail = $false
foreach ($p in $probe) {
    Invoke-Native -Exe $gitExe -Arguments @('check-ignore', '-q', $p) | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host ("        命中忽略规则：" + $p) -ForegroundColor DarkGray
    }
    else {
        $probeFail = $true
        Write-Host ("        未按预期忽略：" + $p) -ForegroundColor Yellow
    }
}
if ($probeFail) { Write-Warn "存在未按预期忽略的路径，请检查 .gitignore（不影响提交，但建议修正）" }

# ------------------------------------------------------------------
# 7. 预览并提交
# ------------------------------------------------------------------
Write-Step "待提交文件清单："
Invoke-Native -Exe $gitExe -Arguments @('--no-pager', 'status', '--short') | ForEach-Object { Write-Host ('        ' + $_) }

Write-Host ""
if ($Commit) {
    Invoke-Native -Exe $gitExe -Arguments @('commit', '-m', 'chore(init): 初始化 cooking 仓库、.gitignore 与运维脚本（OPS-001~004 / 010~013）')
    if ($LASTEXITCODE -ne 0) { Write-Err "提交失败，请检查上方 git 输出"; exit 4 }
    Write-Ok "首次提交完成。"
}
else {
    Write-Warn "默认只 add 不 commit。确认清单无误后执行："
    Write-Host "        git commit -m `"chore(init): 初始化 cooking 仓库与运维脚本`""
}
Write-Host ""
Write-Host "如需推送到远端（脚本不会自动推）："
Write-Host "        git remote add origin <你的仓库地址>"
Write-Host "        git push -u origin main"
Write-Host ""
