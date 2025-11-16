# バージョン管理ガイド

## セットアップ

### Windows (PowerShell)
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### macOS / Linux
```bash
chmod +x commit.sh
sudo apt-get install jq  # または brew install jq
```

## 使用方法

### Windows
```powershell
.\commit.ps1 -Type <type> -Description "<説明>" [-Files @("file1", "file2")] [-DryRun]
```

### macOS / Linux
```bash
./commit.sh <type> "<説明>" [files...]
```

## コミットタイプ

| タイプ | 説明 | 例 |
|--------|------|-----|
| **feature** | 新機能 | `新しいAI戦略を追加` |
| **fix** | バグ修正 | `計算エラーを修正` |
| **refactor** | コード改善 | `ロジックを整理` |
| **docs** | ドキュメント | `READMEを更新` |
| **chore** | その他 | `テストを追加` |

## 実例

```powershell
# 機能追加
.\commit.ps1 -Type feature -Description "新しいAI戦略を追加" -Files @("game.js")

# バグ修正（複数ファイル）
.\commit.ps1 -Type fix -Description "出荷フェーズのバグ修正" -Files @("game.js", "style.css")

# プレビューのみ
.\commit.ps1 -Type feature -Description "テスト" -DryRun

# プッシュ
git push origin main
```

## ルール

- **バージョン範囲**: v0.1 ～ v0.9（メジャー固定）
- **自動更新**: 毎回のコミット時に自動更新
- **v1.0昇格**: 管理者のみが決定

## トラブルシューティング

**PowerShell実行ポリシーエラー**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**jqが見つからない**
```bash
# Ubuntu: sudo apt-get install jq
# macOS: brew install jq
```

詳細は [README.md](README.md) と [CHANGELOG.md](CHANGELOG.md) を参照。
