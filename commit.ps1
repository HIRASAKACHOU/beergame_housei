#!/usr/bin/env powershell
<#
.SYNOPSIS
    ビールゲームプロジェクトの自動バージョン管理スクリプト

.DESCRIPTION
    git commit 前に自動的にバージョン号を更新し、日本語でコミットメッセージを作成

.PARAMETER CommitType
    コミットタイプ: feature, fix, refactor, docs, chore

.PARAMETER Description
    変更内容の説明（日本語）

.PARAMETER Files
    変更されたファイルのリスト

.EXAMPLE
    .\commit.ps1 -Type feature -Description "新機能を追加" -Files @("game.js", "style.css")

#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('feature', 'fix', 'refactor', 'docs', 'chore')]
    [string]$Type,

    [Parameter(Mandatory=$true)]
    [string]$Description,

    [Parameter(Mandatory=$false)]
    [string[]]$Files,

    [Parameter(Mandatory=$false)]
    [switch]$DryRun
)

# === 設定 ===
$versionFile = "version.json"
$projectRoot = Get-Location

# === バージョン情報を読み込む ===
Write-Host "📖 バージョン情報を読み込み中..." -ForegroundColor Cyan

if (-not (Test-Path $versionFile)) {
    Write-Host "❌ version.json が見つかりません" -ForegroundColor Red
    exit 1
}

$versionData = Get-Content $versionFile -Raw | ConvertFrom-Json
$currentVersion = $versionData.version
$majorVersion = $versionData.versioningRules.majorVersion
$minorVersion = [int]($currentVersion -split '\.' | Select-Object -Last 1)

Write-Host "現在のバージョン: v$currentVersion" -ForegroundColor Yellow

# === 新バージョンを計算 ===
$newMinorVersion = $minorVersion + 1

if ($newMinorVersion -gt $versionData.versioningRules.minorMax) {
    Write-Host "❌ マイナーバージョンが最大値を超えました (0-$($versionData.versioningRules.minorMax))" -ForegroundColor Red
    Write-Host "💡 管理者に連絡して、メジャーバージョンのアップグレードを検討してください" -ForegroundColor Yellow
    exit 1
}

$newVersion = "$majorVersion.$newMinorVersion"

# === コミットメッセージを構築 ===
$date = Get-Date -Format "yyyy-MM-dd"

$typeEmoji = @{
    'feature' = '✨'
    'fix'     = '🐛'
    'refactor' = '♻️'
    'docs'    = '📖'
    'chore'   = '🔧'
}

$emoji = $typeEmoji[$Type]

# === 日本語コミットメッセージフォーマット ===
$commitMessage = "v$newVersion`: $Description`n`n"
$commitMessage += "**タイプ**: $Type`n"
$commitMessage += "**日付**: $date`n"

# ファイルが指定されている場合
if ($Files -and $Files.Count -gt 0) {
    $commitMessage += "`n**ファイル修正**:`n"
    foreach ($file in $Files) {
        $commitMessage += "- $file`n"
    }
}

# === プレビュー ===
Write-Host "`n📝 コミットメッセージプレビュー:" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Gray
Write-Host $commitMessage
Write-Host "================================" -ForegroundColor Gray

# === 確認 ===
if ($DryRun) {
    Write-Host "`n✅ ドライラン完了 (実際のコミットは実行されません)" -ForegroundColor Green
    exit 0
}

Write-Host "`n実行しますか？ (y/n): " -ForegroundColor Yellow -NoNewline
$response = Read-Host

if ($response -ne 'y' -and $response -ne 'Y') {
    Write-Host "❌ キャンセルしました" -ForegroundColor Red
    exit 1
}

# === Git操作 ===
Write-Host "`n🔄 Git操作を実行中..." -ForegroundColor Cyan

# ステージング
git add -A
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ git add に失敗しました" -ForegroundColor Red
    exit 1
}

# コミット
git commit -m $commitMessage
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ git commit に失敗しました" -ForegroundColor Red
    exit 1
}

# === バージョン情報を更新 ===
Write-Host "📝 version.json を更新中..." -ForegroundColor Cyan

$versionData.version = $newVersion
$versionData.versionHistory | Add-Member -NotePropertyName $newVersion -NotePropertyValue @{
    date = $date
    type = $Type
    description = $Description
} -Force

$versionData | ConvertTo-Json -Depth 10 | Set-Content $versionFile

# バージョン変更をコミット
git add version.json
git commit --amend --no-edit
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ バージョン情報の更新に失敗しました" -ForegroundColor Red
    exit 1
}

# === 完了 ===
Write-Host "`n✅ コミット完了!" -ForegroundColor Green
Write-Host "📊 新バージョン: v$newVersion" -ForegroundColor Yellow
Write-Host "💡 次のコマンドでプッシュしてください: git push origin main" -ForegroundColor Cyan
