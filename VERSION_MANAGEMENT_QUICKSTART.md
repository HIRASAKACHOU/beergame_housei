# 🚀 自動バージョン管理 - クイックスタート

## 今すぐ始める（Windows）

### ステップ1: PowerShell を開く
```powershell
cd "e:\2025法政大学\13ビジネス活用するためのpython\coding\beergame_housei"
```

### ステップ2: 初回セットアップ（1回のみ）
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
`Y` を入力して確認

### ステップ3: 実行権限を確認
```powershell
Get-ExecutionPolicy
```
`RemoteSigned` と表示されれば OK

---

## 毎回のコミット手順

### 1️⃣ コード編集
```javascript
// game.js, style.css, index.html などを編集
```

### 2️⃣ スクリプトで自動コミット

```powershell
# 機能追加の場合
.\commit.ps1 -Type feature -Description "新機能の説明"

# バグ修正の場合
.\commit.ps1 -Type fix -Description "バグの説明"

# ドキュメント更新の場合
.\commit.ps1 -Type docs -Description "ドキュメントの説明"
```

### 3️⃣ プレビューを確認
```
📝 コミットメッセージプレビュー:
================================
v0.9: 新機能の説明

**タイプ**: feature
**日付**: 2025-11-17

**ファイル修正**:
- game.js
================================

実行しますか？ (y/n): 
```

### 4️⃣ 実行を確認して `y` を入力
```
実行しますか？ (y/n): y
```

### 5️⃣ 自動的にコミット＆バージョン更新
```
✅ コミット完了!
📊 新バージョン: v0.9
💡 次のコマンドでプッシュしてください: git push origin main
```

### 6️⃣ プッシュ
```powershell
git push origin main
```

---

## コマンド例集

### 🎯 頻出パターン

#### 例1: 単一ファイルの変更
```powershell
.\commit.ps1 -Type feature -Description "新しいAI戦略を追加" -Files @("game.js")
```

#### 例2: 複数ファイルの変更
```powershell
.\commit.ps1 -Type feature -Description "UI改善とAI機能追加" -Files @("game.js", "style.css", "index.html")
```

#### 例3: バグ修正
```powershell
.\commit.ps1 -Type fix -Description "出荷フェーズのバグを修正" -Files @("game.js")
```

#### 例4: ドキュメント更新
```powershell
.\commit.ps1 -Type docs -Description "README を更新" -Files @("README.md")
```

#### 例5: プレビューのみ（実行なし）
```powershell
.\commit.ps1 -Type feature -Description "テスト機能" -DryRun
```

---

## ✅ 何が自動化されるのか？

| 項目 | 手動で | 自動で |
|------|-------|-------|
| **ファイルステージング** | `git add -A` | ✅ 自動 |
| **コミット** | `git commit -m "..."` | ✅ 自動 |
| **バージョン更新** | 手動編集 | ✅ 自動 |
| **CHANGELOG 更新** | 手動編集 | ✅ 自動* |
| **タイムスタンプ記録** | 手動入力 | ✅ 自動 |

*version.json に記録（CHANGELOG.md は手動で確認・更新推奨）

---

## 📊 バージョン番号の理解

### 現在のシステム
```
v0.8 (メジャー.マイナー)
 ↓
次のコミット後
↓
v0.9
```

### ルール
- **メジャーバージョン**: 0（固定、管理者のみ決定）
- **マイナーバージョン**: 1-9（自動更新）
- **最大**: v0.9 に達したら、管理者に連絡

### 例
```
v0.8 → v0.9 ✅ 自動
v0.9 → v1.0 ❌ エラー表示（管理者のみ）
```

---

## 🆘 よくある問題と解決法

### Q: "実行ポリシーエラー" が出ている
```
File ... cannot be loaded because running scripts is disabled
```

**A**: セットアップステップ2 を実行
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Q: スクリプトが見つからない
```
commit.ps1 を見つけることができません
```

**A**: プロジェクトフォルダに移動しているか確認
```powershell
cd "e:\2025法政大学\13ビジネス活用するためのpython\coding\beergame_housei"
ls commit.ps1  # 見つかったら OK
```

### Q: Git ユーザー設定エラー
```
Author identity unknown
```

**A**: Git ユーザーを設定（初回のみ）
```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### Q: プッシュできない
```
failed to push some refs
```

**A**: まず pull してから push
```powershell
git pull origin main
git push origin main
```

---

## 🎓 詳細ドキュメント

もっと詳しく知りたい場合：

- 📖 [AUTOMATIC_VERSIONING_GUIDE.md](AUTOMATIC_VERSIONING_GUIDE.md) - 完全ガイド
- 📖 [GIT_COMMIT_GUIDE.md](GIT_COMMIT_GUIDE.md) - Git指南
- 📖 [CHANGELOG.md](CHANGELOG.md) - バージョン履歴

---

## 💡 ヒント

### ✅ 推奨される使い方
```powershell
# 1日の終わりにコミット
.\commit.ps1 -Type feature -Description "本日の作業完了"

# 機能ごとにコミット
.\commit.ps1 -Type feature -Description "新AI戦略"

# バグが見つかったらすぐコミット
.\commit.ps1 -Type fix -Description "バグ修正"
```

### ⚠️ 避けるべき
```powershell
# ❌ 手動で version.json を編集
# ❌ git commit -m "..." を直接実行
# ❌ 複数の大きな変更を1コミットにまとめる
```

---

## 🔄 次のステップ

1. ✅ スクリプトで 1 回コミットしてみる
2. ✅ version.json でバージョン更新を確認
3. ✅ `git log` でコミット履歴を確認
4. ✅ GitHub でコミットが表示されるか確認

---

**セットアップ完了！** 🎉  
スクリプトを使ってコミットしてください。

```powershell
.\commit.ps1 -Type feature -Description "テスト" -DryRun
```

で試してみましょう！
