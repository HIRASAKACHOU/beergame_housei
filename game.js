// ==================== コアクラス定義 ====================

// 役割クラス
class Role {
    constructor(name, type) {
        this.name = name;
        this.type = type; // 'retailer', 'supplier2', 'supplier1', 'factory'
        
        // ========== 在庫管理 ==========
        this.inventory = 12; // 現在在庫
        this.backorder = 0; // 欠品量（累積）
        
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
            coverWeeks: 3.0,        // 需要を何週分カバーしたいか（多め）
            backlogWeight: 1.6,     // 欠品への過剰反応度
            invAdjustWeight: 0.9,   // ギャップを発注に反映する強さ
            smoothing: 0.3,         // 前回注文への依存度（小さめ→振れ幅大きい）
            noiseLevel: 0.25        // ランダム揺らぎ（±25%）
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

        // 防护：确保 demand 和 avgDemand 是有效的数字
        demand = isNaN(demand) || demand === null ? 4 : demand;
        avgDemand = isNaN(avgDemand) || avgDemand === null ? 4 : avgDemand;

        // 1) 需要予測（直近と平均のハイブリッド：60%直近 + 40%平均）
        // ただし、平均需要を上限とする（指数級増加を防ぐ）
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
        
        // 直接使用 decideOrder，不经过中间函数
        // 这样可以使用外部传入的 avgDemand，而不是在这里重新计算
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
                // 工場: 初期在庫4、生産時間に応じた生産中の商品
                role.inventory = 4;
                role.inTransit = Array(this.productionTime).fill(4);
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
        
        // 受領フェーズを表示
        this.showReceivePhase();
    }

    // 受領フェーズを表示
    showReceivePhase() {
        const playerRoleObj = this.roles[this.playerRole];
        const isFactory = this.playerRole === 'factory';
        
        console.log(`\n========== 第 ${this.currentRound} 回合开始 ==========`);
        
        // 步骤1: 入荷处理区的货物 → 库存（先处理上一回合到达的）
        let receivedToInventory = 0;
        if (playerRoleObj.receiving.length > 0) {
            receivedToInventory = playerRoleObj.receiving.shift() || 0;
            playerRoleObj.receiveGoods(receivedToInventory);
            console.log(`玩家 ${playerRoleObj.name} 入荷: ${receivedToInventory}, 库存变化: ${playerRoleObj.inventory - receivedToInventory} → ${playerRoleObj.inventory}`);
        }
        
        this.roundHistory.received = receivedToInventory;
        
        // AI角色：入荷 → 库存
        Object.values(this.roles).forEach(role => {
            if (!role.isPlayer && role.receiving.length > 0) {
                const toInventory = role.receiving.shift() || 0;
                role.receiveGoods(toInventory);
                console.log(`AI ${role.name} 入荷: ${toInventory}, 库存: ${role.inventory}`);
            }
        });
        
        // 步骤2: 运输中的货物 → 入荷处理区（本回合新到达的）
        let arrivedToReceiving = 0;
        if (playerRoleObj.inTransit.length > 0) {
            arrivedToReceiving = playerRoleObj.inTransit.shift() || 0;
            if (arrivedToReceiving > 0) {
                playerRoleObj.receiving.push(arrivedToReceiving);
                console.log(`玩家 ${playerRoleObj.name} 运输到达: ${arrivedToReceiving}, 进入入荷处理中`);
            }
        }
        
        // AI角色：运输 → 入荷
        Object.values(this.roles).forEach(role => {
            if (!role.isPlayer && role.inTransit.length > 0) {
                const aiArrived = role.inTransit.shift() || 0;
                if (aiArrived > 0) {
                    if (role.type === 'factory') {
                        // 工厂直接入库（生产完成）
                        role.receiveGoods(aiArrived);
                        console.log(`${role.name} 生产完成: ${aiArrived}, 库存: ${role.inventory}`);
                    } else {
                        role.receiving.push(aiArrived);
                        console.log(`${role.name} 运输到达: ${aiArrived}, 进入入荷处理中`);
                    }
                }
            }
        });
        
        // 显示回合开始确认窗口（合并显示所有信息）
        this.showRoundStartModal(receivedToInventory, arrivedToReceiving);
    }
    
    // 显示回合开始提示（自动消失）
    showRoundStartModal(receivedToInventory, arrivedToReceiving) {
        const playerRoleObj = this.roles[this.playerRole];
        
        // 设置需求
        this.updateDemand();
        
        // 更新UI
        updateMainUI();
        
        // 显示短暂提示
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
        
        // 添加动效信息
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
        
        // 隐藏确认按钮
        modalBtn.style.display = 'none';
        modal.style.display = 'flex';
        
        // 2秒后自动关闭
        setTimeout(() => {
            modal.style.display = 'none';
            this.currentPhase = 'ship';
            updateMainUI();
        }, 2000);
    }

    // 更新需求
    updateDemand() {
        const playerRoleObj = this.roles[this.playerRole];
        
        // 确定需求
        if (this.playerRole === 'retailer') {
            playerRoleObj.currentDemand = this.customerDemand[this.currentRound - 1] || 0;
        } else {
            // 从下游获取订单
            // 第一回合时，下游还没有订单，所以需求为0
            const downstreamRole = this.getDownstreamRole(this.playerRole);
            playerRoleObj.currentDemand = (this.currentRound > 1 && downstreamRole) ? downstreamRole.lastOrder : 0;
        }
        
        // AI也更新需求
        Object.keys(this.roles).forEach(roleKey => {
            const role = this.roles[roleKey];
            if (role.isPlayer) return;
            
            if (roleKey === 'retailer') {
                role.currentDemand = this.customerDemand[this.currentRound - 1] || 0;
            } else {
                // 第一回合时，下游还没有订单，所以需求为0
                const downstreamRole = this.getDownstreamRole(roleKey);
                role.currentDemand = (this.currentRound > 1 && downstreamRole) ? downstreamRole.lastOrder : 0;
            }
        });
    }

    // 确认发货
    confirmShipping(shipAmount) {
        if (this.shippingConfirmed) return false;
        
        const playerRoleObj = this.roles[this.playerRole];
        
        // 需要发送的总量 = 当期需求 + 累积缺货
        const demand = playerRoleObj.currentDemand || 0;
        const totalNeed = demand + playerRoleObj.backorder;
        
        // 实际能发的量 = min(玩家输入, 库存, 需求)
        // 即：玩家最多发库存量，但不应超过实际需求（避免过度发货）
        const maxCanShip = Math.min(shipAmount, playerRoleObj.inventory, totalNeed);
        
        // ✅ 改变逻辑：发货 = 创建下游的运输队列，而非直接减库存
        // 玩家角色发货时，将货物加入到下游角色的 inTransit
        const downstreamRole = this.getDownstreamRole(this.playerRole);
        
        if (maxCanShip > 0) {
            // 从库存减少（所有角色都要减库存）
            playerRoleObj.inventory -= maxCanShip;
            
            if (downstreamRole) {
                // 有下游角色：进入下游的运输队列（下一回合才会到达receiving）
                downstreamRole.inTransit.push(maxCanShip);
                console.log(`玩家 ${playerRoleObj.name} 出荷: ${maxCanShip}, 进入 ${downstreamRole.name} の運送中`);
            } else {
                // Retailer发货给消费者：只减库存，不创建运输队列
                console.log(`玩家 ${playerRoleObj.name} 零売: ${maxCanShip}`);
            }
        }
        
        playerRoleObj.shippedThisRound = maxCanShip; // 记录本周发货量
        
        // 更新缺货
        const newBackorder = Math.max(0, totalNeed - maxCanShip);
        playerRoleObj.backorder = newBackorder;
        
        this.roundHistory.shipped = maxCanShip;
        this.roundHistory.inventory = playerRoleObj.inventory; // 记录发货后的库存
        this.roundHistory.backorder = newBackorder;
        this.shippingConfirmed = true;
        
        // AI发货
        this.executeAIShipping();
        
        return true;
    }

    // 确认订货
    confirmOrdering(orderAmount) {
        if (this.orderingConfirmed) return false;
        
        const playerRoleObj = this.roles[this.playerRole];
        playerRoleObj.placeOrder(orderAmount);
        
        // 注意：订单不会立即处理，而是等到下一回合开始时上游才发货
        // 工厂特殊处理：直接加入生产队列
        if (this.playerRole === 'factory') {
            playerRoleObj.inTransit.push(orderAmount);
        }
        
        this.roundHistory.ordered = orderAmount;
        this.orderingConfirmed = true;
        
        // AI订货
        this.executeAIOrders();
        
        // ✅ 不在确认订货时处理上游发货！
        // 上游的发货应该通过「出荷」动作来执行
        
        return true;
    }
    
    // ✅ processUpstreamShipments 已删除 - 发货逻辑已移至 confirmShipping/executeAIShipping
    
    // 完成回合
    finishRound() {
        const playerRoleObj = this.roles[this.playerRole];
        
        // 在回合结束时计算成本
        this.calculateCosts();
        
        // 保存历史
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
        
        // 检查游戏是否结束
        if (this.currentRound >= this.totalRounds) {
            return true; // 游戏结束
        }
        
        // 进入下一回合
        this.currentRound++;
        return false; // 继续游戏
    }

    // AI发货逻辑
    executeAIShipping() {
        const roleOrder = ['factory', 'supplier1', 'supplier2', 'retailer'];
        
        roleOrder.forEach((roleKey, index) => {
            const role = this.roles[roleKey];
            if (role.isPlayer) return;
            
            // 需要发送的总量 = 当期需求 + 累积缺货
            let demand = role.currentDemand || 0;
            const totalNeed = demand + role.backorder;
            
            // 实际能发的量 = min(需要量, 库存)
            // 即：有多少发多少（但不超过需要量）
            const shipped = Math.min(totalNeed, role.inventory);
            
            // ✅ 改变逻辑：AI发货也是创建下游的运输队列
            if (shipped > 0 && roleKey !== 'retailer') {
                // 从库存减少
                role.inventory -= shipped;
                // 进入下游角色的运输队列
                const downstreamRole = this.getDownstreamRole(roleKey);
                if (downstreamRole) {
                    downstreamRole.inTransit.push(shipped);
                    console.log(`AI ${role.name} 出荷: ${shipped}, 进入 ${downstreamRole.name} の運送中`);
                }
            } else if (roleKey === 'retailer') {
                // Retailer只是发货给消费者，不创建运输队列
                role.inventory -= shipped;
                console.log(`AI ${role.name} 零売: ${shipped}`);
            }
            
            role.shippedThisRound = shipped; // 记录本周发货量
            
            // 更新缺货：如果发货不足，剩余的需求转为缺货
            role.backorder = Math.max(0, totalNeed - shipped);
        });
    }

    // 计算成本
    calculateCosts() {
        Object.values(this.roles).forEach(role => {
            const cost = role.calculateCost(this.inventoryCost, this.backorderCost);
            if (role.isPlayer) {
                this.roundHistory.cost = cost;
            }
        });
    }

    // 获取下游角色
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

    // AI自动下单
    executeAIOrders() {
        Object.keys(this.roles).forEach(roleKey => {
            const role = this.roles[roleKey];
            if (!role.isPlayer) {
                // 计算平均需要：根据发货历史
                let avgDemand = 4; // 默认值
                if (role.orderHistory.length > 0) {
                    avgDemand = role.orderHistory.reduce((a, b) => a + b, 0) / role.orderHistory.length;
                }
                
                // 计算需要量：如果当前需要为0且不是零售商，则使用默认值4
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
                // 注意：不直接加入inTransit，等上游发货
                // 工厂特殊处理：直接加入生产队列
                if (roleKey === 'factory') {
                    role.inTransit.push(orderAmount);
                }
            }
        });
    }

    // 检查游戏是否结束
    isGameOver() {
        return this.currentRound > this.totalRounds;
    }

    // 获取最终得分
    getFinalScores() {
        return Object.entries(this.roles).map(([key, role]) => ({
            name: role.name,
            cost: role.totalCost,
            isPlayer: role.isPlayer
        })).sort((a, b) => a.cost - b.cost);
    }
}

// ==================== 全局变量 ====================
let game = null;

// ==================== UI控制函数 ====================

// 开始游戏
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

    // 获取选择的回合数
    const roundBtns = document.querySelectorAll('.round-btn');
    let totalRounds = 30;
    roundBtns.forEach(btn => {
        if (btn.classList.contains('selected')) {
            totalRounds = parseInt(btn.dataset.rounds);
        }
    });

    // 收集AI设置
    const aiSettings = {
        retailer: document.getElementById('retailerAI').value,
        supplier2: document.getElementById('supplier2AI').value,
        supplier1: document.getElementById('supplier1AI').value,
        factory: document.getElementById('factoryAI').value
    };

    // 収集游戏参数
    const params = {
        totalRounds: totalRounds,
        transportDelay: parseInt(document.getElementById('transportDelay').value),
        receivingTime: parseInt(document.getElementById('receivingTime').value),
        productionTime: parseInt(document.getElementById('productionTime').value),
        inventoryCost: parseFloat(document.getElementById('inventoryCost').value),
        backorderCost: parseFloat(document.getElementById('backorderCost').value)
    };

    // 初始化游戏
    game = new BeerGame();
    game.initialize(selectedRole, aiSettings, params);

    // 切换界面
    document.getElementById('setupPanel').style.display = 'none';
    document.getElementById('gamePanel').style.display = 'block';
}

// 更新主UI
function updateMainUI() {
    if (!game) return;

    const role = game.roles[game.playerRole];
    const roleNames = {
        'retailer': '🏪 小売業者',
        'supplier2': '📦 二次卸売業者',
        'supplier1': '🚚 一次卸売業者',
        'factory': '🏭 工場'
    };

    // 更新回合信息
    document.getElementById('currentRound').textContent = game.currentRound;
    document.getElementById('totalRounds').textContent = game.totalRounds;
    document.getElementById('playerRoleName').textContent = roleNames[game.playerRole];
    
    // 显示"ホームに戻る"按钮（游戏运行时）
    const resetBtnHeader = document.getElementById('resetBtnHeader');
    if (resetBtnHeader) {
        resetBtnHeader.style.display = 'block';
    }

    // 更新成本显示
    const lastRoundCost = game.history.length > 0 ? game.history[game.history.length - 1].cost : 0;
    document.getElementById('roundCost').textContent = lastRoundCost;
    document.getElementById('totalCost').textContent = role.totalCost;

    // 更新库存区
    const inventoryDisplay = document.getElementById('inventoryDisplay');
    inventoryDisplay.querySelector('.inventory-count').textContent = role.inventory;
    if (role.inventory < 5) {
        inventoryDisplay.classList.add('low');
    } else {
        inventoryDisplay.classList.remove('low');
    }
    document.getElementById('backorderDisplay').textContent = role.backorder;

    // 更新发货区
    // 出荷必要数 = 発注残（累積缺货），不需要加上当期需求（当期需求会自动加入発注残）
    const shippingNeed = role.backorder;
    document.getElementById('demandDisplay').textContent = role.currentDemand;
    document.getElementById('backorderNeedDisplay').textContent = role.backorder;
    document.getElementById('totalNeedDisplay').textContent = shippingNeed;
    
    // 发货推荐量 = min(需要总量, 库存)
    // 需要总量 = 当期需求 + 累积缺货
    const totalNeed = role.currentDemand + role.backorder;
    const maxShip = Math.min(totalNeed, role.inventory);
    document.getElementById('shipInput').value = maxShip;
    document.getElementById('shipInput').max = role.inventory;

    // 更新订货区
    const isFactory = game.playerRole === 'factory';
    document.getElementById('orderSectionTitle').textContent = isFactory ? '🏭 生産エリア' : '📝 発注エリア';
    document.getElementById('orderInputLabel').textContent = isFactory ? '生産数量:' : '発注数量:';
    document.querySelector('.order-btn').textContent = isFactory ? '✓ 生産確認' : '✓ 発注確認';
    
    // 更新"輸送中の商品"标题 - 工厂显示"生産中の商品"
    const transitTitle = document.getElementById('transitTitle');
    if (transitTitle) {
        transitTitle.textContent = isFactory ? '🏭 生産中の商品' : '🚛 輸送中の商品';
    }
    
    // 工厂显示生产时间，其他角色显示运输+入荷時間
    const delayTime = isFactory 
        ? game.productionTime 
        : game.transportDelay + game.receivingTime;
    document.getElementById('delayDisplay').textContent = delayTime;
    
    // 订货数量只在新回合开始时清空，确认订货后保留显示
    if (!game.orderingConfirmed) {
        document.getElementById('orderInput').value = '';
    }

    // 更新入荷処理区
    updateReceivingArea();

    // 更新运输可视化
    updateTransitTimeline();

    // 更新历史表格
    updateHistoryTable();
    
    // 更新按钮状态
    updateButtonStates();
}

// 更新运输时间线
function updateTransitTimeline() {
    if (!game) return;
    
    const role = game.roles[game.playerRole];
    const timeline = document.getElementById('transitTimeline');
    timeline.innerHTML = '';
    
    if (role.inTransit.length === 0) {
        timeline.innerHTML = '<p style="color: #999; text-align: center; width: 100%;">輸送中の商品がありません</p>';
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
        
        item.innerHTML = `
            <div class="transit-round">${index === 0 ? '次週到着' : `${roundsLeft}週後`}</div>
            <div class="transit-amount">${amount}</div>
            <div style="font-size: 12px; color: #999;">第${arrivalRound}週</div>
        `;
        timeline.appendChild(item);
    });
}

// 更新入荷処理区
function updateReceivingArea() {
    if (!game) return;
    
    const role = game.roles[game.playerRole];
    const isFactory = game.playerRole === 'factory';
    const receivingArea = document.getElementById('receivingTimeline');
    
    // 工厂不显示入荷处理区
    if (isFactory) {
        receivingArea.innerHTML = '<p style="color: #999; text-align: center; font-size: 14px;">工場は入荷処理なし</p>';
        return;
    }
    
    receivingArea.innerHTML = '';
    
    // 显示入荷处理中的商品（receiving数组）
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

// 更新历史表格
function updateHistoryTable() {
    if (!game) return;
    
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    
    if (game.history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999;">履歴がありません</td></tr>';
        return;
    }
    
    // 显示所有历史，最新的在下面
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
    
    // 自动滚动到最新记录
    const container = tbody.parentElement.parentElement;
    container.scrollTop = container.scrollHeight;
}

// 更新按钮状态
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

// 设置最大发货量
function setMaxShipping() {
    if (!game) return;
    const role = game.roles[game.playerRole];
    const totalDemand = role.currentDemand + role.backorder;
    const maxShip = Math.min(totalDemand, role.inventory);
    document.getElementById('shipInput').value = maxShip;
}

// 确认发货
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

// 确认订货
function confirmOrder() {
    if (!game) return;
    
    const orderInput = document.getElementById('orderInput');
    const orderAmount = parseInt(orderInput.value);
    
    // 检查是否为空（特别是工厂必须填写）
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

// 显示结果
function showResults() {
    document.getElementById('gamePanel').style.display = 'none';
    document.getElementById('resultPanel').style.display = 'block';

    const finalScores = game.getFinalScores();
    
    // スコアカード表示
    const scoresContainer = document.getElementById('scoresTab');
    scoresContainer.innerHTML = '';

    finalScores.forEach((score, index) => {
        const card = document.createElement('div');
        card.className = index === 0 ? 'score-card winner' : 'score-card';
        card.innerHTML = `
            <h3>${score.name} ${score.isPlayer ? '(あなた)' : ''}</h3>
            <div class="final-cost">${score.cost} ドル</div>
            <div class="rank">${index === 0 ? '🏆 最優秀' : `第 ${index + 1} 位`}</div>
        `;
        scoresContainer.appendChild(card);
    });
    
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

// 重置游戏
function resetGame() {
    game = null;
    document.getElementById('setupPanel').style.display = 'block';
    document.getElementById('gamePanel').style.display = 'none';
    document.getElementById('resultPanel').style.display = 'none';
    document.getElementById('phaseModal').style.display = 'none';
    
    // 隐藏"ホームに戻る"按钮
    const resetBtnHeader = document.getElementById('resetBtnHeader');
    if (resetBtnHeader) {
        resetBtnHeader.style.display = 'none';
    }
    
    // 清除选择
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.remove('selected');
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
        });
    });

    // 开始游戏按钮
    document.getElementById('startBtn').addEventListener('click', startGame);
});
