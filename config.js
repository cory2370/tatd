// config.js - Complete rewrite with better configuration management
// Centralized game configuration and utilities

/**
 * Game constants and configuration values
 */
export const GameConstants = {
    // Entity properties
    TOWER_RADIUS: 20,
    TOWER_MIN_DISTANCE: 40,
    PATH_CLEARANCE: 45,
    
    // Movement speeds (pixels per second base)
    ENEMY_SPEED_MULTIPLIER: 60,
    PROJECTILE_SPEED: 400,
    
    // Visual settings
    PATH_WIDTH: 50,
    PATH_INNER_WIDTH: 44,
    HEALTH_BAR_HEIGHT: 4,
    
    // Game mechanics
    SELL_REFUND_RATE: 0.7,
    MAX_DELTA_TIME: 0.1,
    DEFAULT_DELTA_TIME: 0.016,
    
    // UI settings
    TOWER_HIT_RADIUS: 25,
    PLACEMENT_PREVIEW_RADIUS: 20,
    
    // Performance
    MAX_PARTICLES: 100,
    MAX_TRAIL_LENGTH: 5
};

/**
 * Color scheme configuration
 */
export const Colors = {
    // Path colors
    PATH_OUTER: '#D2B48C',
    PATH_INNER: '#A0522D',
    
    // Tower colors by ID
    TOWERS: {
        'eco_basic': '#00FF00',
        'drone': '#ADD8E6',
        'greenhouse': '#90EE90',
        'harvester': '#FFA500',
        'sprinkler': '#1E90FF',
        'sensor': '#FFFF00'
    },
    
    // Tower state colors
    TOWER_BASE: '#808080',
    TOWER_INFECTED: '#FF6347',
    
    // Enemy health bar
    HEALTH_HIGH: '#4CAF50',
    HEALTH_MEDIUM: '#FFA500',
    HEALTH_LOW: '#FF4444',
    HEALTH_BACKGROUND: 'rgba(0, 0, 0, 0.5)',
    
    // Projectile colors
    PROJECTILE_SINGLE: '#FFA500',
    PROJECTILE_AOE: '#1E90FF',
    
    // UI colors
    PLACEMENT_VALID: 'rgba(0, 255, 0, 0.3)',
    PLACEMENT_INVALID: 'rgba(255, 0, 0, 0.3)',
    RANGE_NORMAL: 'rgba(100, 100, 100, 0.1)',
    RANGE_INFECTED: 'rgba(255, 0, 0, 0.1)',
    
    // Status effect colors
    EFFECT_SLOW: '#4FC3F7'
};

/**
 * Path waypoints for enemy movement
 */
export const path = [
    { x: -50, y: 200 },
    { x: 300, y: 200 },
    { x: 300, y: 400 },
    { x: 600, y: 400 },
    { x: 600, y: 100 },
    { x: 900, y: 100 },
    { x: 900, y: 500 },
    { x: 1250, y: 500 } // This will be adjusted to canvas width
];

/**
 * Path management utilities
 */
export class PathManager {
    static originalPath = [...path];
    
    /**
     * Update path to match canvas dimensions
     */
    static updatePathForCanvas(canvasWidth, canvasHeight) {
        // Adjust the last waypoint to go off-screen
        if (path.length > 0) {
            path[path.length - 1].x = canvasWidth + 50;
        }
    }
    
    /**
     * Reset path to original configuration
     */
    static resetPath() {
        path.length = 0;
        path.push(...this.originalPath);
    }
    
    /**
     * Get total path length
     */
    static getPathLength() {
        let totalLength = 0;
        for (let i = 1; i < path.length; i++) {
            const dx = path[i].x - path[i - 1].x;
            const dy = path[i].y - path[i - 1].y;
            totalLength += Math.hypot(dx, dy);
        }
        return totalLength;
    }
    
    /**
     * Get position along path at given progress (0-1)
     */
    static getPositionAtProgress(progress) {
        const totalLength = this.getPathLength();
        const targetDistance = totalLength * progress;
        
        let currentDistance = 0;
        for (let i = 1; i < path.length; i++) {
            const dx = path[i].x - path[i - 1].x;
            const dy = path[i].y - path[i - 1].y;
            const segmentLength = Math.hypot(dx, dy);
            
            if (currentDistance + segmentLength >= targetDistance) {
                const segmentProgress = (targetDistance - currentDistance) / segmentLength;
                return {
                    x: path[i - 1].x + dx * segmentProgress,
                    y: path[i - 1].y + dy * segmentProgress,
                    segmentIndex: i - 1
                };
            }
            
            currentDistance += segmentLength;
        }
        
        // Return end position if progress >= 1
        return {
            x: path[path.length - 1].x,
            y: path[path.length - 1].y,
            segmentIndex: path.length - 1
        };
    }
}

/**
 * Geometry utilities
 */
export class GeometryUtils {
    /**
     * Calculate distance between two points
     */
    static distance(p1, p2) {
        return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }
    
    /**
     * Check if point is within given distance of a line segment
     */
    static isPointNearLineSegment(point, lineStart, lineEnd, maxDistance) {
        const lineLength = this.distance(lineStart, lineEnd);
        
        // Handle zero-length line
        if (lineLength === 0) {
            return this.distance(point, lineStart) < maxDistance;
        }
        
        // Calculate projection parameter
        const t = Math.max(0, Math.min(1,
            ((point.x - lineStart.x) * (lineEnd.x - lineStart.x) +
             (point.y - lineStart.y) * (lineEnd.y - lineStart.y)) / (lineLength * lineLength)
        ));
        
        // Find closest point on line segment
        const projection = {
            x: lineStart.x + t * (lineEnd.x - lineStart.x),
            y: lineStart.y + t * (lineEnd.y - lineStart.y)
        };
        
        // Check distance to projection
        return this.distance(point, projection) < maxDistance;
    }
    
    /**
     * Check if point is near any segment of the path
     */
    static isPointNearPath(point, clearance = GameConstants.PATH_CLEARANCE) {
        for (let i = 0; i < path.length - 1; i++) {
            if (this.isPointNearLineSegment(point, path[i], path[i + 1], clearance)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Find all points within a radius
     */
    static getPointsInRadius(center, points, radius) {
        return points.filter(point => 
            this.distance(center, point) <= radius
        );
    }
    
    /**
     * Calculate angle between two points
     */
    static angle(from, to) {
        return Math.atan2(to.y - from.y, to.x - from.x);
    }
    
    /**
     * Rotate point around origin
     */
    static rotatePoint(point, angle, origin = { x: 0, y: 0 }) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = point.x - origin.x;
        const dy = point.y - origin.y;
        
        return {
            x: origin.x + dx * cos - dy * sin,
            y: origin.y + dx * sin + dy * cos
        };
    }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
    constructor() {
        this.fps = 0;
        this.frameTime = 0;
        this.lastTime = performance.now();
        this.frames = 0;
        this.nextUpdate = 0;
    }
    
    update() {
        const now = performance.now();
        const delta = now - this.lastTime;
        this.lastTime = now;
        
        this.frames++;
        this.frameTime = delta;
        
        if (now >= this.nextUpdate) {
            this.fps = Math.round(this.frames * 1000 / (now - this.nextUpdate + 1000));
            this.frames = 0;
            this.nextUpdate = now + 1000;
        }
    }
    
    draw(ctx, x = 10, y = 20) {
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.font = '12px monospace';
        
        const text = `FPS: ${this.fps} | Frame: ${this.frameTime.toFixed(1)}ms`;
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
        
        ctx.restore();
    }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
    /**
     * Validate game data structure
     */
    static validateGameData(data) {
        const required = ['towers', 'enemies', 'waves', 'game_settings'];
        const missing = required.filter(key => !data[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required game data: ${missing.join(', ')}`);
        }
        
        // Validate towers
        if (!Array.isArray(data.towers) || data.towers.length === 0) {
            throw new Error('Invalid towers data');
        }
        
        // Validate enemies
        if (!Array.isArray(data.enemies) || data.enemies.length === 0) {
            throw new Error('Invalid enemies data');
        }
        
        // Validate waves
        if (!Array.isArray(data.waves) || data.waves.length === 0) {
            throw new Error('Invalid waves data');
        }
        
        return true;
    }
    
    /**
     * Validate placement position
     */
    static validatePlacement(x, y, canvasWidth, canvasHeight) {
        // Check bounds
        if (x < GameConstants.TOWER_RADIUS || 
            x > canvasWidth - GameConstants.TOWER_RADIUS ||
            y < GameConstants.TOWER_RADIUS || 
            y > canvasHeight - GameConstants.TOWER_RADIUS) {
            return false;
        }
        
        // Check path clearance
        if (GeometryUtils.isPointNearPath({ x, y })) {
            return false;
        }
        
        return true;
    }
}

// Legacy export for backward compatibility
export function isPointNearLine(point, lineStart, lineEnd, distance) {
    return GeometryUtils.isPointNearLineSegment(point, lineStart, lineEnd, distance);
}