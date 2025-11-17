// ==================== コアクラス定義 ====================

// 役割クラス
class Role {
    constructor(name, type) {
        this.name = name;
        this.type = type; // 'retailer', 'supplier2', 'supplier1', 'factory'
        
        // ========== 在庫管理 ==========
        this.inventory = 12; // 現在在庫
        this.backorder = 0; // 発注残（未充足の累積注文量）
        
        // ========== 各環節の独立データ ==========
        // 入荷処理中（receiving完了待ち）
        this.receiving = []; // キュー：[4] など
        this.receivedThisRound = 0; // 今週受領した量
        
        // 輸送中（発送完了後→受領まで）
        this.inTransit = []; // キュー：[4] など
        this.shippedThisRound = 0; // 今週発送した量
        
        // 受注キュー（下流からの注文）
        this.incomingOrders = []; // キュー
        
        // ========== 需要・発注管理 ==========
        this.currentDemand = 0; // 現在の需要（顧客需要またはダウンストリーム注文）
        this.lastOrder = 0; // 前回の発注量（今週分の発注）
        this.lastShipped = 0; // 前回発送時に実際に発送した量
        
        // ========== コスト管理 ==========
        this.totalCost = 0; // 累計コスト
        this.costThisRound = 0; // 今週のコスト
        
        // ========== 履歴管理 ==========
        this.orderHistory = []; // 発注履歴
        this.weeklyStats = []; // 週別統計：{ week, inventory, backorder, order, received, shipped, cost }
        
        // ========== AI設定 ==========
        this.isPlayer = false; // プレイヤーかどうか
        this.aiType = 'safe'; // AIタイプ
    }

    // 商品受領
    receiveGoods(amount) {
        this.inventory += amount;
    }

    // 出荷
    shipGoods(amount) {
        const availableToShip = Math.min(amount, this.inventory);
        this.inventory -= availableToShip;
        const remaining = amount - availableToShip;
        this.backorder += remaining;
        return availableToShip;
    }

    // コスト計算
    calculateCost(inventoryCost, backorderCost) {
        const cost = this.inventory * inventoryCost + this.backorder * backorderCost;
        this.totalCost += cost;
        return cost;
    }

    // 発注
    placeOrder(amount) {
        this.lastOrder = amount;
        this.orderHistory.push(amount);
        return amount;
    }
}

// AI戦略クラス - 新しい設計方針に基づいた共通ロジック
class AIStrategy {
    // AI性格プロファイル（共通ロジック設計方針）
    static AI_TYPE = {
        PANIC: 'panic',
        SAFE: 'safe',
        CALM: 'calm'
    };

    // デフォルトの性格プロファイル
    static defaultProfiles = {
        [this.AI_TYPE.PANIC]: {
            coverWeeks: 1.8,        // 需要を何週分カバーしたいか（やや多め）
            backlogWeight: 0.55,    // 発注残への反応度
            invAdjustWeight: 0.75,  // ギャップを発注に反映する強さ
            smoothing: 0.5,         // 前回注文への依存度（やや低め→適度な振れ幅）
            noiseLevel: 0.10        // ランダム揺らぎ（±10%）
        },
        [this.AI_TYPE.SAFE]: {
            coverWeeks: 2.0,        // そこそこ多めの安全在庫
            backlogWeight: 1.2,     // 適度な欠品反応
            invAdjustWeight: 0.7,   // 中程度のギャップ反応
            smoothing: 0.6,         // 慣性強め→急な変更なし
            noiseLevel: 0.15        // 比較的安定
        },
        [this.AI_TYPE.CALM]: {
            coverWeeks: 1.2,        // 最低限の在庫
            backlogWeight: 0.7,     // 欠品への弱い反応
            invAdjustWeight: 0.5,   // 弱いギャップ反応
            smoothing: 0.8,         // 前回注文をかなり重視
            noiseLevel: 0.07        // あまりブレない
        }
    };

    /**
     * 共通ロジックに基づいて発注量を決定
     * @param {Role} role - 役割オブジェクト
     * @param {number} demand - 現在見えている需要
     * @param {number} avgDemand - 過去の平均需要
     * @param {object} profileOverride - プロファイルのオーバーライド（オプション）
     * @returns {number} 発注量
     */
    static decideOrder(role, demand, avgDemand, profileOverride = {}) {
        // プロファイルを取得（オーバーライドをマージ）
        const profile = {
            ...AIStrategy.defaultProfiles[role.aiType] || AIStrategy.defaultProfiles[AIStrategy.AI_TYPE.SAFE],
            ...profileOverride
        };

        const {
            coverWeeks,
            backlogWeight,
            invAdjustWeight,
            smoothing,
            noiseLevel
        } = profile;

        // 防御：demand と avgDemand が有効な数値であることを確認
        demand = isNaN(demand) || demand === null ? 4 : demand;
        avgDemand = isNaN(avgDemand) || avgDemand === null ? 4 : avgDemand;

        // 1) 需要予測（直近と平均のハイブリッド：60%直近 + 40%平均）
        // ただし、平均需要を上限とする（指数級数的増加を防ぐ）
        const forecast = 0.6 * demand + 0.4 * (avgDemand ?? demand);
        const cappedForecast = Math.max(demand, Math.min(forecast, avgDemand * 1.5)); // 平均の1.5倍を上限

        // 2) 目標在庫（需要 × カバー週数）
        const targetStock = cappedForecast * coverWeeks;

        // 3) 在庫ギャップ（在庫が足りないほどプラスになる）
        // ギャップ = 目標在庫 + 欠品*重み - 現在在庫
        // ただし、欠品への反応も上限を設ける
        const cappedBacklog = Math.min(role.backorder, avgDemand * 2); // 欠品の反応は平均需要の2倍まで
        const gap = targetStock + backlogWeight * cappedBacklog - role.inventory;

        // 4) ベース発注量：今見えている需要 + ギャップ補正
        // ただし、急な変動を制限（前回発注の±50%程度）
        let orderBase = demand + invAdjustWeight * Math.max(gap, -demand); // ギャップがマイナスでも需要以上には落ちない

        // 5) 慣性を考慮（前回の発注量との中庸）
        let order = smoothing * role.lastOrder + (1 - smoothing) * orderBase;

        // 6) 急激な変動を制限（前回の50%～150%に抑える）
        const prevOrder = role.lastOrder || demand;
        order = Math.max(prevOrder * 0.5, Math.min(order, prevOrder * 1.5));

        // 7) ランダム揺らぎ（±noiseLevel％）
        const noiseFactor = 1 + (Math.random() * 2 - 1) * noiseLevel;
        order *= noiseFactor;

        // 8) マイナス禁止＆整数に
        order = Math.max(0, Math.round(order));

        return order;
    }

    // 後方互換性のため古いメソッドも提供
    // パニック型AI：需要変化に過剰反応
    static panic(role, demand, params = {}) {
        const avgDemand = role.orderHistory.length > 0 
            ? role.orderHistory.reduce((a, b) => a + b, 0) / role.orderHistory.length 
            : demand;
        return AIStrategy.decideOrder(role, demand, avgDemand, params);
    }

    // 安全型AI：固定の安全在庫を維持
    static safe(role, demand, params = {}) {
        const avgDemand = role.orderHistory.length > 0 
            ? role.orderHistory.reduce((a, b) => a + b, 0) / role.orderHistory.length 
            : demand;
        return AIStrategy.decideOrder(role, demand, avgDemand, params);
    }

    // 冷静型AI：低在庫を追求
    static calm(role, demand, params = {}) {
        const avgDemand = role.orderHistory.length > 0 
            ? role.orderHistory.reduce((a, b) => a + b, 0) / role.orderHistory.length 
            : demand;
        return AIStrategy.decideOrder(role, demand, avgDemand, params);
    }

    // 後方互換性のため aggressive も冷静型にマッピング
    static aggressive(role, demand, params = {}) {
        return AIStrategy.calm(role, demand, params);
    }
    
    // ランダムに戦略を選択
    static random(role, demand, params = {}) {
        const strategies = [AIStrategy.AI_TYPE.PANIC, AIStrategy.AI_TYPE.SAFE, AIStrategy.AI_TYPE.CALM];
        const randomStrategy = strategies[Math.floor(Math.random() * strategies.length)];
        const tempAiType = role.aiType;
        role.aiType = randomStrategy;
        const result = AIStrategy.decideOrder(role, demand, undefined, params);
        role.aiType = tempAiType;
        return result;
    }

    // AIタイプに応じて決定
    static makeDecision(role, demand, avgDemand, aiParams = {}) {
        const strategyParams = aiParams[role.aiType] || {};
        
        // decideOrderを直接使用、中間関数を経由しない
        // これにより外部から渡されたavgDemandを使用でき、ここで再計算する必要がない
        return AIStrategy.decideOrder(role, demand, avgDemand, strategyParams);
    }
}

// ==================== ゲームクラス ====================
class BeerGame {
    constructor() {
        this.roles = {
            retailer: new Role('小売業者', 'retailer'),
            supplier2: new Role('二次卸売業者', 'supplier2'),
            supplier1: new Role('一次卸売業者', 'supplier1'),
            factory: new Role('工場', 'factory')
        };
        this.currentRound = 0;
        this.totalRounds = 30;
        this.transportDelay = 1;
        this.receivingTime = 1;
        this.productionTime = 1;
        this.inventoryCost = 1;
        this.backorderCost = 2;
        this.playerRole = null;
        this.currentPhase = 'receive'; // receive, ship, order
        this.playerShipAmount = 0;
        this.playerOrderAmount = 0;
        this.customerDemand = []; // 顧客需要シーケンス
        this.history = [];
        this.gameStarted = false;
        this.roundHistory = [];
        this.aiParams = {}; // AIパラメータ設定
        this.shippingConfirmed = false;
        this.orderingConfirmed = false;
    }

    // ゲーム初期化
    initialize(playerRole, aiSettings, params) {
        this.playerRole = playerRole;
        this.totalRounds = params.totalRounds;
        this.transportDelay = params.transportDelay;
        this.receivingTime = params.receivingTime;
        this.productionTime = params.productionTime;
        this.inventoryCost = params.inventoryCost;
        this.backorderCost = params.backorderCost;
        
        // AIパラメータの設定（params.aiParams があれば使用）
        this.aiParams = params.aiParams || {};

        // プレイヤーとAIの設定
        Object.keys(this.roles).forEach(roleKey => {
            if (roleKey === playerRole) {
                this.roles[roleKey].isPlayer = true;
            } else {
                this.roles[roleKey].isPlayer = false;
                this.roles[roleKey].aiType = aiSettings[roleKey];
            }
        });

        // 顧客需要シーケンスの生成（最初の4週は需要4、その後は需要8）
        this.customerDemand = Array(4).fill(4).concat(Array(this.totalRounds - 4).fill(8));

        // 各役割の初期在庫と輸送中の商品を設定
        Object.keys(this.roles).forEach(roleKey => {
            const role = this.roles[roleKey];
            
            if (roleKey === 'factory') {
                // 工場: 初期在庫4、生産中の商品なし（第1回合に入荷なし）
                role.inventory = 4;
                role.inTransit = []; // 工場は最初生産中の商品がない
                role.receiving = []; // 工場は入荷処理なし
            } else {
                // その他の役割: 初期在庫12、入荷処理中4、輸送中4
                role.inventory = 12;
                role.receiving = [4]; // 入荷処理中: 4個
                role.inTransit = [4]; // 輸送中: 4個
            }
        });

        this.gameStarted = true;
        this.currentRound = 1;
        this.currentPhase = 'receive';
        
        // 最初の週を開始
        this.startRound();
    }

    // 新しい週を開始
    startRound() {
        this.currentPhase = 'receive';
        this.roundHistory = {
            round: this.currentRound,
            received: 0,
            inventory: 0,
            shipped: 0,
            backorder: 0,
            ordered: 0,
            cost: 0
        };
        
        this.shippingConfirmed = false;
        this.orderingConfirmed = false;
        
        // ✅ ボタン状態をリセット（新しいラウンドの準備）
        const shipInputEl = document.getElementById('shipInput');
        if (shipInputEl) {
            shipInputEl.disabled = false;
        }
        const shipBtnEl = document.querySelector('.ship-btn');
        if (shipBtnEl) {
            shipBtnEl.disabled = false;
        }
        const maxBtnEl = document.querySelector('.max-btn');
        if (maxBtnEl) {
            maxBtnEl.disabled = false;
        }
        
        // 受領フェーズを表示
        this.showReceivePhase();
    }

    // 受領フェーズを表示
    showReceivePhase() {
        const playerRoleObj = this.roles[this.playerRole];
        const isFactory = this.playerRole === 'factory';
        
        console.log(`\n========== 第 ${this.currentRound} ラウンド開始 ==========`);
        
        let receivedToInventory = 0;
        let arrivedToReceiving = 0;
        
        if (isFactory) {
            // ✅ 工場特殊処理：上流がなく、直接入庫
            // 生産中の商品 → 在庫（直接入庫）
            if (playerRoleObj.inTransit.length > 0) {
                receivedToInventory = playerRoleObj.inTransit.shift() || 0;
                if (receivedToInventory > 0) {
                    playerRoleObj.receiveGoods(receivedToInventory);
                    console.log(`プレイヤー ${playerRoleObj.name} 生産完了: ${receivedToInventory}, 在庫残: ${playerRoleObj.inventory}`);
                }
            }
        } else {
            // 通常役割処理：receiving → 在庫
            if (playerRoleObj.receiving.length > 0) {
                receivedToInventory = playerRoleObj.receiving.shift() || 0;
                playerRoleObj.receiveGoods(receivedToInventory);
                console.log(`プレイヤー ${playerRoleObj.name} 入荷: ${receivedToInventory}, 在庫変化: ${playerRoleObj.inventory - receivedToInventory} → ${playerRoleObj.inventory}`);
            }
            
            // 輸送 → 入荷処理エリア
            if (playerRoleObj.inTransit.length > 0) {
                arrivedToReceiving = playerRoleObj.inTransit.shift() || 0;
                if (arrivedToReceiving > 0) {
                    playerRoleObj.receiving.push(arrivedToReceiving);
                    console.log(`プレイヤー ${playerRoleObj.name} 輸送到着: ${arrivedToReceiving}, 入荷処理中へ`);
                }
            }
        }
        
        // ✅ 入荷数量を正しく記録（Factoryも正しく記録）
        this.roundHistory.received = receivedToInventory;
        
        // AI役割：入荷 → 在庫
        Object.values(this.roles).forEach(role => {
            if (!role.isPlayer && role.receiving.length > 0) {
                const toInventory = role.receiving.shift() || 0;
                role.receiveGoods(toInventory);
                console.log(`AI ${role.name} 入荷: ${toInventory}, 在庫: ${role.inventory}`);
            }
        });
        
        // AI役割：輸送 → 入荷
        Object.values(this.roles).forEach(role => {
            if (!role.isPlayer && role.inTransit.length > 0) {
                const aiArrived = role.inTransit.shift() || 0;
                if (aiArrived > 0) {
                    if (role.type === 'factory') {
                        // 工場直接入庫（生産完了）
                        role.receiveGoods(aiArrived);
                        console.log(`${role.name} 生産完了: ${aiArrived}, 在庫: ${role.inventory}`);
                    } else {
                        role.receiving.push(aiArrived);
                        console.log(`${role.name} 輸送到着: ${aiArrived}, 入荷処理中へ`);
                    }
                }
            }
        });
        
        // ラウンド開始確認ウィンドウを表示
        this.showRoundStartModal(receivedToInventory, arrivedToReceiving);
    }
    
    // ラウンド開始通知を表示（自動消滅）
    showRoundStartModal(receivedToInventory, arrivedToReceiving) {
        const playerRoleObj = this.roles[this.playerRole];
        
        // 需要を設定
        this.updateDemand();
        
        // UIを更新
        updateMainUI();
        
        // 短い通知を表示
        const modal = document.getElementById('phaseModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalBtn = document.getElementById('modalConfirmBtn');
        
        modalTitle.textContent = `第${this.currentRound}週`;
        
        let animationHTML = `
            <div class="modal-info toast-notification">
                <p style="font-size: 28px; font-weight: bold; color: #333; text-align: center; margin: 15px 0;">
                    第${this.currentRound}週が開始しました
                </p>
            </div>
        `;
        
        // アニメーション情報を追加
        if (receivedToInventory > 0 || arrivedToReceiving > 0) {
            animationHTML += `
                <div class="animation-info" style="margin-top: 15px;">
                    ${receivedToInventory > 0 ? `
                        <div class="item-animation receiving-to-inventory">
                            <span class="animation-icon">📦</span>
                            <span style="font-size: 16px; color: #333;">在庫に追加: <strong>${receivedToInventory}個</strong></span>
                        </div>
                    ` : ''}
                    ${arrivedToReceiving > 0 ? `
                        <div class="item-animation incoming-to-receiving">
                            <span class="animation-icon">🚛</span>
                            <span style="font-size: 16px; color: #333;">入荷処理中: <strong>${arrivedToReceiving}個</strong></span>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        modalBody.innerHTML = animationHTML;
        
        // 確認ボタンを非表示
        modalBtn.style.display = 'none';
        modal.style.display = 'flex';
        
        // 2秒後に自動的に閉じる
        setTimeout(() => {
            modal.style.display = 'none';
            this.currentPhase = 'ship';
            updateMainUI();
        }, 2000);
    }

    // 需要を更新
    updateDemand() {
        const playerRoleObj = this.roles[this.playerRole];
        
        // 需要を確定
        if (this.playerRole === 'retailer') {
            playerRoleObj.currentDemand = this.customerDemand[this.currentRound - 1] || 0;
        } else {
            // 下流から注文を取得
            // 第1ラウンドでは、下流にまだ注文がないため、需要は0
            const downstreamRole = this.getDownstreamRole(this.playerRole);
            playerRoleObj.currentDemand = (this.currentRound > 1 && downstreamRole) ? downstreamRole.lastOrder : 0;
        }
        
        // AIも需要を更新
        Object.keys(this.roles).forEach(roleKey => {
            const role = this.roles[roleKey];
            if (role.isPlayer) return;
            
            if (roleKey === 'retailer') {
                role.currentDemand = this.customerDemand[this.currentRound - 1] || 0;
            } else {
                // 第1ラウンドでは、下流にまだ注文がないため、需要は0
                const downstreamRole = this.getDownstreamRole(roleKey);
                role.currentDemand = (this.currentRound > 1 && downstreamRole) ? downstreamRole.lastOrder : 0;
            }
        });
    }

    // 出荷を確認
    confirmShipping(shipAmount) {
        if (this.shippingConfirmed) return false;
        
        const playerRoleObj = this.roles[this.playerRole];
        
        // 発送すべき総量 = 当期需要 + 累積欠品
        const demand = playerRoleObj.currentDemand || 0;
        const totalNeed = demand + playerRoleObj.backorder;
        
        // 実際に発送できる量 = min(プレイヤー入力, 在庫, 需要)
        // つまり：プレイヤーは最大で在庫量を発送できるが、実際の需要を超えてはいけない（過剰出荷を避ける）
        const maxCanShip = Math.min(shipAmount, playerRoleObj.inventory, totalNeed);
        
        // ✅ ロジック変更：出荷 = 下流の輸送キューを作成、直接在庫を減らすのではない
        // プレイヤー役割が出荷する時、商品を下流役割のinTransitに追加
        const downstreamRole = this.getDownstreamRole(this.playerRole);
        
        if (maxCanShip > 0) {
            // 在庫から減少（すべての役割が在庫を減らす）
            playerRoleObj.inventory -= maxCanShip;
            
            if (downstreamRole) {
                // 下流役割あり：下流の輸送キューへ（次のラウンドでreceivingに到達）
                downstreamRole.inTransit.push(maxCanShip);
                console.log(`プレイヤー ${playerRoleObj.name} 出荷: ${maxCanShip}, ${downstreamRole.name} の輸送中へ`);
            } else {
                // Retailerが消費者へ出荷：在庫を減らすのみ、輸送キューを作成しない
                console.log(`プレイヤー ${playerRoleObj.name} 小売: ${maxCanShip}`);
            }
        }
        
        playerRoleObj.shippedThisRound = maxCanShip; // 今週の出荷量を記録
        
        // 欠品を更新
        const newBackorder = Math.max(0, totalNeed - maxCanShip);
        playerRoleObj.backorder = newBackorder;
        
        this.roundHistory.shipped = maxCanShip;
        this.roundHistory.inventory = playerRoleObj.inventory; // 出荷後の在庫を記録
        this.roundHistory.backorder = newBackorder;
        this.shippingConfirmed = true;
        
        // AI出荷
        this.executeAIShipping();
        
        return true;
    }

    // 発注を確認
    confirmOrdering(orderAmount) {
        if (this.orderingConfirmed) return false;
        
        const playerRoleObj = this.roles[this.playerRole];
        playerRoleObj.placeOrder(orderAmount);
        
        // 注意：注文はすぐに処理されず、次のラウンド開始時に上流が出荷する
        // 工場特殊処理：生産キューへ直接追加
        if (this.playerRole === 'factory') {
            playerRoleObj.inTransit.push(orderAmount);
        }
        
        this.roundHistory.ordered = orderAmount;
        this.orderingConfirmed = true;
        
        // AI発注
        this.executeAIOrders();
        
        // ✅ 発注確認時に上流の出荷を処理しない！
        // 上流の出荷は「出荷」アクションで実行すべき
        
        return true;
    }
    
    // ✅ processUpstreamShipments 削除済み - 出荷ロジックはconfirmShipping/executeAIShippingに移動
    
    // ラウンドを完了
    finishRound() {
        const playerRoleObj = this.roles[this.playerRole];
        
        // ラウンド終了時にコストを計算
        this.calculateCosts();
        
        // 履歴を保存
        this.history.push({...this.roundHistory});
        
        // 各役割の週別統計を保存
        Object.keys(this.roles).forEach(roleKey => {
            const role = this.roles[roleKey];
            const weekStats = {
                week: this.currentRound,
                inventory: role.inventory,
                backorder: role.backorder,
                order: role.lastOrder,
                received: this.roundHistory.received || 0,
                shipped: this.roundHistory.shipped || 0,
                cost: role.totalCost
            };
            role.weeklyStats.push(weekStats);
        });
        
        // ゲームが終了したかチェック
        if (this.currentRound >= this.totalRounds) {
            return true; // ゲーム終了
        }
        
        // 次のラウンドへ
        this.currentRound++;
        return false; // ゲームを続行
    }

    // AI出荷逻辑
    executeAIShipping() {
        const roleOrder = ['factory', 'supplier1', 'supplier2', 'retailer'];
        
        roleOrder.forEach((roleKey, index) => {
            const role = this.roles[roleKey];
            if (role.isPlayer) return; // ✅ プレイヤー役割はここで処理しない（confirmShippingで処理済み）
            
            // 発送すべき総量 = 当期需要 + 累積欠品
            let demand = role.currentDemand || 0;
            const totalNeed = demand + role.backorder;
            
            // 実際に発送できる量 = min(必要量, 在庫)
            // つまり：ある分だけ発送（ただし必要量を超えない）
            const shipped = Math.min(totalNeed, role.inventory);
            
            // ✅ ロジック変更：AI出荷も下流の輸送キューを作成
            if (shipped > 0 && roleKey !== 'retailer') {
                // 在庫から減少
                role.inventory -= shipped;
                // 下流役割の輸送キューへ
                const downstreamRole = this.getDownstreamRole(roleKey);
                if (downstreamRole) {
                    downstreamRole.inTransit.push(shipped);
                    console.log(`AI ${role.name} 出荷: ${shipped}, ${downstreamRole.name} の輸送中へ`);
                }
            } else if (roleKey === 'retailer') {
                // Retailerは消費者へ出荷するだけ、輸送キューを作成しない
                role.inventory -= shipped;
                console.log(`AI ${role.name} 小売: ${shipped}`);
            }
            
            role.shippedThisRound = shipped; // 今週の出荷量を記録
            
            // 欠品を更新：出荷が不足した場合、残りの需要が欠品に
            // ✅ ここではAI役割のbackorderのみ更新、プレイヤーには影響なし
            role.backorder = Math.max(0, totalNeed - shipped);
        });
    }

    // コストを計算
    calculateCosts() {
        Object.values(this.roles).forEach(role => {
            const cost = role.calculateCost(this.inventoryCost, this.backorderCost);
            if (role.isPlayer) {
                this.roundHistory.cost = cost;
            }
        });
    }

    // 下流役割を取得
    getDownstreamRole(roleKey) {
        const chain = {
            'factory': 'supplier1',
            'supplier1': 'supplier2',
            'supplier2': 'retailer',
            'retailer': null
        };
        const downstreamKey = chain[roleKey];
        return downstreamKey ? this.roles[downstreamKey] : null;
    }

    // AI自動発注
    executeAIOrders() {
        Object.keys(this.roles).forEach(roleKey => {
            const role = this.roles[roleKey];
            if (!role.isPlayer) {
                // 平均需要を計算：出荷履歴に基づく
                let avgDemand = 4; // デフォルト値
                if (role.orderHistory.length > 0) {
                    avgDemand = role.orderHistory.reduce((a, b) => a + b, 0) / role.orderHistory.length;
                }
                
                // 必要量を計算：現在の需要が0で小売業者でない場合、デフォルト値4を使用
                let demand = role.currentDemand;
                if (demand === 0 && roleKey !== 'retailer') {
                    demand = 4;
                }
                
                const orderAmount = AIStrategy.makeDecision(
                    role,
                    demand,
                    avgDemand,
                    this.aiParams
                );
                role.placeOrder(orderAmount);
                // 注意：inTransitに直接追加せず、上流の出荷を待つ
                // 工場特殊処理：生産キューへ直接追加
                if (roleKey === 'factory') {
                    role.inTransit.push(orderAmount);
                }
            }
        });
    }

    // ゲームが終了したかチェック
    isGameOver() {
        return this.currentRound > this.totalRounds;
    }

    // 最終スコアを取得
    getFinalScores() {
        return Object.entries(this.roles).map(([key, role]) => ({
            name: role.name,
            cost: role.totalCost,
            backorder: role.backorder,
            isPlayer: role.isPlayer
        })).sort((a, b) => a.cost - b.cost);
    }
}

// ==================== グローバル変数 ====================
let game = null;

// ==================== UI制御関数 ====================

// ゲーム開始
function startGame() {
    const playerRoleBtns = document.querySelectorAll('.role-btn');
    let selectedRole = null;
    
    playerRoleBtns.forEach(btn => {
        if (btn.classList.contains('selected')) {
            selectedRole = btn.dataset.role;
        }
    });

    if (!selectedRole) {
        alert('役割を選択してください！');
        return;
    }

    // 選択されたラウンド数を取得
    const roundBtns = document.querySelectorAll('.round-btn');
    let totalRounds = 30;
    roundBtns.forEach(btn => {
        if (btn.classList.contains('selected')) {
            totalRounds = parseInt(btn.dataset.rounds);
        }
    });

    // AI設定を収集
    const aiSettings = {
        retailer: document.getElementById('retailerAI').value,
        supplier2: document.getElementById('supplier2AI').value,
        supplier1: document.getElementById('supplier1AI').value,
        factory: document.getElementById('factoryAI').value
    };

    // ゲームパラメータを収集
    const params = {
        totalRounds: totalRounds,
        transportDelay: parseInt(document.getElementById('transportDelay').value),
        receivingTime: parseInt(document.getElementById('receivingTime').value),
        productionTime: parseInt(document.getElementById('productionTime').value),
        inventoryCost: parseFloat(document.getElementById('inventoryCost').value),
        backorderCost: parseFloat(document.getElementById('backorderCost').value)
    };

    // ゲームを初期化
    game = new BeerGame();
    game.initialize(selectedRole, aiSettings, params);

    // 画面を切り替え
    document.getElementById('setupPanel').style.display = 'none';
    document.getElementById('gameHeader').style.display = 'block';
    document.getElementById('gamePanel').style.display = 'block';
}

// メインUIを更新
function updateMainUI() {
    if (!game) return;

    const role = game.roles[game.playerRole];
    const roleNames = {
        'retailer': '🏪 小売業者',
        'supplier2': '📦 二次卸売業者',
        'supplier1': '🚚 一次卸売業者',
        'factory': '🏭 工場'
    };

    // ラウンド情報を更新
    document.getElementById('currentRound').textContent = game.currentRound;
    document.getElementById('totalRounds').textContent = game.totalRounds;
    document.getElementById('playerRoleName').textContent = roleNames[game.playerRole];
    
    // 「ホームに戻る」ボタンを表示（ゲーム実行中）
    const resetBtnHeader = document.getElementById('resetBtnHeader');
    if (resetBtnHeader) {
        resetBtnHeader.style.display = 'block';
    }

    // 累計コスト表示を更新
    document.getElementById('totalCost').textContent = role.totalCost;

    // 在庫エリアを更新
    const inventoryDisplay = document.getElementById('inventoryDisplay');
    inventoryDisplay.querySelector('.inventory-count').textContent = role.inventory;
    if (role.inventory < 5) {
        inventoryDisplay.classList.add('low');
    } else {
        inventoryDisplay.classList.remove('low');
    }
    document.getElementById('backorderDisplay').textContent = role.backorder;

    // 出荷エリアを更新
    // ✅ 出荷確認済みなら今週の出荷数と出荷後の発注残を表示、未確認なら出荷必要数を表示
    const backorderForDisplay = role.backorder;
    
    if (game.shippingConfirmed) {
        // 出荷後：今週の出荷数と出荷後の発注残を表示
        const thisRoundShipped = game.roundHistory.shipped || 0;
        const afterShipBackorder = game.roundHistory.backorder || 0;
        document.getElementById('demandDisplay').textContent = thisRoundShipped;
        document.getElementById('backorderNeedDisplay').textContent = afterShipBackorder;
        document.querySelector('.total-need').style.display = 'none';
        // 入力欄を無効化、完了状態を表示
        document.getElementById('shipInput').disabled = true;
        document.querySelector('.ship-btn').disabled = true;
        document.querySelector('.max-btn').disabled = true;
    } else {
        // 出荷前：出荷必要数を表示
        const shippingNeed = role.currentDemand + backorderForDisplay;
        document.getElementById('demandDisplay').textContent = role.currentDemand;
        document.getElementById('backorderNeedDisplay').textContent = backorderForDisplay;
        document.getElementById('totalNeedDisplay').textContent = shippingNeed;
        document.querySelector('.total-need').style.display = 'block';
        // 入力欄を有効化
        document.getElementById('shipInput').disabled = false;
        document.querySelector('.ship-btn').disabled = false;
        document.querySelector('.max-btn').disabled = false;
    }
    
    // 出荷推奨量 = min(必要総量, 在庫)
    // 必要総量 = 当期需要 + 発注残
    if (!game.shippingConfirmed) {
        const totalNeed = role.currentDemand + backorderForDisplay;
        const maxShip = Math.min(totalNeed, role.inventory);
        document.getElementById('shipInput').value = maxShip;
        document.getElementById('shipInput').max = role.inventory;
    }

    // 発注エリアを更新
    const isFactory = game.playerRole === 'factory';
    document.getElementById('orderSectionTitle').textContent = isFactory ? '🏭 生産エリア' : '📝 発注エリア';
    document.getElementById('orderInputLabel').textContent = isFactory ? '生産数量:' : '発注数量:';
    document.querySelector('.order-btn').textContent = isFactory ? '✓ 生産確認' : '✓ 発注確認';
    
    // 「輸送中の商品」タイトルを更新 - 工場は「生産中の商品」を表示
    const transitTitle = document.getElementById('transitTitle');
    if (transitTitle) {
        transitTitle.textContent = isFactory ? '🏭 生産中の商品' : '🚛 輸送中の商品';
    }
    
    // 工場は生産時間、その他の役割は輸送+入荷時間を表示
    const delayTime = isFactory 
        ? game.productionTime 
        : game.transportDelay + game.receivingTime;
    document.getElementById('delayDisplay').textContent = delayTime;
    
    // 発注数量は新ラウンド開始時のみクリア、発注確認後は表示を保持
    if (!game.orderingConfirmed) {
        document.getElementById('orderInput').value = '';
    }

    // 入荷処理エリアを更新
    updateReceivingArea();
    
    // 輸送可視化を更新
    updateTransitTimeline();    // 履歴テーブルを更新
    updateHistoryTable();    // ボタン状態を更新
    updateButtonStates();
}

// 輸送タイムラインを更新
function updateTransitTimeline() {
    if (!game) return;
    
    const role = game.roles[game.playerRole];
    const isFactory = game.playerRole === 'factory';
    const timeline = document.getElementById('transitTimeline');
    timeline.innerHTML = '';
    
    if (role.inTransit.length === 0) {
        const emptyMsg = isFactory ? '生産中の商品がありません' : '輸送中の商品がありません';
        timeline.innerHTML = `<p style="color: #999; text-align: center; width: 100%;">${emptyMsg}</p>`;
        return;
    }
    
    role.inTransit.forEach((amount, index) => {
        const item = document.createElement('div');
        item.className = 'transit-item animation-transit-item';
        if (index === 0) {
            item.classList.add('arriving');
        }
        
        const roundsLeft = index + 1;
        const arrivalRound = game.currentRound + roundsLeft;
        
        // ✅ Factoryは「生産中」と🏭アイコン、その他は「運送中」と🚛アイコンを表示
        const isProductionIcon = isFactory;
        const icon = isProductionIcon ? '🏭' : '🚛';
        const label = isProductionIcon ? '生産中' : '運送中';
        const arrivalText = isProductionIcon ? 
            (index === 0 ? '次週完成' : `${roundsLeft}週後`) :
            (index === 0 ? '次週到着' : `${roundsLeft}週後`);
        
        item.innerHTML = `
            <div style="font-size: 20px; text-align: center;">${icon}</div>
            <div class="transit-round">${arrivalText}</div>
            <div class="transit-amount">${amount}</div>
            <div style="font-size: 12px; color: #999;">第${arrivalRound}週</div>
        `;
        timeline.appendChild(item);
    });
}

// 入荷処理エリアを更新
function updateReceivingArea() {
    if (!game) return;
    
    const role = game.roles[game.playerRole];
    const isFactory = game.playerRole === 'factory';
    const receivingArea = document.getElementById('receivingTimeline');
    
    // ✅ 工場は「直接入庫」を表示、「入荷処理なし」ではない
    if (isFactory) {
        receivingArea.innerHTML = '<p style="color: #999; text-align: center; font-size: 14px;">直接入庫（上游なし）</p>';
        return;
    }
    
    receivingArea.innerHTML = '';
    
    // 入荷処理中の商品を表示（receiving配列）
    if (role.receiving.length > 0) {
        role.receiving.forEach((amount, index) => {
            const item = document.createElement('div');
            item.className = 'receiving-item animation-receiving-item';
            item.innerHTML = `
                <div class="receiving-label">入荷処理中</div>
                <div class="receiving-amount">${amount}</div>
                <div class="receiving-label">個</div>
                <div style="font-size: 12px; color: #999; margin-top: 5px;">次週在庫へ</div>
            `;
            receivingArea.appendChild(item);
        });
    } else {
        receivingArea.innerHTML = '<p style="color: #999; text-align: center; font-size: 14px;">入荷処理中の商品がありません</p>';
    }
}

// 履歴テーブルを更新
function updateHistoryTable() {
    if (!game) return;
    
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    
    if (game.history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999;">履歴がありません</td></tr>';
        return;
    }
    
    // 全履歴を表示、最新が下に
    game.history.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${record.round}</strong></td>
            <td>${record.received}</td>
            <td>${record.inventory}</td>
            <td>${record.shipped}</td>
            <td>${record.backorder}</td>
            <td>${record.ordered}</td>
            <td class="cost-cell">${record.cost}</td>
        `;
        tbody.appendChild(row);
    });
    
    // 最新記録へ自動スクロール
    const container = tbody.parentElement.parentElement;
    container.scrollTop = container.scrollHeight;
}

// ボタン状態を更新
function updateButtonStates() {
    if (!game) return;
    
    const shipBtn = document.querySelector('.ship-btn');
    const orderBtn = document.querySelector('.order-btn');
    const nextBtn = document.getElementById('nextRoundMainBtn');
    
    if (game.currentPhase === 'receive') {
        shipBtn.disabled = true;
        orderBtn.disabled = true;
        nextBtn.disabled = true;
    } else if (game.currentPhase === 'ship') {
        shipBtn.disabled = game.shippingConfirmed;
        orderBtn.disabled = !game.shippingConfirmed || game.orderingConfirmed;
        nextBtn.disabled = !game.shippingConfirmed || !game.orderingConfirmed;
    }
}

// 最大出荷量を設定
function setMaxShipping() {
    if (!game) return;
    const role = game.roles[game.playerRole];
    const totalDemand = role.currentDemand + role.backorder;
    const maxShip = Math.min(totalDemand, role.inventory);
    document.getElementById('shipInput').value = maxShip;
}

// 出荷を確認
function confirmShipping() {
    if (!game) return;
    
    const shipAmount = parseInt(document.getElementById('shipInput').value) || 0;
    
    if (shipAmount < 0) {
        alert('出荷数量は負の数にできません！');
        return;
    }
    
    const role = game.roles[game.playerRole];
    if (shipAmount > role.inventory) {
        alert('出荷数量は在庫を超えられません！');
        return;
    }
    
    if (game.confirmShipping(shipAmount)) {
        updateMainUI();
    }
}

// 発注を確認
function confirmOrder() {
    if (!game) return;
    
    const orderInput = document.getElementById('orderInput');
    const orderAmount = parseInt(orderInput.value);
    
    // 空欄チェック（特に工場は入力必須）
    if (orderInput.value === '' || isNaN(orderAmount)) {
        const isFactory = game.playerRole === 'factory';
        const roleText = isFactory ? '生産数量' : '発注数量';
        alert(`${roleText}を入力してください！`);
        return;
    }
    
    if (orderAmount < 0) {
        const isFactory = game.playerRole === 'factory';
        const errorText = isFactory ? '生産数量は負の数にできません！' : '発注数量は負の数にできません！';
        alert(errorText);
        return;
    }
    
    if (game.confirmOrdering(orderAmount)) {
        updateMainUI();
    }
}

// 下一回合
function nextRoundMain() {
    if (!game) return;
    
    const gameEnded = game.finishRound();
    
    if (gameEnded) {
        showResults();
        return;
    }
    
    game.startRound();
}

// 結果を表示
function showResults() {
    document.getElementById('gamePanel').style.display = 'none';
    document.getElementById('resultPanel').style.display = 'block';

    const finalScores = game.getFinalScores();
    
    // スコアカード表示
    const scoresContainer = document.getElementById('scoresTab');
    scoresContainer.innerHTML = '';
    
    // サプライチェーン総コストを計算
    let totalSupplyChainCost = 0;

    finalScores.forEach((score) => {
        totalSupplyChainCost += score.cost;
        const card = document.createElement('div');
        card.className = 'score-card';
        card.innerHTML = `
            <h3>${score.name} ${score.isPlayer ? '(あなた)' : ''}</h3>
            <div class="final-cost">総コスト: ${score.cost} ドル</div>
            <div class="backorder-display">受注残: ${score.backorder} 個</div>
        `;
        scoresContainer.appendChild(card);
    });
    
    // 添加供应链总成本卡片
    const totalCard = document.createElement('div');
    totalCard.className = 'score-card winner';
    totalCard.innerHTML = `
        <h3>🏭 サプライチェーン総コスト</h3>
        <div class="final-cost">${totalSupplyChainCost} ドル</div>
    `;
    scoresContainer.appendChild(totalCard);
    
    // 詳細データテーブル表示
    showStatisticsTable();
    
    // グラフ表示
    showStatisticsCharts();
    
    // デフォルトでスコアタブを表示
    switchStatsTab('scores');
}

// 統計テーブルを表示
function showStatisticsTable() {
    const container = document.getElementById('statsTableContainer');
    container.innerHTML = '';
    
    // 各役割のテーブルを作成
    Object.keys(game.roles).forEach(roleKey => {
        const role = game.roles[roleKey];
        
        const roleSection = document.createElement('div');
        roleSection.style.marginBottom = '30px';
        
        const roleTitle = document.createElement('h3');
        roleTitle.textContent = `📊 ${role.name}${role.isPlayer ? ' (あなた)' : ''}`;
        roleTitle.style.marginBottom = '15px';
        roleTitle.style.color = '#333';
        
        const table = document.createElement('table');
        table.className = 'stats-table';
        
        // テーブルヘッダー
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>週</th>
                <th>入荷</th>
                <th>在庫</th>
                <th>出荷</th>
                <th>欠品</th>
                <th>発注</th>
                <th>累計コスト</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // テーブルボディ
        const tbody = document.createElement('tbody');
        role.weeklyStats.forEach(stat => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td class="role-name">${stat.week}</td>
                <td class="data-cell">${stat.received}</td>
                <td class="data-cell highlight">${stat.inventory}</td>
                <td class="data-cell">${stat.shipped}</td>
                <td class="data-cell ${stat.backorder > 0 ? 'warning' : ''}">${stat.backorder}</td>
                <td class="data-cell">${stat.order}</td>
                <td class="data-cell ${stat.cost > 10 ? 'warning' : 'success'}">${stat.cost}</td>
            `;
        });
        table.appendChild(tbody);
        
        roleSection.appendChild(roleTitle);
        roleSection.appendChild(table);
        container.appendChild(roleSection);
    });
}

// 統計グラフを表示
function showStatisticsCharts() {
    // Chart.jsが読み込まれているか確認
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded');
        return;
    }
    
    const roleNames = Object.keys(game.roles).map(k => game.roles[k].name);
    const roleKeys = Object.keys(game.roles);
    
    // チャート用のデータを準備
    const weeks = [];
    const roleDatasets = {};
    
    // 週の列を初期化
    for (let i = 1; i <= game.totalRounds; i++) {
        weeks.push(`W${i}`);
    }
    
    // 各役割のデータを整理
    roleKeys.forEach(roleKey => {
        const role = game.roles[roleKey];
        roleDatasets[roleKey] = {
            labels: weeks,
            inventory: role.weeklyStats.map(s => s.inventory),
            backorder: role.weeklyStats.map(s => s.backorder),
            order: role.weeklyStats.map(s => s.order),
            cost: role.weeklyStats.map(s => s.cost)
        };
    });
    
    const colors = {
        'retailer': '#3b82f6',
        'supplier2': '#10b981',
        'supplier1': '#f59e0b',
        'factory': '#ef4444'
    };
    
    // 1. 在庫推移グラフ
    const inventoryCtx = document.getElementById('inventoryChart').getContext('2d');
    new Chart(inventoryCtx, {
        type: 'line',
        data: {
            labels: weeks,
            datasets: roleKeys.map(roleKey => ({
                label: game.roles[roleKey].name,
                data: roleDatasets[roleKey].inventory,
                borderColor: colors[roleKey],
                backgroundColor: colors[roleKey] + '20',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 2
            }))
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: '📦 在庫推移' },
                legend: { display: true, position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: '在庫数' } }
            }
        }
    });
    
    // 2. 欠品推移グラフ
    const backorderCtx = document.getElementById('backorderChart').getContext('2d');
    new Chart(backorderCtx, {
        type: 'line',
        data: {
            labels: weeks,
            datasets: roleKeys.map(roleKey => ({
                label: game.roles[roleKey].name,
                data: roleDatasets[roleKey].backorder,
                borderColor: colors[roleKey],
                backgroundColor: colors[roleKey] + '20',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 2
            }))
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: '⚠️ 欠品推移' },
                legend: { display: true, position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: '欠品数' } }
            }
        }
    });
    
    // 3. 発注推移グラフ
    const orderCtx = document.getElementById('orderChart').getContext('2d');
    new Chart(orderCtx, {
        type: 'bar',
        data: {
            labels: weeks,
            datasets: roleKeys.map(roleKey => ({
                label: game.roles[roleKey].name,
                data: roleDatasets[roleKey].order,
                backgroundColor: colors[roleKey],
                borderColor: colors[roleKey],
                borderWidth: 1
            }))
        },
        options: {
            responsive: true,
            indexAxis: 'x',
            plugins: {
                title: { display: true, text: '📝 発注推移' },
                legend: { display: true, position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: '発注数' } }
            }
        }
    });
    
    // 4. コスト累積グラフ
    const costCtx = document.getElementById('costChart').getContext('2d');
    new Chart(costCtx, {
        type: 'line',
        data: {
            labels: weeks,
            datasets: roleKeys.map(roleKey => ({
                label: game.roles[roleKey].name,
                data: roleDatasets[roleKey].cost,
                borderColor: colors[roleKey],
                backgroundColor: colors[roleKey] + '20',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 2
            }))
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: '💰 累計コスト推移' },
                legend: { display: true, position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'コスト（ドル）' } }
            }
        }
    });
}

// タブ切り替え関数
function switchStatsTab(tabName) {
    // すべてのタブコンテンツを非表示
    document.querySelectorAll('.stats-tab-content').forEach(el => {
        el.style.display = 'none';
    });
    
    // すべてのタブボタンを非アクティブ
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('active');
    });
    
    // 選択されたタブを表示
    const tabContent = document.getElementById(tabName + 'Tab');
    if (tabContent) {
        tabContent.style.display = 'block';
    }
    
    // 選択されたタブボタンをアクティブ
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach((btn, index) => {
        if ((index === 0 && tabName === 'scores') ||
            (index === 1 && tabName === 'table') ||
            (index === 2 && tabName === 'charts')) {
            btn.classList.add('active');
        }
    });
}

// ゲームをリセット
// 语言选择
let currentLanguage = 'ja';
let currentGameMode = 'classic'; // 当前游戏模式

// 语言包
const translations = {
    ja: {
        title: 'ビールゲーム',
        subtitle: 'サプライチェーンマネジメント学習ゲーム',
        langSelect: '言語選択',
        singlePlayer: 'シングルプレイヤー',
        multiPlayer: 'マルチプレイヤー',
        comingSoon: '（近日公開）',
        modeSelect: 'ゲームモード選択',
        classicMode: 'クラシックモード',
        classicDesc: '伝統的なビールゲーム体験',
        classicFeature1: '標準的なルール',
        classicFeature2: '4つの役割',
        classicFeature3: 'サプライチェーン管理学習',
        cardMode: 'カードモード',
        cardDesc: 'カードを使った新しい体験',
        cardFeature1: '特殊カード効果',
        cardFeature2: '戦略的要素追加',
        cardFeature3: 'より高い挑戦性',
        customMode: 'カスタムモード',
        customDesc: '自由にゲームをカスタマイズ',
        customFeature1: 'パラメータ調整',
        customFeature2: '特殊ルール設定',
        customFeature3: '高度なカスタマイズ',
        back: '戻る',
        gameSetup: '⚙️ ゲーム設定',
        totalWeeks: '📅 総週数',
        weeks20: '20週',
        weeks30: '30週',
        weeks40: '40週',
        weeks50: '50週',
        weeks60: '60週',
        selectRole: '👤 役割を選択してください',
        roleRetailer: '🏪 小売業者',
        roleSupplier2: '📦 二次卸売業者',
        roleSupplier1: '🚚 一次卸売業者',
        roleFactory: '🏭 工場',
        aiSettings: '🤖 AI役割設定',
        retailerAI: '小売業者 AI:',
        supplier2AI: '二次卸売業者 AI:',
        supplier1AI: '一次卸売業者 AI:',
        factoryAI: '工場 AI:',
        aiRandom: 'ランダム',
        aiPanic: 'パニック型',
        aiSafe: '安全型',
        aiCalm: '冷静型',
        gameParams: '🎮 ゲームパラメータ',
        transportDelay: '🚛 輸送遅延:',
        receivingTime: '📥 入荷時間:',
        productionTime: '🏭 生産時間:',
        inventoryCost: '💰 在庫コスト:',
        backorderCost: '⚠️ 欠品コスト:',
        weeks: '週',
        dollarsPerUnit: 'ドル/個',
        eventCards: '🎴 イベントカード',
        enableEventCards: 'イベントカードを有効にする',
        eventCardsDevMsg: '🚧 この機能は開発中です（近日公開予定）',
        startGame: '🎮 ゲーム開始'
    },
    zh: {
        title: '啤酒游戏',
        subtitle: '供应链管理学习游戏',
        langSelect: '语言选择',
        singlePlayer: '单人模式',
        multiPlayer: '多人模式',
        comingSoon: '（即将推出）',
        modeSelect: '游戏模式选择',
        classicMode: '经典模式',
        classicDesc: '传统的啤酒游戏体验',
        classicFeature1: '标准规则',
        classicFeature2: '4个角色',
        classicFeature3: '供应链管理学习',
        cardMode: '卡牌模式',
        cardDesc: '使用卡牌的全新体验',
        cardFeature1: '特殊卡牌效果',
        cardFeature2: '增加策略要素',
        cardFeature3: '更高挑战性',
        customMode: '自定义模式',
        customDesc: '自由自定义游戏',
        customFeature1: '调整参数',
        customFeature2: '设置特殊规则',
        customFeature3: '高级自定义',
        back: '返回',
        gameSetup: '⚙️ 游戏设置',
        totalWeeks: '📅 总周数',
        weeks20: '20周',
        weeks30: '30周',
        weeks40: '40周',
        weeks50: '50周',
        weeks60: '60周',
        selectRole: '👤 请选择角色',
        roleRetailer: '🏪 零售商',
        roleSupplier2: '📦 二级批发商',
        roleSupplier1: '🚚 一级批发商',
        roleFactory: '🏭 工厂',
        aiSettings: '🤖 AI角色设置',
        retailerAI: '零售商 AI:',
        supplier2AI: '二级批发商 AI:',
        supplier1AI: '一级批发商 AI:',
        factoryAI: '工厂 AI:',
        aiRandom: '随机',
        aiPanic: '恐慌型',
        aiSafe: '安全型',
        aiCalm: '冷静型',
        gameParams: '🎮 游戏参数',
        transportDelay: '🚛 运输延迟:',
        receivingTime: '📥 收货时间:',
        productionTime: '🏭 生产时间:',
        inventoryCost: '💰 库存成本:',
        backorderCost: '⚠️ 缺货成本:',
        weeks: '周',
        dollarsPerUnit: '美元/个',
        eventCards: '🎴 事件卡牌',
        enableEventCards: '启用事件卡牌',
        eventCardsDevMsg: '🚧 此功能正在开发中（即将推出）',
        startGame: '🎮 开始游戏'
    }
};

function selectLanguage(lang) {
    currentLanguage = lang;
    // 更新按钮激活状态
    document.querySelectorAll('.lang-btn').forEach(btn => {
        const btnLang = btn.onclick.toString().includes("'ja'") ? 'ja' : 'zh';
        btn.classList.toggle('active', btnLang === lang);
    });
    updateLanguage();
}

function updateLanguage() {
    const t = translations[currentLanguage];
    // 更新所有带data-lang属性的元素
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (t[key]) {
            // 对于按钮元素，更新innerHTML以保留图标
            if (el.tagName === 'BUTTON') {
                // 保留表情符号
                const emoji = el.textContent.match(/[\u{1F300}-\u{1F9FF}]/u);
                if (emoji) {
                    el.textContent = `${emoji[0]} ${t[key].replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim()}`;
                } else {
                    el.textContent = t[key];
                }
            } else {
                el.textContent = t[key];
            }
        }
    });
    document.title = t.title;
}

// 显示首页
function showHomePage() {
    const homePage = document.getElementById('homePage');
    homePage.style.display = 'flex';
    homePage.style.alignItems = 'center';
    homePage.style.justifyContent = 'center';
    document.getElementById('modePage').style.display = 'none';
    document.getElementById('gameHeader').style.display = 'none';
    document.getElementById('setupPanel').style.display = 'none';
    const gameArea = document.querySelector('.game-area');
    if (gameArea) gameArea.style.display = 'none';
    const gamePanel = document.getElementById('gamePanel');
    if (gamePanel) gamePanel.style.display = 'none';
    const resultPanel = document.getElementById('resultPanel');
    if (resultPanel) resultPanel.style.display = 'none';
}

// 显示模式选择页
function showModePage() {
    document.getElementById('homePage').style.display = 'none';
    const modePage = document.getElementById('modePage');
    modePage.style.display = 'flex';
    modePage.style.alignItems = 'center';
    modePage.style.justifyContent = 'center';
    document.getElementById('gameHeader').style.display = 'none';
    document.getElementById('setupPanel').style.display = 'none';
    const gameArea = document.querySelector('.game-area');
    if (gameArea) gameArea.style.display = 'none';
    const gamePanel = document.getElementById('gamePanel');
    if (gamePanel) gamePanel.style.display = 'none';
}

// 选择游戏模式
function selectMode(mode) {
    currentGameMode = mode;
    if (mode === 'classic' || mode === 'custom') {
        showGameSetup(mode);
    } else {
        alert(currentLanguage === 'ja' ? 'このモードは近日公開予定です' : '此模式即将推出');
    }
}

// 显示游戏设置页面
function showGameSetup(mode) {
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('modePage').style.display = 'none';
    document.getElementById('gameHeader').style.display = 'none';
    document.getElementById('setupPanel').style.display = 'block';
    const gameArea = document.querySelector('.game-area');
    if (gameArea) gameArea.style.display = 'none';
    const gamePanel = document.getElementById('gamePanel');
    if (gamePanel) gamePanel.style.display = 'none';
    
    // 根据模式显示/隐藏设置选项
    const isClassicMode = mode === 'classic';
    
    // 经典模式：隐藏所有参数和AI设置区域
    document.querySelectorAll('.setup-section').forEach(section => {
        if (section.querySelector('#retailerAI') || section.querySelector('#transportDelay')) {
            section.style.display = isClassicMode ? 'none' : 'block';
        }
    });
    
    // 经典模式：只显示20/30/40周，隐藏50/60周
    document.querySelectorAll('.round-btn').forEach(btn => {
        const rounds = parseInt(btn.getAttribute('data-rounds'));
        if (isClassicMode && (rounds === 50 || rounds === 60)) {
            btn.style.display = 'none';
        } else {
            btn.style.display = 'inline-block';
        }
    });
    
    // 事件卡片选项：暂时隐藏（未实现）
    const eventCardSection = document.getElementById('eventCardSection');
    if (eventCardSection) {
        eventCardSection.style.display = mode === 'custom' ? 'block' : 'none';
        // 自定义模式下也暂时禁用（功能未实现）
        const eventCheckbox = document.getElementById('enableEventCards');
        if (eventCheckbox) {
            eventCheckbox.disabled = true;
            eventCheckbox.checked = false;
        }
    }
}

function resetGame() {
    game = null;
    showHomePage();
    
    // 清除选择
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // 重置AI设置
    updateAISettings();
    
    // 重置游戏模式
    currentGameMode = 'classic';
}

// 更新AI设置：禁用玩家选择的角色对应的AI下拉框
function updateAISettings() {
    // 获取玩家选择的角色
    const selectedRoleBtn = document.querySelector('.role-btn.selected');
    const playerRole = selectedRoleBtn ? selectedRoleBtn.getAttribute('data-role') : null;
    
    // AI设置映射
    const aiSelects = {
        'retailer': document.getElementById('retailerAI'),
        'supplier2': document.getElementById('supplier2AI'),
        'supplier1': document.getElementById('supplier1AI'),
        'factory': document.getElementById('factoryAI')
    };
    
    // 重置所有AI设置
    Object.entries(aiSelects).forEach(([role, select]) => {
        if (select) {
            if (role === playerRole) {
                // 禁用玩家选择的角色
                select.disabled = true;
                select.value = 'random'; // 设置为默认值
                select.style.opacity = '0.5';
                select.style.cursor = 'not-allowed';
            } else {
                // 启用其他角色
                select.disabled = false;
                select.style.opacity = '1';
                select.style.cursor = 'pointer';
            }
        }
    });
}

// ==================== 事件监听 ====================

document.addEventListener('DOMContentLoaded', () => {
    // 回合数选择
    document.querySelectorAll('.round-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.round-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    // 角色选择
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            
            // 更新AI设置：禁用玩家选择的角色对应的AI设置
            updateAISettings();
        });
    });

    // ゲーム開始按钮
    document.getElementById('startBtn').addEventListener('click', startGame);
});
