// 言語パックシステム
const LANGUAGES = {
    ja: {
        // ホームページ
        home: {
            title: 'ビールゲーム',
            subtitle: 'サプライチェーンマネジメント学習ゲーム',
            selectLanguage: '言語選択',
            singlePlayer: 'シングルプレイヤー',
            multiPlayer: 'マルチプレイヤー',
            multiPlayerDisabled: '（近日公開）',
        },
        
        // モード選択
        mode: {
            title: 'ゲームモード選択',
            classic: {
                title: 'クラシックモード',
                description: '伝統的なビールゲーム体験',
                feature1: '標準的なルール',
                feature2: '4つの役割',
                feature3: 'サプライチェーン管理学習',
            },
            card: {
                title: 'カードモード',
                description: 'カードを使った新しい体験',
                feature1: '特殊カード効果',
                feature2: '戦略的要素追加',
                feature3: 'より高い挑戦性',
            },
            comingSoon: '近日公開',
        },
        
        // 共通
        common: {
            back: '戻る',
            start: 'ゲーム開始',
        },
        
        // 設定パネル
        setup: {
            title: 'ゲーム設定',
            selectRole: '役割を選択',
            roles: {
                retailer: '小売業者',
                supplier2: '二次卸売業者',
                supplier1: '一次卸売業者',
                factory: '工場',
            },
            roleDesc: {
                retailer: '顧客からの注文を受け、上流に発注します',
                supplier2: '小売業者に供給し、一次卸売業者に発注します',
                supplier1: '二次卸売業者に供給し、工場に発注します',
                factory: '製品を生産し、サプライチェーン全体に供給します',
            },
            aiSettings: 'AI設定',
            aiTypes: {
                panic: 'パニック型',
                safe: '安全型',
                calm: '冷静型',
                random: 'ランダム',
            },
            parameters: 'ゲームパラメータ',
            transportDelay: '運送遅延',
            processingTime: '処理時間',
            productionTime: '生産時間',
            inventoryCost: '在庫コスト',
            backorderCost: '欠品コスト',
            weeks: '週',
            dollar: 'ドル',
            enableEvents: 'イベントカード有効化',
            startGame: 'ゲーム開始',
        },
        
        // ゲーム画面
        game: {
            week: '週',
            totalWeeks: '総週数',
            weekCost: '今週コスト',
            totalCost: '累計コスト',
            inventory: '在庫エリア',
            inventoryCount: '個',
            backorder: '発注残',
            shipping: '出荷エリア',
            demand: '今週の需要',
            backorderNeed: '発注残',
            totalNeed: '出荷必要数',
            shipAmount: '出荷数量',
            max: '最大',
            confirmShip: '✓ 出荷確認',
            ordering: '注文エリア',
            production: '生産エリア',
            orderAmount: '注文数量',
            productionAmount: '生産数量',
            delay: '遅延',
            delayInfo: '回後到着',
            orderInfo: '在庫と需要に基づいて注文量を決定してください',
            confirmOrder: '✓ 注文確認',
            confirmProduction: '✓ 生産確認',
            transit: '運送中の商品',
            receiving: '入荷処理区',
            noTransit: '運送中の商品がありません',
            noReceiving: '入荷処理中の商品がありません',
            directStorage: '直接入庫（上游なし）',
            history: '週別履歴',
            received: '入荷',
            shipped: '出荷',
            ordered: '注文',
            cost: 'コスト',
            nextWeek: '次の週 →',
        },
        
        // 阶段提示
        phase: {
            receiveTitle: '第 {0} 週 - 入荷確認',
            receiveInfo: '📦 今週入荷: {0} 個',
            currentInventory: '📊 現在在庫: {0} 個',
            currentBackorder: '⚠️ 累計欠品: {0} 個',
            currentDemand: '📋 今週需要: {0} 個',
            confirm: '確認 → 操作へ',
        },
        
        // 結果ページ
        result: {
            title: 'ゲーム結果',
            finalScores: '最終スコア',
            you: 'あなた',
            totalCost: '総コスト',
            backorder: '受注残',
            supplyChainCost: '🏭 サプライチェーン総コスト',
            restart: '🔄 ホームに戻る',
        },
        
        // 共通
        common: {
            confirm: '確認',
            cancel: 'キャンセル',
            close: '閉じる',
            loading: '読み込み中...',
            error: 'エラーが発生しました',
        },
    },
    
    zh: {
        // ホームページ
        home: {
            title: '啤酒游戏',
            subtitle: '供应链管理学习游戏',
            selectLanguage: '选择语言',
            singlePlayer: '单人游戏',
            multiPlayer: '多人游戏',
            multiPlayerDisabled: '（即将推出）',
        },
        
        // モード選択
        mode: {
            title: '游戏模式选择',
            classic: {
                title: '经典模式',
                description: '传统的啤酒游戏体验',
                feature1: '标准规则',
                feature2: '4个角色',
                feature3: '供应链管理学习',
            },
            card: {
                title: '卡牌模式',
                description: '使用卡牌的全新体验',
                feature1: '特殊卡牌效果',
                feature2: '增加策略要素',
                feature3: '更高挑战性',
            },
            comingSoon: '即将推出',
        },
        
        // 共通
        common: {
            back: '返回',
            start: '开始游戏',
        },
        
        // 設定パネル
        setup: {
            title: '游戏设置',
            selectRole: '选择你的角色',
            roles: {
                retailer: '零售商',
                supplier2: '二级供应商',
                supplier1: '一级供应商',
                factory: '工厂',
            },
            roleDesc: {
                retailer: '接收客户订单，向上游订货',
                supplier2: '供应零售商，向一级供应商订货',
                supplier1: '供应二级供应商，向工厂订货',
                factory: '生产产品，供应整个供应链',
            },
            aiSettings: 'AI设置',
            aiTypes: {
                panic: '恐慌型',
                safe: '安全型',
                calm: '冷静型',
                random: '随机型',
            },
            parameters: '游戏参数',
            transportDelay: '运输延迟',
            processingTime: '处理时间',
            productionTime: '生产时间',
            inventoryCost: '库存成本',
            backorderCost: '缺货成本',
            weeks: '周',
            dollar: '元',
            enableEvents: '启用事件卡',
            startGame: '开始游戏',
        },
        
        // ゲーム画面
        game: {
            week: '第{0}周',
            totalWeeks: '总周数',
            weekCost: '本周成本',
            totalCost: '累计成本',
            inventory: '库存区',
            inventoryCount: '件',
            backorder: '发注残',
            shipping: '发货区',
            demand: '本周需求',
            backorderNeed: '需补缺货',
            totalNeed: '总需发货',
            shipAmount: '发货数量',
            max: '最大',
            confirmShip: '✓ 确认发货',
            ordering: '订货区',
            production: '生产区',
            orderAmount: '订货数量',
            productionAmount: '生产数量',
            delay: '延迟',
            delayInfo: '回合后到达',
            orderInfo: '💡 根据库存和需求自行决定订货量',
            confirmOrder: '✓ 确认订货',
            confirmProduction: '✓ 确认生产',
            transit: '运输中的货物',
            receiving: '入库处理区',
            noTransit: '暂无运输中的货物',
            noReceiving: '暂无入库处理中的货物',
            directStorage: '直接入库（无上游）',
            history: '历史记录',
            received: '收货',
            shipped: '发货',
            ordered: '订货',
            cost: '成本',
            nextWeek: '下一周 →',
        },
        
        // フェーズ表示
        phase: {
            receiveTitle: '第 {0} 回合 - 收货确认',
            receiveInfo: '📦 本周收到货物: {0} 件',
            currentInventory: '📊 当前库存: {0} 件',
            currentBackorder: '⚠️ 累计缺货: {0} 件',
            currentDemand: '📋 本周需求: {0} 件',
            confirm: '确认 → 进入操作',
        },
        
        // 結果ページ
        result: {
            title: '游戏结果',
            finalScores: '最终得分',
            you: '你',
            totalCost: '总成本',
            backorder: '发注残',
            supplyChainCost: '🏭 供应链总成本',
            restart: '🔄 返回首页',
        },
        
        // 共通
        common: {
            confirm: '确认',
            cancel: '取消',
            close: '关闭',
            loading: '加载中...',
            error: '发生错误',
        },
    },
};

// 現在の言語
let currentLanguage = 'ja';

// 翻訳テキストを取得
function t(path, ...args) {
    const keys = path.split('.');
    let value = LANGUAGES[currentLanguage];
    
    for (const key of keys) {
        if (value && typeof value === 'object') {
            value = value[key];
        } else {
            return path; // 見つからない場合は元のパスを返す
        }
    }
    
    // プレースホルダー {0}, {1} などを置換
    if (typeof value === 'string' && args.length > 0) {
        return value.replace(/\{(\d+)\}/g, (match, index) => {
            return args[parseInt(index)] !== undefined ? args[parseInt(index)] : match;
        });
    }
    
    return value || path;
}

// 言語を設定
function setLanguage(lang) {
    if (LANGUAGES[lang]) {
        currentLanguage = lang;
        localStorage.setItem('beerGameLanguage', lang);
        // 言語変更イベントを発火
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }
}

// 言語を初期化（localStorageから読み込み）
function initLanguage() {
    const savedLang = localStorage.getItem('beerGameLanguage');
    if (savedLang && LANGUAGES[savedLang]) {
        currentLanguage = savedLang;
    }
}

// ページ読み込み時に言語を初期化
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', initLanguage);
}
