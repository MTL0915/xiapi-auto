// 配置区域
const CONFIG = {
    keywords: ['car', 'phone', 'watch', 'desk'],
    maxPrice: 100,
    minPrice: 10,
    category: '11044964',
    maxPages: 2,
    delay: 3000,
    scrollDelay: 1000
};

// 状态管理
const STATE = {
    currentKeywordIndex: 0,
    currentPage: 0,
    collectedData: [],
    isRunning: false
};

// 工具函数
const Utils = {
    log: (message, type = 'info') => {
        const colors = { info: 'blue', success: 'green', warning: 'orange', error: 'red' };
        console.log(`%c${message}`, `color: ${colors[type]}; font-weight: bold;`);
    },
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    buildSearchURL: (keyword, page = 0) => {
        const baseParams = {
            category: CONFIG.category,
            keyword: encodeURIComponent(keyword),
            maxPrice: CONFIG.maxPrice,
            minPrice: CONFIG.minPrice,
            page: page,
            locations: '%E0%B8%A0%E0%B8%B2%E0%B8%A2%E0%B9%83%E0%B8%99%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B9%80%E0%B8%97%E0%B8%A8',
            noCorrection: 'true',
            filters: '116'
        };
        const params = new URLSearchParams(baseParams);
        return `https://shopee.co.th/search?${params.toString()}`;
    },
    downloadCSV: (data) => {
        const headers = '商品关键词,页码,商品名称,价格(฿),商品链接\n';
        const csvContent = data.map(item => 
            `"${item.keyword}",${item.page},"${item.name.replace(/"/g, '""')}",${item.price},"${item.link}"`
        ).join('\n');
        const blob = new Blob(['\uFEFF' + headers + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `shopee_products_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }
};

// 商品收集功能
const ProductCollector = {
    scrollToLoadAll: async () => {
        let lastHeight = document.documentElement.scrollHeight;
        let scrollCount = 0;
        while (scrollCount < 5) {
            window.scrollTo(0, document.documentElement.scrollHeight);
            await Utils.wait(CONFIG.scrollDelay);
            const newHeight = document.documentElement.scrollHeight;
            if (newHeight === lastHeight) break;
            lastHeight = newHeight;
            scrollCount++;
        }
        window.scrollTo(0, 0);
    },
    collectCurrentPage: () => {
        const collected = [];
        const productCards = document.querySelectorAll('[data-sqe="item"]');
        productCards.forEach((card, index) => {
            try {
                const nameElement = card.querySelector('.line-clamp-2') || card.querySelector('[data-sqe="name"]');
                const linkElement = card.querySelector('a[href*="/i."]') || card.querySelector('a.contents');
                const priceElement = card.querySelector('.text-shopee-primary .text-base') || card.querySelector('[class*="text-base"]');
                if (nameElement && linkElement && priceElement) {
                    const name = nameElement.textContent?.trim() || '未知商品';
                    const link = 'https://shopee.co.th' + linkElement.getAttribute('href');
                    const priceText = priceElement.textContent?.replace(/[^\d]/g, '') || '0';
                    const price = parseInt(priceText) || 0;
                    collected.push({
                        keyword: CONFIG.keywords[STATE.currentKeywordIndex],
                        page: STATE.currentPage,
                        index: index + 1,
                        name: name,
                        price: price,
                        link: link
                    });
                }
            } catch (error) {
                Utils.log(`收集第 ${index + 1} 个商品时出错`, 'error');
            }
        });
        STATE.collectedData.push(...collected);
        Utils.log(`第 ${STATE.currentPage + 1} 页收集到 ${collected.length} 个商品`, 'success');
        return collected.length;
    },
    hasNextPage: () => STATE.currentPage < CONFIG.maxPages - 1,
    goToNextPage: () => {
        if (ProductCollector.hasNextPage()) {
            STATE.currentPage++;
            const nextURL = Utils.buildSearchURL(CONFIG.keywords[STATE.currentKeywordIndex], STATE.currentPage);
            window.location.href = nextURL;
            return true;
        }
        return false;
    },
    switchToNextKeyword: () => {
        STATE.currentKeywordIndex++;
        STATE.currentPage = 0;
        if (STATE.currentKeywordIndex < CONFIG.keywords.length) {
            const nextURL = Utils.buildSearchURL(CONFIG.keywords[STATE.currentKeywordIndex]);
            window.location.href = nextURL;
            return true;
        }
        return false;
    }
};

// 自动执行流程
const Automation = {
    start: async () => {
        if (STATE.isRunning) return;
        STATE.isRunning = true;
        Utils.log('开始自动收集商品数据', 'success');
        await Utils.wait(2000);
        await ProductCollector.scrollToLoadAll();
        ProductCollector.collectCurrentPage();
        if (ProductCollector.hasNextPage()) {
            setTimeout(() => ProductCollector.goToNextPage(), CONFIG.delay);
        } else if (ProductCollector.switchToNextKeyword()) {
            Utils.log(`切换到: "${CONFIG.keywords[STATE.currentKeywordIndex]}"`, 'info');
        } else {
            Automation.finish();
        }
    },
    finish: () => {
        STATE.isRunning = false;
        const totalCount = STATE.collectedData.length;
        Utils.log(`完成! 共 ${totalCount} 条记录`, 'success');
        console.table(STATE.collectedData);
        Utils.downloadCSV(STATE.collectedData);
        if (document.getElementById('collector-status')) {
            document.getElementById('collector-status').textContent = `已完成: ${totalCount} 条记录`;
        }
    },
    stop: () => {
        STATE.isRunning = false;
        Utils.log('已停止', 'warning');
    }
};

// 创建控制面板
const ControlPanel = {
    create: () => {
        if (document.getElementById('shopee-collector-panel')) return;
        const panel = document.createElement('div');
        panel.id = 'shopee-collector-panel';
        panel.innerHTML = `<div style="position:fixed;top:20px;right:20px;background:white;padding:15px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;font-family:Arial;width:300px;border:1px solid #e0e0e0;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:8px;">
                <h4 style="margin:0;color:#ff6b6b;">🛍️ 虾皮商品收集</h4>
                <button onclick="document.getElementById('shopee-collector-panel').remove()" style="background:none;border:none;font-size:16px;cursor:pointer;color:#999;">×</button>
            </div>
            <div style="margin-bottom:10px;font-size:12px;color:#666;">
                <div>关键词: ${CONFIG.keywords.join(', ')}</div>
                <div>价格: ฿${CONFIG.minPrice}-${CONFIG.maxPrice}</div>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:10px;">
                <button onclick="window.collectorStart()" style="flex:1;background:#00b894;color:white;border:none;padding:8px;border-radius:4px;cursor:pointer;font-size:12px;">开始</button>
                <button onclick="window.collectorStop()" style="flex:1;background:#e17055;color:white;border:none;padding:8px;border-radius:4px;cursor:pointer;font-size:12px;">停止</button>
            </div>
            <div id="collector-status" style="font-size:11px;color:#666;padding:6px;background:#f8f9fa;border-radius:4px;">状态: 准备就绪</div>
        </div>`;
        document.body.appendChild(panel);
    }
};

// 初始化
window.collectorStart = Automation.start;
window.collectorStop = Automation.stop;
ControlPanel.create();
Utils.log('虾皮商品收集器已加载！', 'success');
