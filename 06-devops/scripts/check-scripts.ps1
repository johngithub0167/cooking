<#
.SYNOPSIS
    cooking 运维脚本自检工具（编码 + 语法）

.DESCRIPTION
    扫描 06-devops/scripts 下的所有 *.ps1，检查三件事：
      1. 是否 UTF-8 带 BOM    —— PowerShell 5.1 不带 BOM 会按 GBK 解码，中文注释乱码甚至解析失败
      2. 是否为 CRLF 换行     —— 与 .gitattributes 约定一致
      3. AST 语法是否有错误   —— 用 PowerShell 解析器静态检查，不需要真的执行脚本

    新增 / 修改过 .ps1 之后建议跑一次：`npm run ops:check`
    发现非 UTF-8 BOM 或裸 LF 时，加 -Fix 自动修复。

.PARAMETER Fix
    自动把缺 BOM / 混入裸 LF 的文件改写为「UTF-8 with BOM + CRLF」。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\check-scripts.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\06-devops\scripts\check-scripts.ps1 -Fix
#>

[CmdletBinding()]
param(
    [switch]$Fix
)

$ErrorActionPreference = 'Stop'

function Write-Step { param($m) Write-Host "[check-scripts] $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "[check-scripts] $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "[check-scripts] $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "[check-scripts] $m" -ForegroundColor Red }

$dir = $PSScriptRoot
$files = Get-ChildItem -Path $dir -Filter '*.ps1' -File | Sort-Object Name
if (-not $files) { Write-Warn "目录里没有 .ps1 文件：$dir"; exit 0 }

# UTF-8 with BOM 的编码对象（构造函数写不出带 BOM 的默认实例）
$utf8Bom = New-Object System.Text.UTF8Encoding $true

$total = 0
$bad   = 0
$fixed = 0

Write-Step ("共 {0} 个脚本待检查：{1}" -f $files.Count, $dir)
Write-Host ''

foreach ($f in $files) {
    $total++

    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)

    # 按 UTF-8 读正文（无论有没有 BOM，都指定编码，避免被系统代码页影响）
    $text = [System.IO.File]::ReadAllText($f.FullName, (New-Object System.Text.UTF8Encoding $false))
    $crlfCount = ([regex]::Matches($text, "`r`n")).Count
    $bareLf    = ([regex]::Matches($text, "(?<!`r)`n")).Count

    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseInput($text, [ref]$tokens, [ref]$errors)
    $errCount = if ($errors) { $errors.Count } else { 0 }

    $needFix = (-not $hasBom) -or ($bareLf -gt 0)
    if ($needFix -and $Fix) {
        $normalized = $text -replace "`r`n", "`n"
        $normalized = $normalized -replace "`n", "`r`n"
        [System.IO.File]::WriteAllText($f.FullName, $normalized, $utf8Bom)
        $fixed++
        $hasBom = $true
        $bareLf = 0
        $needFix = $false
    }

    $ok = (-not $needFix) -and ($errCount -eq 0)
    if (-not $ok) { $bad++ }

    $flag = if ($ok) { 'OK   ' } else { 'CHECK' }
    Write-Host ('    {0,-26} {1}  bom={2,-5} crlf={3,-5} bare-lf={4,-5} ast-errors={5}' -f $f.Name, $flag, $hasBom, $crlfCount, $bareLf, $errCount)
    foreach ($e in $errors) {
        Write-Host ('        !! ' + $e.Message + ' @ line ' + $e.Extent.StartLineNumber) -ForegroundColor Red
    }
}

Write-Host ''
if ($Fix -and $fixed -gt 0) { Write-Ok ("已修复 {0} 个文件（UTF-8 with BOM + CRLF）" -f $fixed) }

if ($bad -eq 0) {
    Write-Ok ('全部通过：{0}/{1} 个脚本 bom/crlf/语法均正常' -f $total, $total)
    exit 0
}

Write-Warn ("{0}/{1} 个脚本需要关注。BOM / 裸 LF 问题加 -Fix 可自动修复；语法错误需人工改。" -f $bad, $total)
if (-not $Fix) { Write-Host '        自动修复示例：npm run ops:check -- -Fix' -ForegroundColor Gray }
exit 1
