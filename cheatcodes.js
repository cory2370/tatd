// cheatcodes.js - Developer console commands for testing and debugging
// Provides cheat functions accessible from the browser console

import { showNotification } from './ui.js';

/**
 * Cheat Codes Manager
 * Exposes developer commands to the global window object
 */
class CheatCodesManager {
    constructor() {
        this.gameManager = null;
        this.enabled = true;
        this.commandHistory = [];
    }

    /**
     * Initialize cheat codes with game manager reference
     * @param {GameManager} gameManager - Reference to the main game manager
     */
    init(gameManager) {
        this.gameManager = gameManager;
        this.registerGlobalCommands();
        this.logWelcomeMessage();
    }

    /**
     * Register all cheat commands to the global window object
     */
    registerGlobalCommands() {
        // Money cheat
        window.cash = (amount) => this.addCash(amount);
        
        // Wave skip cheat
        window.wave = (waveNumber) => this.skipToWave(waveNumber);
        
        // Additional utility commands
        window.god = () => this.godMode();
        window.clear = () => this.clearEnemies();
        window.upgrade = () => this.upgradeAllTowers();
        window.heal = () => this.healBase();
        window.cheats = () => this.showHelp();
    }

    /**
     * Add money to the player
     * @param {number} amount - Amount of money to add
     */
    addCash(amount) {
        if (!this.validateGameManager()) return;
        if (!this.validateNumber(amount, 'Amount')) return;

        const oldMoney = this.gameManager.gameState.money;
        this.gameManager.gameState.earnMoney(amount);
        
        this.logCommand(`cash(${amount})`);
        showNotification(`💰 Added $${amount} (Total: $${Math.floor(this.gameManager.gameState.money)})`, false);
        
        console.log(`%c💰 CASH CHEAT`, 'color: #FFD700; font-weight: bold; font-size: 14px');
        console.log(`Old balance: $${Math.floor(oldMoney)}`);
        console.log(`Added: $${amount}`);
        console.log(`New balance: $${Math.floor(this.gameManager.gameState.money)}`);
    }

    /**
     * Skip to a specific wave
     * @param {number} waveNumber - Wave number to skip to (1-based)
     */
    skipToWave(waveNumber) {
        if (!this.validateGameManager()) return;
        if (!this.validateNumber(waveNumber, 'Wave number')) return;

        const gameState = this.gameManager.gameState;
        const maxWaves = gameState.gameData?.waves?.length || 10;

        if (waveNumber < 1 || waveNumber > maxWaves) {
            console.error(`❌ Wave number must be between 1 and ${maxWaves}`);
            showNotification(`Wave must be between 1-${maxWaves}!`, true);
            return;
        }

        // Clear current enemies and stop current wave
        gameState.enemies = [];
        gameState.waveInProgress = false;
        
        // Set wave number (0-based internally)
        gameState.currentWave = waveNumber - 1;
        
        this.logCommand(`wave(${waveNumber})`);
        showNotification(`🌊 Skipped to Wave ${waveNumber}`, false);
        
        console.log(`%c🌊 WAVE SKIP`, 'color: #1E90FF; font-weight: bold; font-size: 14px');
        console.log(`Current wave: ${waveNumber}/${maxWaves}`);
        console.log(`Click "Start Wave" to begin`);
        
        // Update UI
        import('./ui.js').then(({ updateTopBar, setStartWaveButtonState }) => {
            updateTopBar(gameState);
            if (waveNumber <= maxWaves) {
                setStartWaveButtonState(true);
            }
        });
    }

    /**
     * God mode - set lives to 9999
     */
    godMode() {
        if (!this.validateGameManager()) return;

        const oldLives = this.gameManager.gameState.lives;
        this.gameManager.gameState.lives = 9999;
        
        this.logCommand('god()');
        showNotification('⚡ God Mode Activated! Lives set to 9999', false);
        
        console.log(`%c⚡ GOD MODE`, 'color: #FF4500; font-weight: bold; font-size: 14px');
        console.log(`Old lives: ${oldLives}`);
        console.log(`New lives: 9999`);
        
        import('./ui.js').then(({ updateTopBar }) => {
            updateTopBar(this.gameManager.gameState);
        });
    }

    /**
     * Clear all enemies from the map
     */
    clearEnemies() {
        if (!this.validateGameManager()) return;

        const count = this.gameManager.gameState.enemies.length;
        this.gameManager.gameState.enemies = [];
        
        this.logCommand('clear()');
        showNotification(`🧹 Cleared ${count} enemies`, false);
        
        console.log(`%c🧹 CLEAR ENEMIES`, 'color: #32CD32; font-weight: bold; font-size: 14px');
        console.log(`Removed ${count} enemies from the map`);
    }

    /**
     * Upgrade all placed towers to max level
     */
    upgradeAllTowers() {
        if (!this.validateGameManager()) return;

        const towers = this.gameManager.gameState.towers;
        if (towers.length === 0) {
            console.warn('⚠️ No towers placed yet!');
            showNotification('No towers to upgrade!', true);
            return;
        }

        let upgraded = 0;
        towers.forEach(tower => {
            const towerData = this.gameManager.gameState.gameData.towers.find(t => t.id === tower.id);
            if (!towerData) return;

            while (tower.level < towerData.upgrades.length) {
                tower.upgrade(towers);
                upgraded++;
            }
        });

        this.logCommand('upgrade()');
        showNotification(`⬆️ Upgraded ${upgraded} tower levels`, false);
        
        console.log(`%c⬆️ UPGRADE ALL`, 'color: #9370DB; font-weight: bold; font-size: 14px');
        console.log(`Upgraded ${upgraded} tower levels across ${towers.length} towers`);
        
        import('./ui.js').then(({ showTowerInfo }) => {
            showTowerInfo(this.gameManager.gameState, this.gameManager.uiHandlers);
        });
    }

    /**
     * Heal the base back to full lives
     */
    healBase() {
        if (!this.validateGameManager()) return;

        const oldLives = this.gameManager.gameState.lives;
        const maxLives = this.gameManager.gameState.gameData.game_settings.start_lives;
        this.gameManager.gameState.lives = maxLives;
        
        this.logCommand('heal()');
        showNotification(`❤️ Base healed to ${maxLives} lives`, false);
        
        console.log(`%c❤️ HEAL BASE`, 'color: #FF1493; font-weight: bold; font-size: 14px');
        console.log(`Old lives: ${oldLives}`);
        console.log(`New lives: ${maxLives}`);
        
        import('./ui.js').then(({ updateTopBar }) => {
            updateTopBar(this.gameManager.gameState);
        });
    }

    /**
     * Display all available cheat commands
     */
    showHelp() {
        console.clear();
        console.log(
            `%c🎮 TATD CHEAT CODES 🎮`,
            'color: #FFD700; font-weight: bold; font-size: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);'
        );
        console.log('\n%cAvailable Commands:', 'color: #4CAF50; font-weight: bold; font-size: 16px');
        
        const commands = [
            { cmd: 'cash(n)', desc: 'Add n money to your balance', example: 'cash(1000)' },
            { cmd: 'wave(n)', desc: 'Skip to wave n (1-10)', example: 'wave(5)' },
            { cmd: 'god()', desc: 'Set lives to 9999', example: 'god()' },
            { cmd: 'clear()', desc: 'Remove all enemies from map', example: 'clear()' },
            { cmd: 'upgrade()', desc: 'Max upgrade all towers', example: 'upgrade()' },
            { cmd: 'heal()', desc: 'Restore lives to maximum', example: 'heal()' },
            { cmd: 'cheats()', desc: 'Show this help message', example: 'cheats()' }
        ];

        console.table(commands);
        
        console.log('\n%cExamples:', 'color: #2196F3; font-weight: bold; font-size: 14px');
        console.log('  cash(5000)  → Add $5000');
        console.log('  wave(10)    → Skip to final wave');
        console.log('  god()       → Become invincible');
        
        console.log('\n%cCommand History:', 'color: #FF9800; font-weight: bold; font-size: 14px');
        if (this.commandHistory.length === 0) {
            console.log('  No commands used yet');
        } else {
            this.commandHistory.slice(-10).forEach((cmd, i) => {
                console.log(`  ${i + 1}. ${cmd}`);
            });
        }
        
        console.log('\n%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #666');
        
        showNotification('📋 Cheat codes list shown in console', false);
    }

    /**
     * Validation helpers
     */
    validateGameManager() {
        if (!this.gameManager || !this.gameManager.gameState) {
            console.error('❌ Game not initialized yet! Please wait for game to load.');
            return false;
        }
        return true;
    }

    validateNumber(value, name) {
        if (typeof value !== 'number' || isNaN(value)) {
            console.error(`❌ ${name} must be a valid number!`);
            return false;
        }
        return true;
    }

    /**
     * Log command to history
     */
    logCommand(command) {
        this.commandHistory.push(`${command} - ${new Date().toLocaleTimeString()}`);
        if (this.commandHistory.length > 50) {
            this.commandHistory.shift();
        }
    }

    /**
     * Display welcome message in console
     */
    logWelcomeMessage() {
        setTimeout(() => {
            console.log(
                `%c🎮 TATD Developer Console 🎮`,
                'color: #4CAF50; font-weight: bold; font-size: 16px; padding: 10px;'
            );
            console.log(
                `%cType "cheats()" to see all available commands`,
                'color: #2196F3; font-size: 14px;'
            );
            console.log(
                `%cQuick Start: cash(10000) | wave(5) | god()`,
                'color: #FF9800; font-size: 12px; font-style: italic;'
            );
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }, 1000);
    }

    /**
     * Disable all cheat codes
     */
    disable() {
        this.enabled = false;
        delete window.cash;
        delete window.wave;
        delete window.god;
        delete window.clear;
        delete window.upgrade;
        delete window.heal;
        delete window.cheats;
        console.log('%c🔒 Cheat codes disabled', 'color: #f44336; font-weight: bold;');
    }

    /**
     * Re-enable cheat codes
     */
    enable() {
        this.enabled = true;
        this.registerGlobalCommands();
        console.log('%c🔓 Cheat codes enabled', 'color: #4CAF50; font-weight: bold;');
    }
}

// Create singleton instance
const cheatCodes = new CheatCodesManager();

// Export for use in game.js
export default cheatCodes;
