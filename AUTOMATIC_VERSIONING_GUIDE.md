# 🔄 自動バージョン管理スクリプト - 使用ガイド

## 📋 概要

このガイドは、ビールゲームプロジェクトの自動バージョン管理スクリプトを使用する方法を説明します。

**目的**: Git コミット時に自動的にバージョン号を更新し、統一されたコミットメッセージを作成

## 🔧 セットアップ

### Windows (PowerShell)

#### 1️⃣ スクリプトに実行権限を付与

```powershell
# PowerShellで以下を実行
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### 2️⃣ スクリプト実行テスト

```powershell
cd "e:\2025法政大学\13ビジネス活用するためのpython\coding\beergame_housei"
.\commit.ps1 -Type feature -Description "テスト" -DryRun
```

### macOS / Linux

#### 1️⃣ スクリプトに実行権限を付与

```bash
chmod +x commit.sh
```

#### 2️⃣ 必要なツールを確認

```bash
# jq のインストール確認
which jq
# インストールされていない場合：
# macOS: brew install jq
# Ubuntu: sudo apt-get install jq
```

---

## 🚀 使用方法

### Windows (PowerShell)

#### 基本的な使用法

```powershell
.\commit.ps1 -Type <type> -Description "<説明>"
```

#### パラメータ

| パラメータ | 必須 | 説明 | 例 |
|-----------|------|------|-----|
| `-Type` | ✅ | コミットタイプ | feature, fix, refactor, docs, chore |
| `-Description` | ✅ | 変更内容（日本語） | "AI システムをパラメータ化" |
| `-Files` | ❌ | 変更ファイル | game.js, style.css |
| `-DryRun` | ❌ | プレビューのみ | 指定時にプレビュー表示 |

#### 実例

```powershell
# 例1: 機能追加
.\commit.ps1 -Type feature -Description "新しい AI 戦略を追加" -Files @("game.js")

# 例2: バグ修正
.\commit.ps1 -Type fix -Description "入荷処理のバグを修正" -Files @("game.js", "style.css")

# 例3: ドキュメント更新
.\commit.ps1 -Type docs -Description "README を更新" -Files @("README.md")

# 例4: プレビューのみ（実行なし）
.\commit.ps1 -Type feature -Description "テスト" -DryRun
```

---

### macOS / Linux

#### 基本的な使用法

```bash
./commit.sh <type> "<説明>" [files...]
```

#### パラメータ

```bash
# 位置引数版
./commit.sh feature "新機能を追加" game.js style.css

# オプション版
./commit.sh -t feature -d "新機能を追加" -f "game.js,style.css"

# ドライラン
./commit.sh --dry-run -t feature -d "テスト"
```

#### 実例

```bash
# 例1: 機能追加
./commit.sh feature "新しい AI 戦略を追加" game.js

# 例2: バグ修正
./commit.sh fix "入荷処理のバグを修正" game.js style.css

# 例3: ドキュメント更新
./commit.sh docs "README を更新" README.md

# 例4: プレビューのみ
./commit.sh --dry-run feature "テスト"
```

---

## 📊 使用例とワークフロー

### シナリオ: 新機能を追加してコミット

#### ステップ1: コード編集
```javascript
// game.js を編集
// ...新機能を実装...
```

#### ステップ2: コミット実行 (Windows)
```powershell
.\commit.ps1 -Type feature -Description "新しい AI 戦略を追加" -Files @("game.js", "style.css")
```

#### ステップ3: プレビューを確認して実行
```
📝 コミットメッセージプレビュー:
================================
v0.9: 新しい AI 戦略を追加

**タイプ**: feature
**日付**: 2025-11-17

**ファイル修正**:
- game.js
- style.css
================================

実行しますか？ (y/n): y
```

#### ステップ4: バージョン自動更新
```
✅ コミット完了!
📊 新バージョン: v0.9
💡 次のコマンドでプッシュしてください: git push origin main
```

#### ステップ5: プッシュ
```powershell
git push origin main
```

---

## 🔍 version.json の構造

```json
{
  "version": "0.9",
  "versionHistory": {
    "0.9": {
      "date": "2025-11-17",
      "type": "feature",
      "description": "新しい AI 戦略を追加"
    },
    "0.8": {
      "date": "2025-11-16",
      "type": "feature",
      "description": "AI システムのパラメータ化実装"
    }
  },
  "versioningRules": {
    "majorVersion": 0,
    "minorStart": 1,
    "minorMax": 9,
    "incrementType": "minor",
    "majorDecisionRequired": true
  }
}
```

### キー説明

| キー | 説明 |
|------|------|
| `version` | 現在のバージョン（v0.X形式） |
| `versionHistory` | 過去のバージョン履歴 |
| `majorVersion` | メジャーバージョン（固定値0） |
| `minorStart` | マイナーバージョン開始値 |
| `minorMax` | マイナーバージョン最大値 |
| `majorDecisionRequired` | v1.0への昇格に許可が必要 |

---

## 📝 コミットタイプ一覧

### ✨ feature - 新機能追加
```powershell
.\commit.ps1 -Type feature -Description "新しい機能を追加"
```
- AI戦略の追加
- 新しいゲームモードの実装
- UIコンポーネントの追加

### 🐛 fix - バグ修正
```powershell
.\commit.ps1 -Type fix -Description "バグを修正"
```
- 計算ロジックのバグ修正
- UIの表示不具合修正
- アニメーション問題の修正

### ♻️ refactor - コード改善
```powershell
.\commit.ps1 -Type refactor -Description "コードを整理"
```
- 関数の再構成
- パフォーマンス最適化
- コード品質向上

### 📖 docs - ドキュメント更新
```powershell
.\commit.ps1 -Type docs -Description "ドキュメントを更新"
```
- README.md の更新
- 新しいドキュメント作成
- コメント追加

### 🔧 chore - その他
```powershell
.\commit.ps1 -Type chore -Description "テストを追加"
```
- テスト関連
- 設定ファイル修正
- 依存パッケージ更新

---

## 🔐 安全機能

### 自動バージョン制限
```
❌ マイナーバージョンが最大値を超えました (0-9)
💡 管理者に連絡して、メジャーバージョンのアップグレードを検討してください
```

v0.9 まで自動で更新可能。v1.0 への昇格は管理者のみが決定。

### ドライラン機能
```powershell
.\commit.ps1 -Type feature -Description "テスト" -DryRun
```
実際にコミットせず、プレビューのみ表示。

### 確認プロンプト
```
実行しますか？ (y/n): y
```
コミット前に必ず確認が必要。

---

## 🆘 トラブルシューティング

### PowerShell実行ポリシーエラー

```
File ... cannot be loaded because running scripts is disabled on this system.
```

**解決法:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### jq コマンドが見つからない (Linux/macOS)

```
Command 'jq' not found
```

**解決法:**
```bash
# Ubuntu/Debian
sudo apt-get install jq

# macOS
brew install jq

# CentOS/RHEL
sudo yum install jq
```

### Git コミットに失敗した

```
❌ git commit に失敗しました
```

**確認事項:**
1. Git ユーザー設定を確認: `git config user.name`
2. ステージング済みの変更を確認: `git status`
3. コミットメッセージが正しいか確認

---

## 📊 バージョン履歴の確認

### version.json を確認
```bash
# 全体を表示
cat version.json | jq .

# 現在のバージョンのみ
cat version.json | jq '.version'

# 履歴一覧
cat version.json | jq '.versionHistory'
```

### Git ログを確認
```bash
git log --oneline | head -10
```

---

## 🎯 ベストプラクティス

### ✅ 推奨される使い方

1. **コード編集 → コミット → プッシュ**
   ```powershell
   # コード編集後
   .\commit.ps1 -Type feature -Description "説明"
   git push origin main
   ```

2. **複数ファイル変更時**
   ```powershell
   .\commit.ps1 -Type feature -Description "説明" -Files @("file1.js", "file2.css", "README.md")
   ```

3. **わかりやすい説明を記述**
   ```powershell
   # 良い例
   .\commit.ps1 -Type feature -Description "AI システムのパラメータ化実装"
   
   # 悪い例
   .\commit.ps1 -Type feature -Description "更新"
   ```

### ❌ 避けるべき使い方

- バージョン情報を手動で編集
- スクリプトを使わず直接 `git commit` を実行
- コミットメッセージを英文で記述

---

## 🔗 関連ドキュメント

- [CHANGELOG.md](CHANGELOG.md) - バージョン履歴
- [GIT_COMMIT_GUIDE.md](GIT_COMMIT_GUIDE.md) - Git指南
- [COMMIT_QUICK_REFERENCE.md](COMMIT_QUICK_REFERENCE.md) - クイックリファレンス

---

## 📞 サポート

質問や問題がある場合：
1. このドキュメントを再確認
2. スクリプトの実行ログを確認
3. `git log` でコミット履歴を確認

---

**最終更新**: 2025-11-16  
**バージョン**: 1.0  
**対応OS**: Windows (PowerShell 5.1+), macOS, Linux
