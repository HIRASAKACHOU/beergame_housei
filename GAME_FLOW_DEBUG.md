# 游戏流程和数据调用完整诊断

## 1. 游戏开始阶段

### 初始化 (initialize)
```
角色初始化：
  - retailer: inventory=12, receiving=[4], inTransit=[4], lastOrder=0, orderHistory=[]
  - supplier2: inventory=12, receiving=[4], inTransit=[4], lastOrder=0, orderHistory=[]
  - supplier1: inventory=12, receiving=[4], inTransit=[4], lastOrder=0, orderHistory=[]
  - factory: inventory=4, receiving=[], inTransit=[4], lastOrder=0, orderHistory=[]

customerDemand = [4,4,4,4,8,8,8,...]
```

## 2. 第一回合流程

### 2.1 showReceivePhase() - 接收阶段
```
顺序：
1. 玩家接收入荷
   receiving.shift() → 4
   inventory: 12 → 16
   
2. AI 角色接收入荷（retailer 的下游没有人，跳过）
   supplier2: receiving.shift() → 4, inventory: 12 → 16
   supplier1: receiving.shift() → 4, inventory: 12 → 16
   factory: 没有 receiving，跳过

3. 运输中的货物 → 入荷处理中
   玩家: inTransit.shift() → 4
        receiving.push(4)
        
   AI: 
   supplier2: inTransit.shift() → 4, receiving.push(4)
   supplier1: inTransit.shift() → 4, receiving.push(4)
   factory: inTransit.shift() → 4, 工厂直接入库

结果：
- retailer: inventory=16, receiving=[4], inTransit=[]
- supplier2: inventory=16, receiving=[4], inTransit=[]
- supplier1: inventory=16, receiving=[4], inTransit=[]
- factory: inventory=8, receiving=[], inTransit=[]
```

### 2.2 updateDemand() - 需求更新
```
retailer.currentDemand = customerDemand[0] = 4
supplier2.currentDemand = retailer.lastOrder = 0 ❌ 问题来了！
supplier1.currentDemand = supplier2.lastOrder = 0
factory.currentDemand = supplier1.lastOrder = 0
```

### 2.3 confirmShipping(玩家发货) - 玩家发货
```
玩家 retailer 发货 4 个：
- 需要发送：currentDemand(4) + backorder(0) = 4
- 库存充足，发 4 个
- retailer.inventory: 16 → 12
- retailer.backorder: 0

执行 executeAIShipping()：
  supplier2:
    demand = currentDemand = 0 ❌
    totalDemand = 0 + 0 = 0
    发货 0 个！
    
  supplier1:
    demand = currentDemand = 0
    totalDemand = 0 + 0 = 0
    发货 0 个！
    
  factory:
    demand = currentDemand = 0
    发货 0 个！

processUpstreamShipments() 没有被调用 ❌
```

### 2.4 confirmOrdering(玩家订货) - 玩家订货
```
玩家 retailer 下订单 4 个：
- retailer.placeOrder(4)
  → retailer.lastOrder = 4 ✓
  → retailer.orderHistory.push(4)
  
执行 executeAIOrders()：
  supplier2:
    avgDemand = 4（因为 orderHistory 为空，使用默认值 4）✓
    demand = currentDemand = 0
    demand === 0 && roleKey !== 'retailer' → demand = 4 ✓
    
    orderAmount = AIStrategy.makeDecision(supplier2, 4, 4, aiParams)
      → decideOrder(supplier2, 4, 4, {})
      → 计算订单 ≈ 4-6 个左右
    
    supplier2.placeOrder(orderAmount) ✓
      → supplier2.lastOrder = orderAmount
      → supplier2.orderHistory.push(orderAmount)
      
  类似地处理 supplier1 和 factory

执行 processUpstreamShipments() ✓
  循环：supplier1, supplier2, retailer（retailer 跳过）
  
  supplier2 的处理：
    orderAmount = supplier2.lastOrder ✓（刚才设置的）
    但是 supplier2.lastOrder 是 supplier2 的订单量，不是 retailer 的
    
    ❌ 问题：这里应该是 retailer.lastOrder = 4
    但代码用的是 supplier2.lastOrder
    
实际应该的 processUpstreamShipments()：
  - supplier1 处理：从 supplier2 库存发货给 supplier2
    订单量 = supplier2.lastOrder（supplier2 对上游的订单）✓
    
  - supplier2 处理：从 retailer 库存发货给 retailer
    订单量 = retailer.lastOrder = 4 ✓
    
  - retailer 处理：从 supplier2 库存发货给 retailer
    ❌ 不应该处理！retailer 是最下游
```

## 3. 问题汇总

### 问题 1: executeAIShipping() 时 currentDemand 为 0
- **原因**：第一回合时，AI 角色的 currentDemand 基于下游的 lastOrder，但下游还没订单
- **影响**：AI 角色第一回合不发货
- **结果**：supply chain 断掉

### 问题 2: processUpstreamShipments() 中的角色迭代逻辑
```javascript
// 当前代码：
roleOrder.forEach((roleKey, index) => {
    const role = this.roles[roleKey];           // 当前角色（收货人）
    const upstreamKey = roleOrder[index - 1];   // 上游角色（发货人）
    const upstreamRole = this.roles[upstreamKey];
    
    const orderAmount = role.lastOrder || 0;    // 当前角色的订单
    
    // 上游根据当前角色的订单发货
    const shipAmount = Math.min(orderAmount, upstreamRole.inventory);
    upstreamRole.inventory -= shipAmount;
    role.inTransit.push(shipAmount);
});
```

这个逻辑的问题：
- 当 role = retailer 时：
  - upstreamRole = supplier2
  - orderAmount = retailer.lastOrder ✓
  - supplier2 发货给 retailer ✓
  - ✅ 这个是对的！

- 当 role = supplier2 时：
  - upstreamRole = supplier1
  - orderAmount = supplier2.lastOrder
  - supplier1 根据 supplier2 的订单发货 ✓
  - ✅ 这个也是对的！

所以 processUpstreamShipments() 的逻辑其实是对的。

### 问题 3: 第一回合缺少发货的真正原因

**第一回合流程回顾**：
```
1. showReceivePhase() 完成
2. updateDemand()：retailer.currentDemand = 4, 其他 = 0
3. confirmShipping()：
   - 执行 executeAIShipping()（此时各 AI 的 currentDemand = 0，不发货）
4. confirmOrdering()：
   - 执行 executeAIOrders()（设置 lastOrder）
   - 执行 processUpstreamShipments()（此时应该发货）
```

**关键发现**：
processUpstreamShipments() 在第一回合 confirmOrdering 中被调用，
此时 retailer.lastOrder = 4（刚设置），
supplier2 应该看到这个订单并发货！

**但为什么没发货？**

让我查看 processUpstreamShipments 的完整逻辑...

## 4. 数据流追踪（第一回合 confirmOrdering 时）

```
confirmOrdering(orderAmount=4) 被调用：

1. retailer.placeOrder(4)
   → retailer.lastOrder = 4
   → retailer.orderHistory = [4]

2. executeAIOrders()
   → supplier2 计算并订货
   → supplier2.lastOrder = X（某个值）
   → supplier2.orderHistory.push(X)
   
   → supplier1 计算并订货
   → ...

3. processUpstreamShipments()
   roleOrder = ['factory', 'supplier1', 'supplier2', 'retailer']
   
   index=1, roleKey='supplier1':
     role = supplier1
     upstreamRole = factory
     orderAmount = supplier1.lastOrder = X
     shipAmount = min(X, factory.inventory=4)
     factory.inventory -= shipAmount
     supplier1.inTransit.push(shipAmount)
   
   index=2, roleKey='supplier2':
     role = supplier2
     upstreamRole = supplier1
     orderAmount = supplier2.lastOrder = Y
     shipAmount = min(Y, supplier1.inventory)
     supplier1.inventory -= shipAmount
     supplier2.inTransit.push(shipAmount)
   
   index=3, roleKey='retailer':
     role = retailer
     upstreamRole = supplier2
     orderAmount = retailer.lastOrder = 4 ✓✓✓
     shipAmount = min(4, supplier2.inventory=16)
     supplier2.inventory -= 4
     retailer.inTransit.push(4) ✓✓✓
```

**理论上应该发货！**

## 5. 可能的实际问题

1. **processUpstreamShipments 没有被调用？**
   - 检查 confirmOrdering 是否真的调用了它

2. **retailer.inTransit 的货物没有被接收？**
   - 下一回合 showReceivePhase 时，是否正确执行了 inTransit.shift()

3. **数据被覆盖？**
   - 某个地方修改了 retailer.inTransit

## 6. 建议的调试步骤

1. 在 processUpstreamShipments 开始添加 console.log
2. 在 retailer.inTransit.push 时添加 console.log
3. 在 showReceivePhase 时输出 inTransit 和 receiving 的状态
4. 跟踪前 2-3 回合的完整数据变化
