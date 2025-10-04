// ui.js - Complete rewrite with better organization and error handling
// This module handles all DOM interactions, UI updates, and user interface logic

/**
 * UI Manager - Centralized UI state and element management
 */
class UIManager {
    constructor() {
        this.elements = {};
        this.handlers = null;
        this.gameState = null;
        this.initialized = false;
    }

    /**
     * Initialize the UI system
     * @param {Object} gameState - Game state object
     * @param {Object} handlers - Event handler callbacks
     */
    init(gameState, handlers) {
        this.gameState = gameState;
        this.handlers = handlers;
        
        if (!this.cacheElements()) {
            console.error('Failed to initialize UI - missing critical elements');
            return false;
        }
        
        this.attachEventListeners();
        this.populateTowerShop();
        this.hideTowerInfo();
        this.initialized = true;
        
        console.log('UI initialized successfully');
        return true;
    }

    /**
     * Cache all DOM elements for efficient access
     */
    cacheElements() {
        const elementIds = {
            // Core UI elements
            money: 'money',
            lives: 'lives',
            wave: 'wave',
            towerShop: 'tower-shop',
            towerInfo: 'tower-info',
            towerInfoName: 'tower-info-name',
            towerInfoDetails: 'tower-info-details',
            upgradeBtn: 'upgrade-btn',
            sellBtn: 'sell-btn',
            
            // Containers
            mainMenu: 'main-menu',
            gameContainer: 'game-container',
            
            // Modals
            researchModal: 'research-modal',
            reflectionModal: 'reflection-modal',
            waveSummaryModal: 'wave-summary-modal',
            gameOverModal: 'game-over-modal',
            
            // Buttons
            startGameBtn: 'start-game-btn',
            startWaveBtn: 'start-wave-btn',
            openResearchBtn: 'research-questions-btn',
            openReflectionBtn: 'open-reflection-btn',
            closeResearchBtn: 'close-research-btn',
            closeReflectionBtn: 'close-reflection-btn',
            nextWaveBtn: 'next-wave-btn',
            restartGameBtn: 'restart-game-btn',
            
            // Content areas
            waveSummaryContent: 'wave-summary-content',
            finalStats: 'final-stats',
            reflectionInput: 'reflection-input'
        };

        // Cache elements and check for critical ones
        for (const [key, id] of Object.entries(elementIds)) {
            this.elements[key] = document.getElementById(id);
        }

        // Verify critical elements exist
        const criticalElements = ['money', 'lives', 'wave'];
        return criticalElements.every(key => this.elements[key] !== null);
    }

    /**
     * Attach all event listeners
     */
    attachEventListeners() {
        // Game control buttons
        this.addClickListener('startGameBtn', this.handlers.startGame);
        this.addClickListener('startWaveBtn', this.handlers.startWave);
        this.addClickListener('restartGameBtn', () => window.location.reload());
        
        // Modal controls
        this.addClickListener('openResearchBtn', () => this.showModal('researchModal'));
        this.addClickListener('closeResearchBtn', () => this.hideModal('researchModal'));
        this.addClickListener('openReflectionBtn', () => {
            this.updateFinalReflection();
            this.showModal('reflectionModal');
        });
        this.addClickListener('closeReflectionBtn', () => this.hideModal('reflectionModal'));
        this.addClickListener('nextWaveBtn', () => this.hideModal('waveSummaryModal'));
    }

    /**
     * Helper to safely add click listeners
     */
    addClickListener(elementKey, handler) {
        if (this.elements[elementKey] && handler) {
            this.elements[elementKey].addEventListener('click', handler);
        }
    }

    /**
     * Populate the tower shop with available towers
     */
    populateTowerShop() {
        const shop = this.elements.towerShop;
        if (!shop || !this.gameState?.gameData?.towers) return;

        // Clear existing content and add header
        shop.innerHTML = '<h3>Cửa Hàng Công Nghệ</h3>';
        
        const fragment = document.createDocumentFragment();
        
        this.gameState.gameData.towers.forEach(towerData => {
            const button = this.createTowerButton(towerData);
            fragment.appendChild(button);
        });
        
        shop.appendChild(fragment);
    }

    /**
     * Create a tower button element
     */
    createTowerButton(towerData) {
        const button = document.createElement('div');
        button.className = 'tower-button';
        button.dataset.towerId = towerData.id;
        
        const info = document.createElement('div');
        info.className = 'tower-button-info';
        
        const name = document.createElement('span');
        name.className = 'tower-name';
        name.textContent = towerData.name;
        
        const cost = document.createElement('span');
        cost.className = 'tower-cost';
        cost.textContent = `$${towerData.cost_place}`;
        
        info.appendChild(name);
        info.appendChild(cost);
        button.appendChild(info);
        
        button.addEventListener('click', () => {
            if (this.handlers?.selectTowerToPlace) {
                this.handlers.selectTowerToPlace(towerData.id);
            }
        });
        
        return button;
    }

    /**
     * Update the top bar display
     */
    updateTopBar() {
        if (!this.gameState) return;
        
        this.updateElement('money', Math.floor(this.gameState.money));
        this.updateElement('lives', this.gameState.lives);
        
        const currentWave = this.gameState.currentWave || 0;
        const totalWaves = this.gameState.gameData?.waves?.length || 0;
        this.updateElement('wave', `${currentWave} / ${totalWaves}`);
    }

    /**
     * Show tower information panel
     */
    showTowerInfo() {
        const tower = this.gameState?.selectedTower;
        
        if (!tower) {
            this.hideTowerInfo();
            return;
        }

        const towerData = this.gameState.gameData.towers.find(t => t.id === tower.id);
        if (!towerData) {
            this.hideTowerInfo();
            return;
        }

        // Show the panel
        this.showElement('towerInfo');

        // Update tower name and level
        const levelText = `${towerData.name} (Level ${tower.level + 1})`;
        this.updateElement('towerInfoName', levelText);

        // Build and display tower details
        this.updateTowerDetails(tower, towerData);

        // Setup upgrade button
        this.setupUpgradeButton(tower, towerData);

        // Setup sell button
        this.setupSellButton(tower);
    }

    /**
     * Update tower detail statistics
     */
    updateTowerDetails(tower, towerData) {
        const details = this.elements.towerInfoDetails;
        if (!details) return;

        const stats = [];

        if (tower.dmg) {
            stats.push(`Sát thương: ${tower.dmg}`);
        }
        
        if (tower.firerate) {
            const fireRate = (1 / tower.firerate).toFixed(2);
            stats.push(`Tốc độ bắn: ${fireRate}/s`);
        }
        
        if (tower.range) {
            const range = Math.floor(tower.currentRange || tower.range);
            stats.push(`Tầm bắn: ${range}`);
        }
        
        if (tower.income) {
            stats.push(`Thu nhập: $${tower.income} mỗi ${tower.interval}s`);
        }
        
        if (tower.buffs?.firerate_pct) {
            stats.push(`Buff: +${tower.buffs.firerate_pct}% Tốc độ, +${tower.buffs.range_pct}% Tầm`);
        }

        if (stats.length === 0) {
            stats.push('Không có thông tin');
        }

        details.innerHTML = stats.map(stat => `<li>${stat}</li>`).join('');
    }

    /**
     * Setup upgrade button state and behavior
     */
    setupUpgradeButton(tower, towerData) {
        const btn = this.elements.upgradeBtn;
        if (!btn) return;

        const isMaxLevel = tower.level >= towerData.upgrades.length;

        if (isMaxLevel) {
            btn.textContent = 'Cấp Tối Đa';
            btn.disabled = true;
            btn.onclick = null;
        } else {
            const upgradeInfo = towerData.upgrades[tower.level];
            const cost = upgradeInfo.cost;
            btn.textContent = `Nâng cấp ($${cost})`;
            btn.disabled = this.gameState.money < cost;
            btn.onclick = () => this.handlers.upgradeTower(tower);
        }
    }

    /**
     * Setup sell button
     */
    setupSellButton(tower) {
        const btn = this.elements.sellBtn;
        if (!btn) return;

        const sellValue = Math.floor(tower.totalCost * 0.7);
        btn.textContent = `Bán ($${sellValue})`;
        btn.onclick = () => this.handlers.sellTower(tower);
    }

    /**
     * Hide tower info panel
     */
    hideTowerInfo() {
        this.hideElement('towerInfo');
        this.clearTowerSelection();
    }

    /**
     * Clear tower button selections
     */
    clearTowerSelection() {
        document.querySelectorAll('.tower-button.selected').forEach(btn => {
            btn.classList.remove('selected');
        });
    }

    /**
     * Update tower button selection state
     */
    updateTowerSelection(towerId) {
        document.querySelectorAll('.tower-button').forEach(btn => {
            const isSelected = btn.dataset.towerId === towerId;
            btn.classList.toggle('selected', isSelected);
        });
    }

    /**
     * Hide main menu and show game
     */
    hideMainMenu() {
        this.hideElement('mainMenu');
        this.showElement('gameContainer');
    }

    /**
     * Show a notification message
     */
    showNotification(message, isError = false) {
        // Create notification container if it doesn't exist
        let container = document.getElementById('notification-area');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-area';
            document.body.appendChild(container);
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${isError ? 'error' : 'success'}`;
        notification.textContent = message;
        
        // Add to container
        container.appendChild(notification);

        // Auto-remove after animation
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
                // Clean up container if empty
                if (container.children.length === 0) {
                    container.remove();
                }
            }, 500);
        }, 2500);
    }

    /**
     * Show wave summary modal
     */
    showWaveSummary() {
        if (!this.gameState || !this.elements.waveSummaryContent) return;

        const stats = this.gameState.gameStats || {};
        const content = `
            <h2>Đợt ${this.gameState.currentWave} Hoàn Thành!</h2>
            <p>Tiền kiếm được: $${Math.floor(stats.moneyEarned || 0)}</p>
            <p>Tháp đã đặt: ${stats.towersPlaced || 0}</p>
            <p>Sâu bệnh đã diệt: ${stats.infectionsCured || 0}</p>
        `;
        
        this.elements.waveSummaryContent.innerHTML = content;
        this.showModal('waveSummaryModal');
    }

    /**
     * Update final reflection statistics
     */
    updateFinalReflection() {
        if (!this.gameState || !this.elements.finalStats) return;

        const stats = this.gameState.gameStats || {};
        const content = `
            <h3>Thống Kê Trò Chơi</h3>
            <p>Tổng tiền kiếm được: $${Math.floor(stats.moneyEarned || 0)}</p>
            <p>Tháp đã đặt: ${stats.towersPlaced || 0}</p>
            <p>Tháp đã nâng cấp: ${stats.towersUpgraded || 0}</p>
            <p>Tổng sâu bệnh: ${stats.infectionsTotal || 0}</p>
            <p>Sâu bệnh đã diệt: ${stats.infectionsCured || 0}</p>
        `;
        
        this.elements.finalStats.innerHTML = content;
    }

    /**
     * Show game over modal
     */
    showGameOver() {
        this.showModal('gameOverModal');
    }

    /**
     * Modal management utilities
     */
    showModal(modalKey) {
        const modal = this.elements[modalKey];
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('show');
        }
    }

    hideModal(modalKey) {
        const modal = this.elements[modalKey];
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('show');
        }
    }

    /**
     * Element visibility utilities
     */
    showElement(elementKey) {
        const element = this.elements[elementKey];
        if (element) {
            element.classList.remove('hidden');
        }
    }

    hideElement(elementKey) {
        const element = this.elements[elementKey];
        if (element) {
            element.classList.add('hidden');
        }
    }

    /**
     * Update element text content
     */
    updateElement(elementKey, content) {
        const element = this.elements[elementKey];
        if (element) {
            element.textContent = content;
        }
    }

    /**
     * Enable or disable a button
     */
    setButtonState(elementKey, enabled) {
        const button = this.elements[elementKey];
        if (button) {
            button.disabled = !enabled;
        }
    }
}

// Create singleton instance
const uiManager = new UIManager();

// Export functions that match the original interface
export function initUI(gameState, handlers) {
    return uiManager.init(gameState, handlers);
}

export function updateTopBar(gameState) {
    uiManager.gameState = gameState;
    uiManager.updateTopBar();
}

export function showTowerInfo(gameState, handlers) {
    uiManager.gameState = gameState;
    uiManager.handlers = handlers;
    uiManager.showTowerInfo();
}

export function hideMainMenu() {
    uiManager.hideMainMenu();
}

export function showNotification(message, isError) {
    uiManager.showNotification(message, isError);
}

export function showWaveSummary(gameState) {
    uiManager.gameState = gameState;
    uiManager.showWaveSummary();
}

export function showFinalReflection(gameState) {
    uiManager.gameState = gameState;
    uiManager.updateFinalReflection();
    uiManager.showModal('reflectionModal');
}

export function showGameOver() {
    uiManager.showGameOver();
}

// Export additional utilities
export function updateTowerSelection(towerId) {
    uiManager.updateTowerSelection(towerId);
}

export function setStartWaveButtonState(enabled) {
    uiManager.setButtonState('startWaveBtn', enabled);
}