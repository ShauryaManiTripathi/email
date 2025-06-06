const logger = require('../utils/Logger');

/**
 * Rate Limiter Service
 * Implements token bucket algorithm for rate limiting
 * In production, this would use Redis for distributed rate limiting
 */
class RateLimiter {
  constructor(config = {}) {
    this.config = {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000,     // 1 minute
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
      keyGenerator: config.keyGenerator || this._defaultKeyGenerator,
      skipSuccessful: config.skipSuccessful || false,
      skipFailed: config.skipFailed || false,
      ...config
    };

    // In-memory storage for demo purposes
    // In production, use Redis for distributed rate limiting
    this.buckets = new Map();
    
    // Clean up expired buckets periodically
    this.startCleanupInterval();
  }

  /**
   * Default key generator (use IP address)
   * @param {Object} req - Express request object
   * @returns {string} - Key for rate limiting
   */
  _defaultKeyGenerator(req) {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  /**
   * Check if request is allowed
   * @param {Object} req - Express request object
   * @returns {Object} - Rate limit result
   */
  checkLimit(req) {
    const key = this.config.keyGenerator(req);
    const now = Date.now();
    
    // Get or create bucket for this key
    let bucket = this.buckets.get(key);
    
    if (!bucket) {
      bucket = {
        tokens: this.config.maxRequests,
        lastRefill: now,
        requests: []
      };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on time elapsed
    this._refillBucket(bucket, now);

    // Check if request is allowed
    if (bucket.tokens > 0) {
      bucket.tokens--;
      bucket.requests.push(now);
      
      const result = {
        allowed: true,
        tokens: bucket.tokens,
        resetTime: bucket.lastRefill + this.config.windowMs,
        retryAfter: null
      };

      logger.debug('Rate limit check passed', { 
        key, 
        tokens: bucket.tokens, 
        maxRequests: this.config.maxRequests 
      });

      return result;
    } else {
      // Rate limit exceeded
      const retryAfter = Math.ceil((bucket.lastRefill + this.config.windowMs - now) / 1000);
      
      const result = {
        allowed: false,
        tokens: 0,
        resetTime: bucket.lastRefill + this.config.windowMs,
        retryAfter: retryAfter
      };

      logger.logRateLimit(key, bucket.requests.length, this.config.maxRequests);

      return result;
    }
  }

  /**
   * Refill bucket tokens based on time elapsed
   * @param {Object} bucket - Token bucket
   * @param {number} now - Current timestamp
   */
  _refillBucket(bucket, now) {
    const timeElapsed = now - bucket.lastRefill;
    
    if (timeElapsed >= this.config.windowMs) {
      // Full refill
      bucket.tokens = this.config.maxRequests;
      bucket.lastRefill = now;
      bucket.requests = bucket.requests.filter(req => now - req < this.config.windowMs);
    }
  }

  /**
   * Express middleware for rate limiting
   * @returns {Function} - Express middleware function
   */
  middleware() {
    return (req, res, next) => {
      const result = this.checkLimit(req);
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': this.config.maxRequests,
        'X-RateLimit-Remaining': result.tokens,
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });

      if (!result.allowed) {
        res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter
        });
        return;
      }

      next();
    };
  }

  /**
   * Check rate limit for a specific key
   * @param {string} key - Rate limit key
   * @returns {Object} - Rate limit result
   */
  checkKey(key) {
    const mockReq = { 
      ip: key,
      connection: { remoteAddress: key }
    };
    return this.checkLimit(mockReq);
  }

  /**
   * Reset rate limit for a specific key
   * @param {string} key - Rate limit key
   */
  reset(key) {
    this.buckets.delete(key);
    logger.debug('Rate limit reset', { key });
  }

  /**
   * Get rate limit statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    const stats = {
      totalKeys: this.buckets.size,
      config: {
        windowMs: this.config.windowMs,
        maxRequests: this.config.maxRequests
      },
      buckets: {}
    };

    for (const [key, bucket] of this.buckets.entries()) {
      stats.buckets[key] = {
        tokens: bucket.tokens,
        requests: bucket.requests.length,
        lastRefill: new Date(bucket.lastRefill).toISOString()
      };
    }

    return stats;
  }

  /**
   * Clean up expired buckets
   */
  cleanupExpired() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, bucket] of this.buckets.entries()) {
      const timeSinceLastUse = now - bucket.lastRefill;
      
      // Remove buckets that haven't been used for 2x the window time
      if (timeSinceLastUse > this.config.windowMs * 2) {
        this.buckets.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Cleaned up expired rate limit buckets', { count: cleaned });
    }

    return cleaned;
  }

  /**
   * Start periodic cleanup of expired buckets
   */
  startCleanupInterval() {
    // Clean up every 5 minutes
    const intervalMs = parseInt(process.env.RATE_LIMIT_CLEANUP_INTERVAL) || 300000;
    
    setInterval(() => {
      this.cleanupExpired();
    }, intervalMs);

    logger.info('Rate limiter cleanup interval started', { intervalMs });
  }

  /**
   * Clear all buckets (useful for testing)
   */
  clear() {
    this.buckets.clear();
    logger.debug('Rate limiter buckets cleared');
  }
}

module.exports = RateLimiter;
