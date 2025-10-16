javascript:(function(){
    // 短书签代码 - 直接内嵌所有功能
    const CONFIG = {
        keywords: ['car', 'phone', 'watch', 'desk'],
        maxPrice: 100,
        minPrice: 10,
        category: '11044964',
        maxPages: 2,
        delay: 3000
    };

    // 从本地存储恢复状态
    const STATE = JSON.parse(localStorage.getItem('shopeeCollectorState')) || {
        currentKeywordIndex: 0,
        currentPage: 0,
        collectedData: [],
        isRunning: false,
        shouldContinue: false
    };

    // 工具函数
    const Utils = {
        saveState: () => {
            localStorage.setItem('shopeeCollectorState', JSON.stringify(STATE));
        },
        buildSearchURL: (keyword, page = 0) => {
            const params = new URLSearchParams({
                category: CONFIG.category,
                keyword: encodeURIComponent(keyword),
                maxPrice: CONFIG.maxPrice,
                minPrice: CONFIG.minPrice,
                page: page,
                locations: '%E0%B8%A0%E0%B8%B2%E0%B8%A2%E0%B9%83%E0%B8%99%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B9%80%E0%B8%97%E0%B8%A8',
                noCorrection: 'true',
                filters: '116'
            });
            return `https://shopee.co.th/search?${params}`;
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
                    console.error('收集商品出错:', error);
                }
            });
            
            STATE.collectedData.push(...collected);
            Utils.saveState();
            console.log(`第 ${STATE.currentPage + 1} 页收集到 ${collected.length} 个商品`);
            return collected.length;
        },

        goToNextPage: () => {
            if (STATE.currentPage < CONFIG.maxPages - 1) {
                STATE.currentPage++;
                STATE.shouldContinue = true;
                Utils.saveState();
                
                const nextURL = Utils.buildSearchURL(
                    CONFIG.keywords[STATE.currentKeywordIndex], 
                    STATE.currentPage
                );
                window.location.href = nextURL;
                return true;
            }
            return false;
        },

        goToNextKeyword: () => {
            STATE.currentKeywordIndex++;
            STATE.currentPage = 0;
            
            if (STATE.currentKeywordIndex < CONFIG.keywords.length) {
                STATE.shouldContinue = true;
                Utils.saveState();
                
                const nextURL = Utils.buildSearchURL(
                    CONFIG.keywords[STATE.currentKeywordIndex]
                );
                window.location.href = nextURL;
                return true;
            }
            return false;
        }
    };

    // 自动执行流程
    const Automation = {
        start: () => {
            STATE.isRunning = true;
            STATE.shouldContinue = true;
            Utils.saveState();
            
            console.log('开始自动收集商品数据');
            this.executeStep();
        },

        executeStep: () => {
            if (!STATE.isRunning) return;
            
            // 等待页面加载完成
            setTimeout(() => {
                // 收集当前页面数据
                ProductCollector.collectCurrentPage();
                
                // 决定下一步操作
                setTimeout(() => {
                    if (ProductCollector.goToNextPage()) {
                        console.log(`翻页到第 ${STATE.currentPage + 1} 页`);
                    } else if (ProductCollector.goToNextKeyword()) {
                        console.log(`切换到关键词: "${CONFIG.keywords[STATE.currentKeywordIndex]}"`);
                    } else {
                        this.finish();
                    }
                }, CONFIG.delay);
            }, 2000);
        },

        finish: () => {
            STATE.isRunning = false;
            STATE.shouldContinue = false;
            localStorage.removeItem('shopeeCollectorState');
            
            const totalCount = STATE.collectedData.length;
            console.log(`所有商品收集完成！共 ${totalCount} 条记录`);
            console.table(STATE.collectedData);
            
            Utils.downloadCSV(STATE.collectedData);
            
            // 更新控制面板
            if (document.getElementById('collector-status')) {
                document.getElementById('collector-status').textContent = 
                    `已完成: ${totalCount} 条记录`;
            }
        },

        stop: () => {
            STATE.isRunning = false;
            STATE.shouldContinue = false;
            Utils.saveState();
            console.log('自动收集已停止');
        }
    };

    // 创建控制面板
    const ControlPanel = {
        create: () => {
            if (document.getElementById('shopee-collector-panel')) return;
            
            const panel = document.createElement('div');
            panel.id = 'shopee-collector-panel';
            panel.innerHTML = `
                <div style="position: fixed; top: 20px; right: 20px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; font-family: Arial; width: 300px; border: 1px solid #e0e0e0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                        <h4 style="margin: 0; color: #ff6b6b;">🛍️ 虾皮商品收集</h4>
                        <button onclick="document.getElementById('shopee-collector-panel').remove()" style="background: none; border: none; font-size: 16px; cursor: pointer; color: #999;">×</button>
                    </div>
                    
                    <div style="margin-bottom: 10px; font-size: 12px; color: #666;">
                        <div>进度: ${STATE.currentKeywordIndex + 1}/${CONFIG.keywords.length}</div>
                        <div>关键词: ${CONFIG.keywords[STATE.currentKeywordIndex]}</div>
                        <div>页码: ${STATE.currentPage + 1}/${CONFIG.maxPages}</div>
                        <div>已收集: ${STATE.collectedData.length} 条</div>
                    </div>
                    
                    <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                        <button onclick="window.collectorStart()" style="flex: 1; background: #00b894; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">开始收集</button>
                        <button onclick="window.collectorStop()" style="flex: 1; background: #e17055; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">停止</button>
                    </div>
                    
                    <div id="collector-status" style="font-size: 11px; color: #666; padding: 6px; background: #f8f9fa; border-radius: 4px;">
                        状态: ${STATE.isRunning ? '运行中' : '准备就绪'}
                    </div>
                </div>
            `;
            
            document.body.appendChild(panel);
        }
    };

    // 全局函数
    window.collectorStart = Automation.start.bind(Automation);
    window.collectorStop = Automation.stop.bind(Automation);

    // 初始化
    ControlPanel.create();
    
    // 检查是否需要继续执行
    if (STATE.shouldContinue && STATE.isRunning) {
        console.log('检测到未完成的任务，继续执行...');
        setTimeout(() => Automation.executeStep(), 1000);
    }
    
    console.log('虾皮商品收集器已加载！');

})();
