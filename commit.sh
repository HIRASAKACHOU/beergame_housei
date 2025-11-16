#!/bin/bash

# ビールゲームプロジェクト自動バージョン管理スクリプト
# 使用方法: ./commit.sh feature "新機能を追加" "game.js" "style.css"
# または: ./commit.sh -t feature -d "新機能を追加" -f "game.js,style.css"

set -e

# === カラー定義 ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# === オプション解析 ===
TYPE=""
DESCRIPTION=""
FILES=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            TYPE="$2"
            shift 2
            ;;
        -d|--description)
            DESCRIPTION="$2"
            shift 2
            ;;
        -f|--files)
            FILES="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            # 位置引数
            if [ -z "$TYPE" ]; then
                TYPE="$1"
            elif [ -z "$DESCRIPTION" ]; then
                DESCRIPTION="$1"
            else
                FILES="$FILES $1"
            fi
            shift
            ;;
    esac
done

# === 必須パラメータ確認 ===
if [ -z "$TYPE" ] || [ -z "$DESCRIPTION" ]; then
    echo -e "${RED}❌ 使用方法: ./commit.sh <type> \"<description>\" [files...]${NC}"
    echo -e "${CYAN}タイプ: feature, fix, refactor, docs, chore${NC}"
    echo -e "${YELLOW}例: ./commit.sh feature \"新機能を追加\" game.js style.css${NC}"
    exit 1
fi

# === バージョン情報を読み込む ===
echo -e "${CYAN}📖 バージョン情報を読み込み中...${NC}"

VERSION_FILE="version.json"
if [ ! -f "$VERSION_FILE" ]; then
    echo -e "${RED}❌ version.json が見つかりません${NC}"
    exit 1
fi

CURRENT_VERSION=$(jq -r '.version' "$VERSION_FILE")
MAJOR_VERSION=$(jq -r '.versioningRules.majorVersion' "$VERSION_FILE")
MINOR_VERSION=$(echo "$CURRENT_VERSION" | cut -d'.' -f2)
MINOR_MAX=$(jq -r '.versioningRules.minorMax' "$VERSION_FILE")

echo -e "${YELLOW}現在のバージョン: v$CURRENT_VERSION${NC}"

# === 新バージョンを計算 ===
NEW_MINOR_VERSION=$((MINOR_VERSION + 1))

if [ $NEW_MINOR_VERSION -gt $MINOR_MAX ]; then
    echo -e "${RED}❌ マイナーバージョンが最大値を超えました (0-$MINOR_MAX)${NC}"
    echo -e "${YELLOW}💡 管理者に連絡して、メジャーバージョンのアップグレードを検討してください${NC}"
    exit 1
fi

NEW_VERSION="$MAJOR_VERSION.$NEW_MINOR_VERSION"

# === コミットメッセージを構築 ===
DATE=$(date +"%Y-%m-%d")

declare -A TYPE_EMOJI=(
    [feature]="✨"
    [fix]="🐛"
    [refactor]="♻️"
    [docs]="📖"
    [chore]="🔧"
)

EMOJI="${TYPE_EMOJI[$TYPE]}"

# === 日本語コミットメッセージ ===
COMMIT_MSG="v$NEW_VERSION: $DESCRIPTION

**タイプ**: $TYPE
**日付**: $DATE"

if [ -n "$FILES" ]; then
    COMMIT_MSG="$COMMIT_MSG

**ファイル修正**:"
    for file in $FILES; do
        COMMIT_MSG="$COMMIT_MSG
- $file"
    done
fi

# === プレビュー ===
echo ""
echo -e "${CYAN}📝 コミットメッセージプレビュー:${NC}"
echo -e "${GRAY}================================${NC}"
echo -e "$COMMIT_MSG"
echo -e "${GRAY}================================${NC}"

# === ドライラン ===
if [ "$DRY_RUN" = true ]; then
    echo ""
    echo -e "${GREEN}✅ ドライラン完了 (実際のコミットは実行されません)${NC}"
    exit 0
fi

# === 確認 ===
echo ""
read -p "実行しますか？ (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ キャンセルしました${NC}"
    exit 1
fi

# === Git操作 ===
echo ""
echo -e "${CYAN}🔄 Git操作を実行中...${NC}"

git add -A
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ git add に失敗しました${NC}"
    exit 1
fi

git commit -m "$COMMIT_MSG"
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ git commit に失敗しました${NC}"
    exit 1
fi

# === バージョン情報を更新 ===
echo -e "${CYAN}📝 version.json を更新中...${NC}"

# jq でバージョン情報を更新
jq ".version = \"$NEW_VERSION\" | .versionHistory.\"$NEW_VERSION\" = {date: \"$DATE\", type: \"$TYPE\", description: \"$DESCRIPTION\"}" "$VERSION_FILE" > "$VERSION_FILE.tmp" && mv "$VERSION_FILE.tmp" "$VERSION_FILE"

git add version.json
git commit --amend --no-edit
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ バージョン情報の更新に失敗しました${NC}"
    exit 1
fi

# === 完了 ===
echo ""
echo -e "${GREEN}✅ コミット完了!${NC}"
echo -e "${YELLOW}📊 新バージョン: v$NEW_VERSION${NC}"
echo -e "${CYAN}💡 次のコマンドでプッシュしてください: git push origin main${NC}"
