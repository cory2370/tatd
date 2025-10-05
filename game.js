// game.js - Complete rewrite with clean architecture
// Main game orchestrator with separated concerns and proper state management

import { path, isPointNearLine } from './config.js';
import { Enemy, Tower, Projectile } from './entities.js';
import {
    initUI,
    updateTopBar,
    showTowerInfo,
    showNotification,
    showWaveSummary,
    showFinalReflection,
    showGameOver,
    hideMainMenu,
    updateTowerSelection,
    setStartWaveButtonState
} from './ui.js';
import cheatCodes from './cheatcodes.js';

// Game states enum
const GameStates = {
    LOADING: 'loading',
    MENU: 'menu',
    PLAYING: 'playing',
    WAVE_BREAK: 'wave_break',
    PAUSED: 'paused',
    GAME_OVER: 'game_over',
    VICTORY: 'victory'
};

/**
 * Main game state management
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        // Game data
        this.gameData = null;

        // Resources
        this.money = 500;
        this.lives = 20;

        // Wave management
        this.currentWave = 0;
        this.waveInProgress = false;

        // Entities
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];

        // Selection state
        this.selectedTower = null;
        this.placingTowerType = null;

        // Input state
        this.mousePos = { x: 0, y: 0 };
        this.validPlacement = false;

        // Statistics
        this.gameStats = {
            moneyEarned: 0,
            towersPlaced: 0,
            towersUpgraded: 0,
            infectionsTotal: 0,
            infectionsCured: 0,
            enemiesKilled: 0,
            damageDealt: {}
        };
    }

    initialize(gameData) {
        this.gameData = gameData;
        this.money = gameData.game_settings.start_money;
        this.lives = gameData.game_settings.start_lives;
        this.gameStats.moneyEarned = this.money;

        // Initialize damage tracking
        gameData.towers.forEach(tower => {
            this.gameStats.damageDealt[tower.id] = 0;
        });
    }

    earnMoney(amount) {
        this.money += amount;
        this.gameStats.moneyEarned += amount;
    }

    takeDamage(amount = 1) {
        this.lives = Math.max(0, this.lives - amount);
        return this.lives <= 0;
    }

    canAfford(cost) {
        return this.money >= cost;
    }

    purchase(cost) {
        if (this.canAfford(cost)) {
            this.money -= cost;
            return true;
        }
        return false;
    }
}

/**
 * Handles all rendering operations
 */
class RenderManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        // Delay resize to ensure DOM is ready
        setTimeout(() => this.resizeCanvas(), 0);

        // Bind resize handler
        this.handleResize = this.resizeCanvas.bind(this);
        window.addEventListener('resize', this.handleResize);
    }

    resizeCanvas() {
        const parent = this.canvas.parentElement;
        if (parent) {
            // Get actual dimensions
            const rect = parent.getBoundingClientRect();
            this.canvas.width = rect.width || 800; // Fallback width
            this.canvas.height = rect.height || 600; // Fallback height

            // Update path endpoint to match canvas
            if (path.length > 0) {
                path[path.length - 1].x = this.canvas.width + 50;
            }

            console.log('Canvas resized to:', this.canvas.width, 'x', this.canvas.height);
        }
    }

    render(gameState) {
        // Clear canvas with background color
        this.ctx.fillStyle = '#8FBC8F';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Render layers in order
        this.drawPath();
        this.drawPlacementGhost(gameState);
        this.drawTowers(gameState);
        this.drawEnemies(gameState);
        this.drawProjectiles(gameState);
        this.drawUI(gameState);
    }

    drawPath() {
        const ctx = this.ctx;

        // Draw outer path border
        ctx.strokeStyle = '#D2B48C';
        ctx.lineWidth = 50;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        path.forEach((point, i) => {
            if (i > 0) ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();

        // Draw inner path
        ctx.strokeStyle = '#A0522D';
        ctx.lineWidth = 44;
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        path.forEach((point, i) => {
            if (i > 0) ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
    }

    drawPlacementGhost(gameState) {
        if (!gameState.placingTowerType || !gameState.mousePos) return;

        const towerData = gameState.gameData.towers.find(
            t => t.id === gameState.placingTowerType
        );
        if (!towerData) return;

        const ctx = this.ctx;
        const { x, y } = gameState.mousePos;
        const canPlace = gameState.validPlacement;

        // Tower placement indicator
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fillStyle = canPlace ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
        ctx.fill();
        ctx.strokeStyle = canPlace ? 'green' : 'red';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Range indicator
        ctx.beginPath();
        ctx.arc(x, y, towerData.base.range || 100, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 100, 100, 0.1)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    drawTowers(gameState) {
        gameState.towers.forEach(tower => {
            // Draw range for selected or infected towers
            if (tower === gameState.selectedTower || tower.isInfected) {
                tower.drawRange(this.ctx);
            }
            tower.draw(this.ctx);
        });
    }

    drawEnemies(gameState) {
        gameState.enemies.forEach(enemy => enemy.draw(this.ctx));
    }

    drawProjectiles(gameState) {
        gameState.projectiles.forEach(projectile => projectile.draw(this.ctx));
    }

    drawUI(gameState) {
        // Draw infection cure counters
        const ctx = this.ctx;
        gameState.towers.forEach(tower => {
            if (tower.isInfected && tower.infectionCureClicks > 0) {
                ctx.save();
                ctx.fillStyle = 'white';
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const required = gameState.gameData.game_settings.infection_mechanic.cure_clicks_required;
                ctx.fillText(
                    `${tower.infectionCureClicks}/${required}`,
                    tower.x,
                    tower.y - 30
                );
                ctx.restore();
            }
        });
    }

    cleanup() {
        window.removeEventListener('resize', this.handleResize);
    }
}

/**
 * Handles all input events
 */
class InputManager {
    constructor(canvas, gameState, gameManager) {
        this.canvas = canvas;
        this.gameState = gameState;
        this.gameManager = gameManager;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Canvas events
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        this.canvas.addEventListener('contextmenu', this.handleRightClick.bind(this));

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.gameState.mousePos.x = event.clientX - rect.left;
        this.gameState.mousePos.y = event.clientY - rect.top;

        // Update placement validation
        if (this.gameState.placingTowerType) {
            this.gameState.validPlacement = this.gameManager.canPlaceTowerAt(
                this.gameState.mousePos.x,
                this.gameState.mousePos.y
            );
        }
    }

    handleClick(event) {
        const { x, y } = this.gameState.mousePos;

        if (this.gameState.placingTowerType) {
            this.gameManager.placeTower(x, y);
        } else {
            this.gameManager.selectTowerAt(x, y);
        }
    }

    handleRightClick(event) {
        event.preventDefault();

        if (this.gameState.placingTowerType) {
            // Cancel placement
            this.gameManager.cancelTowerPlacement();
            return;
        }

        // Try to cure infected tower
        const { x, y } = this.gameState.mousePos;
        this.gameManager.tryClickCure(x, y);
    }

    handleKeyDown(event) {
        switch (event.key) {
            case 'Escape':
                if (this.gameState.placingTowerType) {
                    this.gameManager.cancelTowerPlacement();
                }
                break;
            case ' ':
                event.preventDefault();
                this.gameManager.togglePause();
                break;
        }
    }

    cleanup() {
        // Remove all event listeners
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('click', this.handleClick);
        this.canvas.removeEventListener('contextmenu', this.handleRightClick);
        document.removeEventListener('keydown', this.handleKeyDown);
    }
}

/**
 * Manages wave spawning and progression
 */
class WaveManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.spawnQueue = [];
        this.spawnTimer = 0;
    }

    startWave(waveNumber) {
        const waveData = this.gameState.gameData.waves[waveNumber - 1];
        if (!waveData) return false;

        this.spawnQueue = [];

        // Build spawn queue
        waveData.composition.forEach(group => {
            const enemyData = this.gameState.gameData.enemies.find(
                e => e.id === group.enemy_id
            );
            if (!enemyData) return;

            for (let i = 0; i < group.count; i++) {
                this.spawnQueue.push({
                    enemyData: enemyData,
                    spawnTime: i * (group.interval_ms / 1000)
                });
            }
        });

        this.spawnTimer = 0;
        return true;
    }

    update(deltaTime) {
        if (this.spawnQueue.length === 0) return;

        this.spawnTimer += deltaTime;

        // Spawn enemies whose time has come
        while (this.spawnQueue.length > 0 && this.spawnQueue[0].spawnTime <= this.spawnTimer) {
            const spawn = this.spawnQueue.shift();
            this.gameState.enemies.push(new Enemy(spawn.enemyData));
        }
    }

    isComplete() {
        return this.spawnQueue.length === 0 && this.gameState.enemies.length === 0;
    }
}

/**
 * Manages the infection mechanic
 */
class InfectionManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.timer = 0;
        this.interval = 0;
        this.enabled = false;
    }

    initialize() {
        const settings = this.gameState.gameData.game_settings.infection_mechanic;
        if (!settings) return;

        this.interval = settings.every_s;
        this.timer = 0;
        this.enabled = true;
    }

    update(deltaTime) {
        if (!this.enabled || !this.gameState.waveInProgress) return;

        this.timer += deltaTime;

        if (this.timer >= this.interval) {
            this.timer = 0;
            this.infectRandomTower();
        }
    }

    infectRandomTower() {
        const eligible = this.gameState.towers.filter(t =>
            !t.isInfected && t.type !== 'support_sensor'
        );

        if (eligible.length === 0) return;

        const tower = eligible[Math.floor(Math.random() * eligible.length)];
        tower.infect();
        this.gameState.gameStats.infectionsTotal++;
        showNotification(`Tháp ${tower.name} đã bị sâu bệnh tấn công!`, true);
    }

    stop() {
        this.enabled = false;
        this.timer = 0;
    }
}

/**
 * Main game manager
 */
class GameManager {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }

        // Core systems
        this.gameState = new GameState();
        this.renderManager = new RenderManager(this.canvas);
        this.inputManager = null;
        this.waveManager = new WaveManager(this.gameState);
        this.infectionManager = new InfectionManager(this.gameState);

        // Game flow
        this.currentState = GameStates.LOADING;
        this.lastTime = 0;
        this.animationFrameId = null;
        this.isPaused = false;

        // UI handlers
        this.uiHandlers = {
            startGame: this.startGame.bind(this),
            startWave: this.startNextWave.bind(this),
            selectTowerToPlace: this.selectTowerToPlace.bind(this),
            upgradeTower: this.upgradeTower.bind(this),
            sellTower: this.sellTower.bind(this)
        };
    }

    async initialize() {
        try {
            // Load game data
            await this.loadGameData();

            // Initialize systems
            this.gameState.initialize(this.gameState.gameData);
            this.inputManager = new InputManager(this.canvas, this.gameState, this);
            this.infectionManager.initialize();

            // Initialize UI
            initUI(this.gameState, this.uiHandlers);
            updateTopBar(this.gameState);

            // Initialize cheat codes (ADD THIS)
            cheatCodes.init(this);

            // Force canvas resize after everything is loaded
            setTimeout(() => {
                this.renderManager.resizeCanvas();
                this.renderManager.render(this.gameState);
            }, 100);

            this.currentState = GameStates.MENU;
            console.log('Game initialized successfully');

        } catch (error) {
            console.error('Failed to initialize game:', error);
            showNotification('Lỗi tải game. Vui lòng tải lại trang.', true);
        }
    }

    async loadGameData() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Validate data structure
            if (!data.towers || !data.enemies || !data.waves) {
                throw new Error('Invalid game data structure');
            }

            this.gameState.gameData = data;

        } catch (error) {
            console.error('Error loading game data:', error);
            throw new Error('Could not load game data');
        }
    }

    startGame() {
        if (this.currentState !== GameStates.MENU) return;

        hideMainMenu();
        this.currentState = GameStates.WAVE_BREAK;

        // Ensure canvas is properly sized
        this.renderManager.resizeCanvas();

        this.startGameLoop();
        setStartWaveButtonState(true);
    }

    startGameLoop() {
        if (this.animationFrameId) return; // Already running

        this.lastTime = performance.now();
        this.gameLoop(this.lastTime);
    }

    gameLoop(timestamp) {
        // Calculate delta time
        const deltaTime = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        // Update game
        if (!this.isPaused) {
            this.update(deltaTime);
        }

        // Render
        this.renderManager.render(this.gameState);

        // Continue loop
        if (this.currentState !== GameStates.GAME_OVER &&
            this.currentState !== GameStates.VICTORY) {
            this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
        } else {
            this.animationFrameId = null;
        }
    }

    update(deltaTime) {
        // Validate delta time
        if (!deltaTime || isNaN(deltaTime) || deltaTime <= 0) {
            deltaTime = 0.016; // Default to 60fps
        }

        // Update based on state
        switch (this.currentState) {
            case GameStates.PLAYING:
                this.updateGameplay(deltaTime);
                break;
            case GameStates.WAVE_BREAK:
                // Towers still generate income during breaks
                this.updateTowers(deltaTime);
                break;
        }

        // Always update UI
        updateTopBar(this.gameState);
    }

    updateGameplay(deltaTime) {
        // Update infection system
        this.infectionManager.update(deltaTime);

        // Update wave spawning
        this.waveManager.update(deltaTime);

        // Update towers
        this.updateTowers(deltaTime);

        // Update projectiles
        this.updateProjectiles(deltaTime);

        // Update enemies
        this.updateEnemies(deltaTime);

        // Check wave completion
        if (this.gameState.waveInProgress && this.waveManager.isComplete()) {
            this.waveComplete();
        }
    }

    updateTowers(deltaTime) {
        this.gameState.towers.forEach(tower => {
            tower.update(deltaTime, this.gameState);
        });
    }

    updateProjectiles(deltaTime) {
        this.gameState.projectiles.forEach(projectile => {
            projectile.update(deltaTime, this.gameState);
        });

        // Remove inactive projectiles
        this.gameState.projectiles = this.gameState.projectiles.filter(p => p.active);
    }

    updateEnemies(deltaTime) {
        const enemiesToRemove = [];

        this.gameState.enemies.forEach(enemy => {
            enemy.update(deltaTime);

            // Check if enemy reached end
            if (enemy.reachedEnd) {
                enemiesToRemove.push(enemy);
                const gameOver = this.gameState.takeDamage();

                if (gameOver) {
                    this.gameOver();
                }
            }
            // Check if enemy died
            else if (!enemy.isAlive()) {
                enemiesToRemove.push(enemy);
                this.gameState.earnMoney(enemy.reward);
                this.gameState.gameStats.enemiesKilled++;
            }
        });

        // Remove dead/finished enemies
        this.gameState.enemies = this.gameState.enemies.filter(
            enemy => !enemiesToRemove.includes(enemy)
        );
    }

    startNextWave() {
        if (this.currentState !== GameStates.WAVE_BREAK) return;

        this.gameState.currentWave++;

        if (this.gameState.currentWave > this.gameState.gameData.waves.length) {
            this.victory();
            return;
        }

        this.gameState.waveInProgress = true;
        this.currentState = GameStates.PLAYING;

        if (this.waveManager.startWave(this.gameState.currentWave)) {
            setStartWaveButtonState(false);
            showNotification(`Đợt ${this.gameState.currentWave} bắt đầu!`);
        } else {
            console.error('Failed to start wave');
            this.gameState.waveInProgress = false;
            this.currentState = GameStates.WAVE_BREAK;
        }
    }

    waveComplete() {
        this.gameState.waveInProgress = false;
        this.currentState = GameStates.WAVE_BREAK;

        showWaveSummary(this.gameState);

        if (this.gameState.currentWave >= this.gameState.gameData.waves.length) {
            this.victory();
        } else {
            setStartWaveButtonState(true);
        }
    }

    gameOver() {
        this.currentState = GameStates.GAME_OVER;
        this.infectionManager.stop();
        showGameOver();
    }

    victory() {
        this.currentState = GameStates.VICTORY;
        this.infectionManager.stop();
        showNotification('Chúc mừng! Bạn đã bảo vệ thành công mùa màng!', false);
        showFinalReflection(this.gameState);
    }

    selectTowerToPlace(towerId) {
        if (!towerId) {
            this.cancelTowerPlacement();
            return;
        }

        const towerData = this.gameState.gameData.towers.find(t => t.id === towerId);
        if (!towerData) return;

        if (this.gameState.canAfford(towerData.cost_place)) {
            this.gameState.placingTowerType = towerId;
            this.gameState.selectedTower = null;
            updateTowerSelection(towerId);
            showTowerInfo(this.gameState, this.uiHandlers);
        } else {
            showNotification('Không đủ tiền!', true);
        }
    }

    cancelTowerPlacement() {
        this.gameState.placingTowerType = null;
        this.gameState.validPlacement = false;
        updateTowerSelection(null);
    }

    placeTower(x, y) {
        if (!this.gameState.placingTowerType) return;

        const towerData = this.gameState.gameData.towers.find(
            t => t.id === this.gameState.placingTowerType
        );
        if (!towerData) return;

        if (this.canPlaceTowerAt(x, y) && this.gameState.purchase(towerData.cost_place)) {
            // Create tower
            const tower = new Tower(x, y, this.gameState.placingTowerType, this.gameState.gameData);
            this.gameState.towers.push(tower);
            this.gameState.gameStats.towersPlaced++;

            // Update all towers (for buff calculations)
            this.gameState.towers.forEach(t => t.applyStats(this.gameState.towers));

            // Select the new tower
            this.gameState.selectedTower = tower;
            this.cancelTowerPlacement();

            showTowerInfo(this.gameState, this.uiHandlers);
            updateTopBar(this.gameState);
        } else {
            showNotification('Không thể đặt tháp ở đây!', true);
        }
    }

    canPlaceTowerAt(x, y) {
        // Check bounds
        if (x < 20 || x > this.canvas.width - 20 || y < 20 || y > this.canvas.height - 20) {
            return false;
        }

        // Check distance from path
        for (let i = 0; i < path.length - 1; i++) {
            if (isPointNearLine({ x, y }, path[i], path[i + 1], 45)) {
                return false;
            }
        }

        // Check distance from other towers
        for (const tower of this.gameState.towers) {
            if (Math.hypot(x - tower.x, y - tower.y) < 40) {
                return false;
            }
        }

        return true;
    }

    selectTowerAt(x, y) {
        const tower = this.gameState.towers.find(t =>
            Math.hypot(x - t.x, y - t.y) < 25
        );

        this.gameState.selectedTower = tower || null;
        showTowerInfo(this.gameState, this.uiHandlers);
    }

    upgradeTower(tower) {
        if (!tower) return;

        const towerData = this.gameState.gameData.towers.find(t => t.id === tower.id);
        if (!towerData || tower.level >= towerData.upgrades.length) return;

        const upgradeCost = towerData.upgrades[tower.level].cost;

        if (this.gameState.purchase(upgradeCost)) {
            tower.upgrade(this.gameState.towers);
            this.gameState.gameStats.towersUpgraded++;

            // Reapply buffs to all towers
            this.gameState.towers.forEach(t => t.applyStats(this.gameState.towers));

            showTowerInfo(this.gameState, this.uiHandlers);
            updateTopBar(this.gameState);
        } else {
            showNotification('Không đủ tiền để nâng cấp!', true);
        }
    }

    sellTower(tower) {
        if (!tower) return;

        const sellValue = Math.floor(tower.totalCost * 0.7);
        this.gameState.earnMoney(sellValue);

        // Remove tower
        const index = this.gameState.towers.indexOf(tower);
        if (index > -1) {
            this.gameState.towers.splice(index, 1);
        }

        // Clear selection if this was selected
        if (this.gameState.selectedTower === tower) {
            this.gameState.selectedTower = null;
        }

        // Reapply buffs to remaining towers
        this.gameState.towers.forEach(t => t.applyStats(this.gameState.towers));

        showTowerInfo(this.gameState, this.uiHandlers);
        updateTopBar(this.gameState);
    }

    tryClickCure(x, y) {
        const tower = this.gameState.towers.find(t =>
            Math.hypot(x - t.x, y - t.y) < 25 && t.isInfected
        );

        if (tower) {
            tower.handleClickCure(this.gameState);
        }
    }

    togglePause() {
        if (this.currentState === GameStates.PLAYING) {
            this.isPaused = !this.isPaused;
            showNotification(this.isPaused ? 'Tạm dừng' : 'Tiếp tục', false);
        }
    }

    cleanup() {
        // Cancel animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Clean up managers
        if (this.inputManager) this.inputManager.cleanup();
        if (this.renderManager) this.renderManager.cleanup();
        this.infectionManager.stop();
    }
}

// Initialize and start the game
let gameManager = null;

window.addEventListener('DOMContentLoaded', async () => {
    try {
        gameManager = new GameManager();
        await gameManager.initialize();
    } catch (error) {
        console.error('Failed to start game:', error);
        showNotification('Lỗi khởi động game. Vui lòng tải lại trang.', true);
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (gameManager) {
        gameManager.cleanup();
    }
});

// Export for debugging
window.gameManager = gameManager;
