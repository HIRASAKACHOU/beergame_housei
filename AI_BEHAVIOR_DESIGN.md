# 🤖 AI行動パターン設計 - 共通ロジック実装ガイド

## 📋 概要

新しいAI設計方針は、ビールゲームにおける供給チェーン意思決定プロセスを科学的にモデル化したものです。

**目的**: 現実的で予測可能なAI行動を実現

---

## 🎯 共通ロジックの基本構造

### 発注決定プロセス

```
需要予測 (Demand Forecasting)
    ↓
目標在庫計算 (Target Inventory)
    ↓
在庫ギャップ分析 (Inventory Gap Analysis)
    ↓
ベース発注量決定 (Base Order Amount)
    ↓
慣性効果適用 (Smoothing)
    ↓
ランダム揺らぎ追加 (Noise)
    ↓
発注量確定 (Final Order)
```

---

## 🔍 各ステップの詳細

### 1️⃣ 需要予測 (Demand Forecasting)

```javascript
const forecast = 0.6 * demand + 0.4 * (avgDemand ?? demand);
```

**考え方**:
- 直近の需要（60%）と過去平均（40%）のハイブリッド
- 急な変化に対応しつつ、長期傾向も考慮

**例**:
```
直近需要: 8個
過去平均: 5個
予測需要: 0.6 × 8 + 0.4 × 5 = 4.8 + 2 = 6.8個
```

---

### 2️⃣ 目標在庫計算 (Target Inventory)

```javascript
const targetStock = forecast * coverWeeks;
```

**考え方**:
- 予測需要を何週分カバーするか（性格ごとに異なる）
- `coverWeeks` が目標在庫のキーパラメータ

**性格ごとの差**:

| 性格 | coverWeeks | 目標在庫（需要6個時） | 特徴 |
|------|-----------|-------------------|------|
| パニック型 | 3.0 | 18個 | 多めの在庫を保つ |
| 安全型 | 2.0 | 12個 | 適度な在庫 |
| 冷静型 | 1.2 | 7.2個 | 最低限の在庫 |

---

### 3️⃣ 在庫ギャップ分析 (Inventory Gap Analysis)

```javascript
const gap = targetStock + backlogWeight * backlog - inventory;
```

**構成要素**:
- **targetStock**: 目標在庫
- **backlogWeight × backlog**: 欠品の影響度
- **inventory**: 現在の在庫

**ギャップの意味**:
- `gap > 0`: 在庫が不足している → 多く発注したい
- `gap < 0`: 在庫が余剰である → 少なく発注したい
- `gap = 0`: ちょうど良い在庫

**例**:
```
目標在庫: 12個
欠品: 3個
欠品重み: 1.2
現在在庫: 8個

ギャップ = 12 + 1.2 × 3 - 8 = 12 + 3.6 - 8 = 7.6
→ 7.6個分の不足を感じ、発注に反映される
```

---

### 4️⃣ ベース発注量決定 (Base Order Amount)

```javascript
let orderBase = demand + invAdjustWeight * gap;
```

**考え方**:
- 基本は直近需要に、ギャップ補正を加える
- `invAdjustWeight` でギャップの反応度を調整

**性格ごとの反応度**:

| 性格 | invAdjustWeight | 説明 |
|------|-----------------|------|
| パニック型 | 0.9 | ギャップに強く反応 |
| 安全型 | 0.7 | 適度に反応 |
| 冷静型 | 0.5 | ギャップに弱く反応 |

**例**:
```
直近需要: 4個
ギャップ: 7.6個
ギャップ反応度: 0.7

ベース発注 = 4 + 0.7 × 7.6 = 4 + 5.32 = 9.32個
```

---

### 5️⃣ 慣性効果適用 (Smoothing)

```javascript
let order = smoothing * lastOrder + (1 - smoothing) * orderBase;
```

**考え方**:
- 人間は急に発注量を変えない
- 前回の発注量を参考にする傾向がある
- 平滑化フィルターとして機能

**性格ごとの慣性**:

| 性格 | smoothing | 前回注文への依存度 | 説明 |
|------|-----------|-----------------|------|
| パニック型 | 0.3 | 30% | 柔軟に変更 |
| 安全型 | 0.6 | 60% | 保守的に変更 |
| 冷静型 | 0.8 | 80% | 変化を避ける |

**例**:
```
前回注文: 5個
ベース発注: 9.32個
平滑化度: 0.6

最終（平滑化前）= 0.6 × 5 + 0.4 × 9.32 = 3 + 3.73 = 6.73個
```

---

### 6️⃣ ランダム揺らぎ追加 (Noise)

```javascript
const noiseFactor = 1 + (Math.random() * 2 - 1) * noiseLevel;
order *= noiseFactor;
```

**考え方**:
- 人間の意思決定は完全に正確ではない
- ±noiseLevel の確率的変動を加える

**性格ごとの変動**:

| 性格 | noiseLevel | 変動幅 | 説明 |
|------|-----------|--------|------|
| パニック型 | 0.25 | ±25% | 結構ブレる |
| 安全型 | 0.15 | ±15% | 適度にブレる |
| 冷静型 | 0.07 | ±7% | あまりブレない |

**例**:
```
平滑化後: 6.73個
ノイズレベル: 0.15
ランダム値: 0.5（0-1の範囲）

ノイズファクター = 1 + (2×0.5 - 1) × 0.15 = 1 + 0.15 = 1.15
最終発注 = 6.73 × 1.15 = 7.74個 ≈ 8個
```

---

### 7️⃣ 発注量確定 (Final Order)

```javascript
order = Math.max(0, Math.round(order));
```

- マイナスを禁止（在庫を「返品」することはない）
- 整数に丸める

---

## 📊 性格プロファイル比較

### パニック型 (Panic)

```javascript
{
    coverWeeks: 3.0,        // 多めの在庫を3週分
    backlogWeight: 1.6,     // 欠品に強く反応
    invAdjustWeight: 0.9,   // ギャップに強く反応
    smoothing: 0.3,         // 変更に柔軟
    noiseLevel: 0.25        // 結構変動
}
```

**特徴**:
- ✅ 欠品を避けたい
- ✅ 需要変化に敏感
- ✅ 発注量が大きく変動
- ❌ 過度な在庫を持つ傾向

**典型的な行動**:
```
需要が4→8に上がると、すぐに大量に発注
→ 供給チェーン全体に混乱を引き起こす（ブルウィップ効果）
```

---

### 安全型 (Safe)

```javascript
{
    coverWeeks: 2.0,        // 適度な在庫を2週分
    backlogWeight: 1.2,     // 適度に欠品反応
    invAdjustWeight: 0.7,   // 適度にギャップ反応
    smoothing: 0.6,         // 保守的に変更
    noiseLevel: 0.15        // 適度に変動
}
```

**特徴**:
- ✅ バランスの取れた戦略
- ✅ 急激な変更を避ける
- ✅ 比較的安定した行動
- ✅ 在庫とコストのバランス

**典型的な行動**:
```
需要変化に時間をかけて対応
→ 適度なウィップ効果
```

---

### 冷静型 (Calm)

```javascript
{
    coverWeeks: 1.2,        // 最低限の在庫
    backlogWeight: 0.7,     // 欠品に弱く反応
    invAdjustWeight: 0.5,   // ギャップに弱く反応
    smoothing: 0.8,         // 変更を避ける
    noiseLevel: 0.07        // あまり変動しない
}
```

**特徴**:
- ✅ 最小限の在庫で効率的
- ✅ 発注量の変動が小さい
- ✅ 安定した行動パターン
- ❌ 欠品のリスクが高い

**典型的な行動**:
```
需要変化に遅れて対応
→ 緩和されたウィップ効果（または逆効果）
```

---

## 💻 実装コード例

### 基本的な使用方法

```javascript
// AIの発注決定
const orderAmount = AIStrategy.decideOrder(
    role,           // 役割オブジェクト
    4,              // 直近需要
    5,              // 平均需要
    {}              // プロファイルオーバーライド（オプション）
);
```

### プロファイルのカスタマイズ

```javascript
// パニック型をさらに激しくする
const customProfile = {
    backlogWeight: 2.0,     // デフォルト1.6から2.0へ
    noiseLevel: 0.35        // デフォルト0.25から0.35へ
};

const orderAmount = AIStrategy.decideOrder(role, 4, 5, customProfile);
```

### 統合的な使用

```javascript
// ゲーム内での使用
executeAIOrders() {
    Object.keys(this.roles).forEach(roleKey => {
        const role = this.roles[roleKey];
        if (!role.isPlayer) {
            // 平均需要を計算
            const avgDemand = role.orderHistory.length > 0
                ? role.orderHistory.reduce((a, b) => a + b, 0) / role.orderHistory.length
                : 4;
            
            // 発注決定
            const orderAmount = AIStrategy.makeDecision(
                role,
                role.currentDemand || 4,
                avgDemand,
                this.aiParams  // ゲームレベルでのパラメータ
            );
            
            role.placeOrder(orderAmount);
        }
    });
}
```

---

## 🔬 実験的な用途

### 異なるシナリオでのテスト

#### シナリオ1: 需要が急上昇する場合

```javascript
// 初期: 需要4個
// 5週目以降: 需要8個に急上昇

// パニック型の反応
forecast = 0.6 * 8 + 0.4 * 4 = 6.4
targetStock = 6.4 * 3.0 = 19.2
// → 大量に発注

// 冷静型の反応
forecast = 0.6 * 8 + 0.4 * 4 = 6.4
targetStock = 6.4 * 1.2 = 7.68
// → 少量発注
```

#### シナリオ2: 安定した需要

```javascript
// ずっと需要4個

// すべての性格が安定
// ただし在庫レベルが異なる
```

---

## 📈 学習効果

このAI設計により、学習者は以下を理解できます：

1. **需要予測の重要性**: 平均と直近のバランス
2. **安全在庫の概念**: 性格による戦略の違い
3. **ブルウィップ効果**: パニック型の行動がもたらす影響
4. **供給チェーン最適化**: 冷静型の効率性
5. **人間的な意思決定**: 慣性とランダム性の役割

---

## 🔗 関連ドキュメント

- [AI_PARAMETERIZATION.md](AI_PARAMETERIZATION.md) - パラメータ化システム
- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - 実装ガイド
- [README.md](README.md) - プロジェクト概要

---

**実装日**: 2025-11-16  
**バージョン**: v0.9  
**設計出典**: 共通ロジック設計方針（供給チェーン意思決定モデル）
