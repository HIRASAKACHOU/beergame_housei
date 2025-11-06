// ==================== コアクラス定義 ====================

// 役割クラス
class Role {
    constructor(name, type) {
        this.name = name;
        this.type = type; // 'retailer', 'supplier2', 'supplier1', 'factory'
        this.inventory = 12; // 初期在庫
        this.backorder = 0; // 欠品量
        this.inTransit = []; // 輸送中の商品キュー
        this.incomingOrders = []; // 受注キュー
        this.currentDemand = 0; // 現在の需要
        this.totalCost = 0; // 累計コスト
        this.orderHistory = []; // 発注履歴
        this.isPlayer = false; // プレイヤーかどうか
        this.aiType = 'safe'; // AIタイプ
        this.lastOrder = 0; // 前回の発注量
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

// AI戦略クラス
class AIStrategy {
    // パニック型AI：需要変化に過剰反応
    static panic(role, demand) {
        const randomFactor = Math.random() * 0.2 - 0.1; // -10% to +10%
        const orderAmount = Math.max(0, Math.round(demand * 1.5 * (1 + randomFactor)));
        return orderAmount;
    }

    // 安全型AI：固定の安全在庫を維持
    static safe(role, demand) {
        const safetyStock = 8;
        const targetInventory = safetyStock + demand;
        const orderAmount = Math.max(0, targetInventory - role.inventory + demand);
        return Math.round(orderAmount);
    }

    // 積極型AI：低在庫を追求
    static aggressive(role, demand) {
        const orderAmount = Math.max(0, Math.round(demand * 0.9));
        return orderAmount;
    }
    
    // ランダムに戦略を選択
    static random(role, demand) {
        const strategies = ['panic', 'safe', 'aggressive'];
        const randomStrategy = strategies[Math.floor(Math.random() * strategies.length)];
        return AIStrategy[randomStrategy](role, demand);
    }

    // AIタイプに応じて決定
    static makeDecision(role, demand) {
        switch (role.aiType) {
            case 'panic':
                return AIStrategy.panic(role, demand);
            case 'safe':
                return AIStrategy.safe(role, demand);
            case 'aggressive':
                return AIStrategy.aggressive(role, demand);
            case 'random':
                return AIStrategy.random(role, demand);
            default:
                return demand;
        }
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
        this.totalRounds = 20;
        this.transportDelay = 1;
        this.processingTime = 1;
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
    }

    // ゲーム初期化
    initialize(playerRole, aiSettings, params) {
        this.playerRole = playerRole;
        this.transportDelay = params.transportDelay;
        this.processingTime = params.processingTime;
        this.productionTime = params.productionTime;
        this.inventoryCost = params.inventoryCost;
        this.backorderCost = params.backorderCost;

        // プレイヤーとAIの設定
        Object.keys(this.roles).forEach(roleKey => {
            if (roleKey === playerRole) {
                this.roles[roleKey].isPlayer = true;
            } else {
                this.roles[roleKey].isPlayer = false;
                this.roles[roleKey].aiType = aiSettings[roleKey];
            }
        });

        // 顧客需要シーケンスの生成（最初の4ラウンドは需要4、その後は需要8）
        this.customerDemand = Array(4).fill(4).concat(Array(this.totalRounds - 4).fill(8));

        // 輸送中の商品を初期化
        Object.keys(this.roles).forEach(roleKey => {
            // 工場は生産時間を使用、その他の役割は輸送遅延+処理時間を使用
            const totalDelay = roleKey === 'factory' 
                ? this.productionTime 
                : this.transportDelay + this.processingTime;
            this.roles[roleKey].inTransit = Array(totalDelay).fill(4);
        });

        this.gameStarted = true;
        this.currentRound = 1;
        this.currentPhase = 'receive';
        
        // 最初のラウンドを開始
        this.startRound();
    }

    // 新しいラウンドを開始
    startRound() {
        this.currentPhase = 'receive';
        this.roundHistory = {
            round: this.currentRound,
            received: 0,
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
        
        // 执行收货
        let arrived = 0;
        if (playerRoleObj.inTransit.length > 0) {
            arrived = playerRoleObj.inTransit.shift() || 0;
            playerRoleObj.receiveGoods(arrived);
        }
        
        this.roundHistory.received = arrived;
        
        // AI也收货
        Object.values(this.roles).forEach(role => {
            if (!role.isPlayer && role.inTransit.length > 0) {
                const aiArrived = role.inTransit.shift() || 0;
                role.receiveGoods(aiArrived);
            }
        });
        
        // 设置需求
        this.updateDemand();
        
        // 更新UI
        updateMainUI();
        
        // 显示弹窗
        const modal = document.getElementById('phaseModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalBtn = document.getElementById('modalConfirmBtn');
        
        modalTitle.textContent = `第${this.currentRound} ラウンド - 受領確認`;
        modalBody.innerHTML = `
            <div class="modal-info success">
                <p style="font-size: 18px; margin-bottom: 15px;">📦 <strong>今週受領した商品: ${arrived} 個</strong></p>
                <hr style="margin: 15px 0; border: none; border-top: 1px solid #ddd;">
                <p>📊 現在の在庫: <strong>${playerRoleObj.inventory}</strong> 個</p>
                <p>⚠️ 累計欠品: <strong>${playerRoleObj.backorder}</strong> 個</p>
                <p>📋 今週の需要: <strong>${playerRoleObj.currentDemand}</strong> 個</p>
            </div>
            <p style="text-align: center; color: #666; margin-top: 15px;">
                確認をクリックしてメイン操作画面へ
            </p>
        `;
        
        modalBtn.textContent = '確認 → 操作へ';
        modalBtn.onclick = () => {
            modal.style.display = 'none';
            this.currentPhase = 'operation';
            updateMainUI();
        };
        
        modal.style.display = 'flex';
    }
    
    // 更新需求
    updateDemand() {
        const playerRoleObj = this.roles[this.playerRole];
        
        // 确定需求
        if (this.playerRole === 'retailer') {
            playerRoleObj.currentDemand = this.customerDemand[this.currentRound - 1] || 0;
        } else {
            // 从下游获取订单
            const downstreamRole = this.getDownstreamRole(this.playerRole);
            playerRoleObj.currentDemand = downstreamRole ? downstreamRole.lastOrder : 0;
        }
        
        // AI也更新需求
        Object.keys(this.roles).forEach(roleKey => {
            const role = this.roles[roleKey];
            if (role.isPlayer) return;
            
            if (roleKey === 'retailer') {
                role.currentDemand = this.customerDemand[this.currentRound - 1] || 0;
            } else {
                const downstreamRole = this.getDownstreamRole(roleKey);
                role.currentDemand = downstreamRole ? downstreamRole.lastOrder : 0;
            }
        });
    }

    // 确认发货
    confirmShipping(shipAmount) {
        if (this.shippingConfirmed) return false;
        
        const playerRoleObj = this.roles[this.playerRole];
        const totalDemand = playerRoleObj.currentDemand + playerRoleObj.backorder;
        
        // 限制发货量不超过库存
        const actualShip = Math.min(shipAmount, playerRoleObj.inventory);
        
        // 发货
        playerRoleObj.inventory -= actualShip;
        
        // 更新缺货
        const newBackorder = Math.max(0, totalDemand - actualShip);
        playerRoleObj.backorder = newBackorder;
        
        this.roundHistory.shipped = actualShip;
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
        playerRoleObj.inTransit.push(orderAmount);
        
        this.roundHistory.ordered = orderAmount;
        this.orderingConfirmed = true;
        
        // AI订货
        this.executeAIOrders();
        
        // 不在这里计算成本，等到回合结束时计算
        
        return true;
    }
    
    // 完成回合
    finishRound() {
        const playerRoleObj = this.roles[this.playerRole];
        
        // 在回合结束时计算成本
        this.calculateCosts();
        
        // 保存历史
        this.history.push({...this.roundHistory});
        
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
            
            // 确定需求
            let demand = 0;
            if (roleKey === 'retailer') {
                demand = this.customerDemand[this.currentRound - 1] || 0;
            } else if (index < roleOrder.length - 1) {
                const downstreamKey = roleOrder[index + 1];
                const downstreamRole = this.roles[downstreamKey];
                demand = downstreamRole.lastOrder || 0;
            }
            
            role.currentDemand = demand;
            const totalDemand = demand + role.backorder;
            const shipped = Math.min(totalDemand, role.inventory);
            
            role.inventory -= shipped;
            role.backorder = Math.max(0, totalDemand - shipped);
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
                const orderAmount = AIStrategy.makeDecision(role, role.currentDemand || 4);
                role.placeOrder(orderAmount);
                role.inTransit.push(orderAmount);
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

    // 收集AI设置
    const aiSettings = {
        retailer: document.getElementById('retailerAI').value,
        supplier2: document.getElementById('supplier2AI').value,
        supplier1: document.getElementById('supplier1AI').value,
        factory: document.getElementById('factoryAI').value
    };

    // 收集游戏参数
    const params = {
        transportDelay: parseInt(document.getElementById('transportDelay').value),
        processingTime: parseInt(document.getElementById('processingTime').value),
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
    const totalDemand = role.currentDemand + role.backorder;
    document.getElementById('demandDisplay').textContent = role.currentDemand;
    document.getElementById('backorderNeedDisplay').textContent = role.backorder;
    document.getElementById('totalNeedDisplay').textContent = totalDemand;
    
    const maxShip = Math.min(totalDemand, role.inventory);
    document.getElementById('shipInput').value = maxShip;
    document.getElementById('shipInput').max = role.inventory;

    // 更新订货区
    const isFactory = game.playerRole === 'factory';
    document.getElementById('orderSectionTitle').textContent = isFactory ? '🏭 生産エリア' : '📝 订货区';
    document.getElementById('orderInputLabel').textContent = isFactory ? '生産数量:' : '発注数量:';
    document.querySelector('.order-btn').textContent = isFactory ? '✓ 生産確認' : '✓ 発注確認';
    
    // 工厂显示生产时间，其他角色显示运输+处理时间
    const delayTime = isFactory 
        ? game.productionTime 
        : game.transportDelay + game.processingTime;
    document.getElementById('delayDisplay').textContent = delayTime;
    
    // 默认订货值设为上回合需求
    document.getElementById('orderInput').value = role.currentDemand || 4;

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
        item.className = 'transit-item';
        if (index === 0) {
            item.classList.add('arriving');
        }
        
        const roundsLeft = index + 1;
        const arrivalRound = game.currentRound + roundsLeft;
        
        item.innerHTML = `
            <div class="transit-round">${index === 0 ? '次ラウンド到着' : `${roundsLeft}ラウンド後`}</div>
            <div class="transit-amount">${amount}</div>
            <div style="font-size: 12px; color: #999;">第${arrivalRound}回合</div>
        `;
        timeline.appendChild(item);
    });
}

// 更新历史表格
function updateHistoryTable() {
    if (!game) return;
    
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    
    if (game.history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">履歴がありません</td></tr>';
        return;
    }
    
    // 显示所有历史，最新的在下面
    game.history.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${record.round}</strong></td>
            <td>${record.received}</td>
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
    } else if (game.currentPhase === 'operation') {
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
    
    const orderAmount = parseInt(document.getElementById('orderInput').value) || 0;
    
    if (orderAmount < 0) {
        alert('発注数量は負の数にできません！');
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
    const scoresContainer = document.getElementById('finalScores');
    scoresContainer.innerHTML = '';

    finalScores.forEach((score, index) => {
        const card = document.createElement('div');
        card.className = index === 0 ? 'score-card winner' : 'score-card';
        card.innerHTML = `
            <h3>${score.name} ${score.isPlayer ? '(あなた)' : ''}</h3>
            <div class="final-cost">${score.cost} 円</div>
            <div>${index === 0 ? '🏆 最優秀' : `第${index + 1} 名`}</div>
        `;
        scoresContainer.appendChild(card);
    });
}

// 重置游戏
function resetGame() {
    game = null;
    document.getElementById('setupPanel').style.display = 'block';
    document.getElementById('gamePanel').style.display = 'none';
    document.getElementById('resultPanel').style.display = 'none';
    document.getElementById('phaseModal').style.display = 'none';
    
    // 清除选择
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
}

// ==================== 事件监听 ====================

document.addEventListener('DOMContentLoaded', () => {
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
