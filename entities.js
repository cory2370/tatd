// entities.js - Complete rewrite with proper entity architecture
// Clean separation of concerns for all game entities

import { path, PathManager, GameConstants } from './config.js';
import { showNotification } from './ui.js';

/**
 * Base class for all game entities
 */
class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.active = true;
    }

    distanceTo(other) {
        return Math.hypot(this.x - other.x, this.y - other.y);
    }

    isInRange(other, range) {
        return this.distanceTo(other) <= range;
    }
}

/**
 * Enemy entity with improved pathfinding and status effects
 */
export class Enemy extends Entity {
    constructor(enemyData) {
        super(path[0].x, path[0].y);
        
        // Core properties
        this.id = enemyData.id;
        this.name = enemyData.name;
        this.maxHp = enemyData.hp;
        this.hp = enemyData.hp;
        this.baseSpeed = enemyData.speed;
        this.speed = enemyData.speed;
        this.reward = enemyData.reward;
        this.color = enemyData.color;
        
        // Pathfinding
        this.pathIndex = 0;
        this.distanceAlongSegment = 0;
        this.reachedEnd = false;
        
        // Status effects
        this.statusEffects = new Map();
        
        // Visual properties
        this.radius = this.id === 'pest_boss' ? 15 : 10;
        this.healthBarWidth = this.id === 'pest_boss' ? 30 : 20;
    }

    update(deltaTime) {
        if (this.reachedEnd || !this.isAlive()) return;
        
        // Update status effects
        this.updateStatusEffects(deltaTime);
        
        // Move along path
        this.moveAlongPath(deltaTime);
    }

    moveAlongPath(deltaTime) {
        if (this.pathIndex >= path.length - 1) {
            this.reachedEnd = true;
            return;
        }

        const currentPoint = path[this.pathIndex];
        const nextPoint = path[this.pathIndex + 1];
        
        // Calculate segment vector
        const dx = nextPoint.x - currentPoint.x;
        const dy = nextPoint.y - currentPoint.y;
        const segmentLength = Math.hypot(dx, dy);
        
        // Move along segment
        const moveDistance = this.speed * deltaTime * GameConstants.ENEMY_SPEED_MULTIPLIER;
        this.distanceAlongSegment += moveDistance;
        
        // Check if we've reached the next point
        if (this.distanceAlongSegment >= segmentLength) {
            this.pathIndex++;
            this.distanceAlongSegment = 0;
            
            if (this.pathIndex >= path.length - 1) {
                this.reachedEnd = true;
            }
        } else {
            // Update position
            const t = this.distanceAlongSegment / segmentLength;
            this.x = currentPoint.x + dx * t;
            this.y = currentPoint.y + dy * t;
        }
    }

    updateStatusEffects(deltaTime) {
        for (const [effectType, effect] of this.statusEffects.entries()) {
            effect.duration -= deltaTime;
            
            if (effect.duration <= 0) {
                this.removeStatusEffect(effectType);
            }
        }
    }

    applyStatusEffect(type, value, duration) {
        // Boss immunity to weak slows
        if (this.id === 'pest_boss' && type === 'slow' && value < 0.35) {
            return;
        }

        const existingEffect = this.statusEffects.get(type);
        
        // Only apply if stronger or longer lasting
        if (!existingEffect || 
            existingEffect.value < value || 
            existingEffect.duration < duration) {
            
            this.statusEffects.set(type, { value, duration });
            this.recalculateSpeed();
        }
    }

    removeStatusEffect(type) {
        this.statusEffects.delete(type);
        this.recalculateSpeed();
    }

    recalculateSpeed() {
        let speedMultiplier = 1;
        
        const slowEffect = this.statusEffects.get('slow');
        if (slowEffect) {
            speedMultiplier *= (1 - slowEffect.value);
        }
        
        this.speed = this.baseSpeed * speedMultiplier;
    }

    takeDamage(amount, source = null) {
        this.hp = Math.max(0, this.hp - amount);
        return !this.isAlive();
    }

    isAlive() {
        return this.hp > 0;
    }

    draw(ctx) {
        // Draw body
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Add border for visibility
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Draw health bar
        this.drawHealthBar(ctx);
        
        // Draw status effect indicators
        this.drawStatusEffects(ctx);
        
        ctx.restore();
    }

    drawHealthBar(ctx) {
        const barHeight = 4;
        const yOffset = this.radius + 10;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(
            this.x - this.healthBarWidth / 2,
            this.y - yOffset,
            this.healthBarWidth,
            barHeight
        );
        
        // Health
        const healthPercent = this.hp / this.maxHp;
        const healthColor = healthPercent > 0.5 ? '#4CAF50' : 
                           healthPercent > 0.25 ? '#FFA500' : '#FF4444';
        
        ctx.fillStyle = healthColor;
        ctx.fillRect(
            this.x - this.healthBarWidth / 2,
            this.y - yOffset,
            this.healthBarWidth * healthPercent,
            barHeight
        );
    }

    drawStatusEffects(ctx) {
        if (this.statusEffects.size === 0) return;
        
        let iconOffset = 0;
        
        // Draw slow effect indicator
        if (this.statusEffects.has('slow')) {
            ctx.fillStyle = '#4FC3F7';
            ctx.beginPath();
            ctx.arc(
                this.x + this.radius + 5 + iconOffset,
                this.y - this.radius,
                3,
                0,
                Math.PI * 2
            );
            ctx.fill();
            iconOffset += 10;
        }
    }
}

/**
 * Tower entity with modular abilities and upgrade system
 */
export class Tower extends Entity {
    constructor(x, y, towerId, gameData) {
        super(x, y);
        
        // Core properties
        this.id = towerId;
        this.gameData = gameData;
        this.towerData = gameData.towers.find(t => t.id === towerId);
        this.name = this.towerData.name;
        this.type = this.towerData.type;
        
        // Upgrade system
        this.level = 0;
        this.totalCost = this.towerData.cost_place;
        
        // Combat stats
        this.stats = {};
        this.baseStats = {};
        this.buffedStats = {};
        
        // Timers
        this.cooldown = 0;
        this.lastActionTime = 0;
        
        // Infection state
        this.infection = null;
        
        // Visual properties
        this.radius = GameConstants.TOWER_RADIUS;
        this.rangeAlpha = 0.1;
        
        // Initialize stats
        this.applyStats();
    }

    applyStats(allTowers = []) {
        const data = this.level === 0 ? 
            this.towerData.base : 
            this.towerData.upgrades[this.level - 1];
        
        // Copy base stats
        this.baseStats = { ...data };
        
        // Calculate buffed stats
        this.buffedStats = this.calculateBuffedStats(allTowers);
        
        // Apply infection debuffs if infected
        if (this.infection) {
            this.stats = this.applyInfectionDebuff(this.buffedStats);
        } else {
            this.stats = { ...this.buffedStats };
        }
    }

    calculateBuffedStats(allTowers) {
        const stats = { ...this.baseStats };
        
        // Don't buff support towers
        if (this.type === 'support' || this.type === 'support_sensor') {
            return stats;
        }
        
        let firerateMultiplier = 1;
        let rangeMultiplier = 1;
        
        // Calculate buffs from nearby support towers
        allTowers.forEach(tower => {
            if (tower === this || tower.type !== 'support') return;
            if (!this.isInRange(tower, tower.baseStats.range)) return;
            
            const buffs = tower.baseStats;
            if (buffs.buff_firerate_pct) {
                firerateMultiplier *= (1 - buffs.buff_firerate_pct / 100);
            }
            if (buffs.buff_range_pct) {
                rangeMultiplier *= (1 + buffs.buff_range_pct / 100);
            }
        });
        
        // Apply multipliers
        if (stats.firerate_s) {
            stats.firerate_s *= firerateMultiplier;
        }
        if (stats.range) {
            stats.range *= rangeMultiplier;
        }
        
        return stats;
    }

    applyInfectionDebuff(stats) {
        if (!this.infection) return stats;
        
        const debuffedStats = { ...stats };
        const debuff = this.gameData.game_settings.infection_mechanic.effect;
        
        if (debuffedStats.firerate_s) {
            debuffedStats.firerate_s *= (1 + Math.abs(debuff.firerate_pct) / 100);
        }
        if (debuffedStats.range) {
            debuffedStats.range *= (1 + debuff.range_pct / 100);
        }
        
        return debuffedStats;
    }

    update(deltaTime, gameState) {
        // Update cooldown
        if (this.cooldown > 0) {
            this.cooldown -= deltaTime;
        }
        
        // Perform tower-specific action
        switch (this.type) {
            case 'eco':
                this.updateEconomy(deltaTime, gameState);
                break;
            case 'support_sensor':
                this.updateSensor(deltaTime, gameState);
                break;
            case 'single':
            case 'single_heavy':
            case 'aoe':
                this.updateCombat(deltaTime, gameState);
                break;
        }
    }

    updateEconomy(deltaTime, gameState) {
        if (this.cooldown <= 0 && this.stats.income) {
            gameState.earnMoney(this.stats.income);
            this.cooldown = this.stats.interval_s || 1;
        }
    }

    updateSensor(deltaTime, gameState) {
        if (this.cooldown <= 0) {
            this.scanForInfections(gameState);
            this.cooldown = this.stats.scan_delay_s || 5;
        }
    }

    scanForInfections(gameState) {
        const infectedTowers = gameState.towers.filter(tower =>
            tower.infection && 
            this.isInRange(tower, this.stats.range)
        );
        
        if (infectedTowers.length === 0) return;
        
        const tower = infectedTowers[0];
        showNotification(
            `Cảm biến phát hiện ${tower.name} bị nhiễm bệnh!`, 
            true
        );
        
        // Auto-heal if enabled
        if (this.stats.auto_heal) {
            setTimeout(() => {
                if (tower.infection) {
                    tower.cure(gameState);
                }
            }, (this.stats.auto_heal_time_s || 5) * 1000);
        }
    }

    updateCombat(deltaTime, gameState) {
        if (this.cooldown <= 0 && this.canAttack()) {
            this.attack(gameState);
        }
    }

    canAttack() {
        return this.stats.dmg && this.stats.firerate_s && this.stats.range;
    }

    attack(gameState) {
        const targets = this.findTargets(gameState.enemies);
        if (targets.length === 0) return;
        
        const target = this.selectTarget(targets);
        this.cooldown = this.stats.firerate_s;
        
        // Create projectile
        const projectile = this.createProjectile(target);
        if (projectile) {
            gameState.projectiles.push(projectile);
        }
    }

    findTargets(enemies) {
        return enemies.filter(enemy => 
            enemy.isAlive() && 
            this.isInRange(enemy, this.stats.range)
        );
    }

    selectTarget(targets) {
        // Priority: Closest to end > Most HP > Closest to tower
        return targets.sort((a, b) => {
            // First priority: furthest along path
            if (a.pathIndex !== b.pathIndex) {
                return b.pathIndex - a.pathIndex;
            }
            // Second priority: highest HP
            if (a.hp !== b.hp) {
                return b.hp - a.hp;
            }
            // Third priority: closest to tower
            return this.distanceTo(a) - this.distanceTo(b);
        })[0];
    }

    createProjectile(target) {
        const projectileData = {
            x: this.x,
            y: this.y,
            damage: this.stats.dmg,
            towerId: this.id,
            towerType: this.type
        };
        
        if (this.type === 'aoe') {
            projectileData.targetPos = { x: target.x, y: target.y };
            projectileData.aoeRadius = this.stats.aoe_radius || 50;
        } else {
            projectileData.target = target;
            projectileData.ability = this.stats.ability;
        }
        
        return new Projectile(projectileData);
    }

    upgrade(allTowers) {
        if (this.level >= this.towerData.upgrades.length) return false;
        
        const upgradeCost = this.towerData.upgrades[this.level].cost;
        this.totalCost += upgradeCost;
        this.level++;
        this.applyStats(allTowers);
        
        return true;
    }

    infect() {
        if (this.type === 'support_sensor') return; // Sensors can't be infected
        
        this.infection = {
            cureClicks: 0,
            cureRequired: this.gameData.game_settings.infection_mechanic.cure_clicks_required
        };
        
        this.applyStats();
    }

    handleClickCure(gameState) {
        if (!this.infection) return;
        
        this.infection.cureClicks++;
        
        if (this.infection.cureClicks >= this.infection.cureRequired) {
            this.cure(gameState);
        }
    }

    cure(gameState) {
        if (!this.infection) return;
        
        this.infection = null;
        this.applyStats(gameState.towers);
        gameState.gameStats.infectionsCured++;
        showNotification(`${this.name} đã được chữa khỏi!`);
    }

    draw(ctx) {
        ctx.save();
        
        // Draw base
        this.drawBase(ctx);
        
        // Draw tower type indicator
        this.drawTowerIcon(ctx);
        
        // Draw infection indicator
        if (this.infection) {
            this.drawInfectionIndicator(ctx);
        }
        
        ctx.restore();
    }

    drawBase(ctx) {
        // Outer ring
        ctx.fillStyle = this.infection ? '#FF6347' : '#808080';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner circle with tower color
        const colors = {
            'eco_basic': '#00FF00',
            'drone': '#ADD8E6',
            'greenhouse': '#90EE90',
            'harvester': '#FFA500',
            'sprinkler': '#1E90FF',
            'sensor': '#FFFF00'
        };
        
        ctx.fillStyle = colors[this.id] || '#FFFFFF';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius - 3 - this.level, 0, Math.PI * 2);
        ctx.fill();
    }

    drawTowerIcon(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const icons = {
            'eco': '$',
            'single': '⚡',
            'single_heavy': '💪',
            'aoe': '💧',
            'support': '📡',
            'support_sensor': '💡'
        };
        
        const icon = icons[this.type] || '?';
        ctx.fillText(icon, this.x, this.y);
    }

    drawInfectionIndicator(ctx) {
        if (!this.infection) return;
        
        // Pulsing red glow
        const pulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.7;
        ctx.strokeStyle = `rgba(255, 0, 0, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
        
        // Cure progress
        if (this.infection.cureClicks > 0) {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
                `${this.infection.cureClicks}/${this.infection.cureRequired}`,
                this.x,
                this.y - this.radius - 15
            );
        }
    }

    drawRange(ctx) {
        if (!this.stats.range) return;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.stats.range, 0, Math.PI * 2);
        
        // Fill
        ctx.fillStyle = this.infection ? 
            `rgba(255, 0, 0, ${this.rangeAlpha})` : 
            `rgba(100, 100, 100, ${this.rangeAlpha})`;
        ctx.fill();
        
        // Stroke
        ctx.strokeStyle = this.infection ? 
            'rgba(255, 0, 0, 0.3)' : 
            'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
    }

    get isInfected() {
        return this.infection !== null;
    }
    
    get currentRange() {
        return this.stats.range || 0;
    }
    
    get dmg() {
        return this.stats.dmg;
    }
    
    get firerate() {
        return this.stats.firerate_s;
    }
    
    get range() {
        return this.stats.range;
    }
    
    get income() {
        return this.stats.income;
    }
    
    get interval() {
        return this.stats.interval_s;
    }
    
    get buffs() {
        return {
            firerate_pct: this.stats.buff_firerate_pct || 0,
            range_pct: this.stats.buff_range_pct || 0
        };
    }
    
    get ability() {
        return this.stats.ability;
    }
    
    get infectionCureClicks() {
        return this.infection ? this.infection.cureClicks : 0;
    }
}

/**
 * Projectile entity with improved targeting and effects
 */
export class Projectile extends Entity {
    constructor(data) {
        super(data.x, data.y);
        
        // Core properties
        this.damage = data.damage;
        this.towerId = data.towerId;
        this.towerType = data.towerType;
        
        // Targeting
        this.target = data.target || null;
        this.targetPos = data.targetPos || null;
        this.aoeRadius = data.aoeRadius || 0;
        
        // Movement
        this.speed = GameConstants.PROJECTILE_SPEED;
        this.maxLifetime = 5; // seconds
        this.lifetime = 0;
        
        // Effects
        this.ability = data.ability || null;
        
        // Visual
        this.radius = this.aoeRadius > 0 ? 7 : 5;
        this.color = this.aoeRadius > 0 ? '#1E90FF' : '#FFA500';
        this.trail = [];
        this.maxTrailLength = 5;
    }

    update(deltaTime, gameState) {
        if (!this.active) return;
        
        this.lifetime += deltaTime;
        
        // Deactivate if too old
        if (this.lifetime > this.maxLifetime) {
            this.active = false;
            return;
        }
        
        // Update trail
        this.updateTrail();
        
        // Move based on type
        if (this.aoeRadius > 0) {
            this.updateAOE(deltaTime, gameState);
        } else {
            this.updateSingleTarget(deltaTime, gameState);
        }
    }

    updateTrail() {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }
    }

    updateSingleTarget(deltaTime, gameState) {
        // Check if target is still valid
        if (!this.target || !this.target.isAlive()) {
            this.active = false;
            return;
        }
        
        // Move towards target
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.hypot(dx, dy);
        
        if (distance < 10) {
            this.hit(gameState);
        } else {
            const moveDistance = this.speed * deltaTime;
            this.x += (dx / distance) * moveDistance;
            this.y += (dy / distance) * moveDistance;
        }
    }

    updateAOE(deltaTime, gameState) {
        // Move to target position
        const dx = this.targetPos.x - this.x;
        const dy = this.targetPos.y - this.y;
        const distance = Math.hypot(dx, dy);
        
        if (distance < 10) {
            this.explode(gameState);
        } else {
            const moveDistance = this.speed * deltaTime;
            this.x += (dx / distance) * moveDistance;
            this.y += (dy / distance) * moveDistance;
        }
    }

    hit(gameState) {
        if (!this.target || !this.target.isAlive()) {
            this.active = false;
            return;
        }
        
        // Deal damage
        const killed = this.target.takeDamage(this.damage);
        
        // Track damage stats
        if (gameState.gameStats.damageDealt[this.towerId] !== undefined) {
            gameState.gameStats.damageDealt[this.towerId] += this.damage;
        }
        
        // Apply ability effects
        if (this.ability && this.ability.slow_pct) {
            this.target.applyStatusEffect(
                'slow',
                this.ability.slow_pct / 100,
                1.5
            );
        }
        
        this.active = false;
    }

    explode(gameState) {
        // Find all enemies in AOE radius
        const targets = gameState.enemies.filter(enemy =>
            enemy.isAlive() &&
            this.isInRange(enemy, this.aoeRadius)
        );
        
        // Deal damage to all targets
        targets.forEach(enemy => {
            enemy.takeDamage(this.damage);
            
            // Track damage stats
            if (gameState.gameStats.damageDealt[this.towerId] !== undefined) {
                gameState.gameStats.damageDealt[this.towerId] += this.damage;
            }
        });
        
        this.active = false;
    }

    draw(ctx) {
        ctx.save();
        
        // Draw trail
        this.drawTrail(ctx);
        
        // Draw projectile
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Add glow effect
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        
        ctx.restore();
    }

    drawTrail(ctx) {
        if (this.trail.length < 2) return;
        
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = 0.5;
        
        for (let i = 1; i < this.trail.length; i++) {
            ctx.lineWidth = (i / this.trail.length) * 2;
            ctx.globalAlpha = (i / this.trail.length) * 0.5;
            ctx.beginPath();
            ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
            ctx.stroke();
        }
        
        ctx.globalAlpha = 1;
    }
}