const logger = require('./Logger');

/**
 * Idempotency Manager
 * Ensures that identical requests are not processed multiple times
 * In production, this would use Redis or a database for persistence
 */
class IdempotencyManager {
  constructor() {
    // In-memory storage for demo purposes
    // In production, use Redis or database
    this.cache = new Map();
    this.ttl = parseInt(process.env.IDEMPOTENCY_TTL) || 86400000; // 24 hours in milliseconds
    
    // Clean up expired entries periodically
    this.startCleanupInterval();
  }

  /**
   * Check if a request has already been processed
   * @param {string} idempotencyKey - Unique request identifier
   * @returns {Object|null} - Previous result if exists, null otherwise
   */
  get(idempotencyKey) {
    if (!idempotencyKey) {
      throw new Error('Idempotency key is required');
    }

    const entry = this.cache.get(idempotencyKey);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(idempotencyKey);
      logger.debug('Idempotency entry expired', { idempotencyKey });
      return null;
    }

    logger.debug('Idempotency key found', { 
      idempotencyKey, 
      status: entry.status,
      createdAt: entry.createdAt 
    });

    return entry;
  }

  /**
   * Store the result of a processed request
   * @param {string} idempotencyKey - Unique request identifier
   * @param {Object} result - Result to store
   * @param {string} status - Status of the request (pending, completed, failed)
   */
  set(idempotencyKey, result, status = 'completed') {
    if (!idempotencyKey) {
      throw new Error('Idempotency key is required');
    }

    const entry = {
      idempotencyKey,
      result,
      status,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + this.ttl
    };

    this.cache.set(idempotencyKey, entry);

    logger.debug('Idempotency entry stored', { 
      idempotencyKey, 
      status, 
      expiresAt: new Date(entry.expiresAt).toISOString() 
    });
  }

  /**
   * Mark a request as pending (in progress)
   * @param {string} idempotencyKey - Unique request identifier
   * @param {Object} metadata - Additional metadata
   */
  markAsPending(idempotencyKey, metadata = {}) {
    this.set(idempotencyKey, { 
      status: 'pending',
      startedAt: new Date().toISOString(),
      attempts: 0, // Initialize attempts counter
      ...metadata 
    }, 'pending');
  }

  /**
   * Mark a request as completed
   * @param {string} idempotencyKey - Unique request identifier
   * @param {Object} result - Final result
   */
  markAsCompleted(idempotencyKey, result) {
    this.set(idempotencyKey, {
      ...result,
      completedAt: new Date().toISOString()
    }, 'completed');
  }

  /**
   * Mark a request as failed
   * @param {string} idempotencyKey - Unique request identifier
   * @param {Object} error - Error details
   */
  markAsFailed(idempotencyKey, error) {
    this.set(idempotencyKey, {
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      failedAt: new Date().toISOString()
    }, 'failed');
  }

  /**
   * Update the status of an existing entry
   * @param {string} idempotencyKey - Unique request identifier
   * @param {Object} updates - Updates to apply
   */
  update(idempotencyKey, updates) {
    const existing = this.get(idempotencyKey);
    if (!existing) {
      throw new Error('Idempotency key not found');
    }

    const updatedEntry = {
      ...existing,
      result: {
        ...existing.result,
        ...updates
      },
      updatedAt: new Date().toISOString()
    };

    this.cache.set(idempotencyKey, updatedEntry);
    
    logger.debug('Idempotency entry updated', { idempotencyKey, updates });
  }

  /**
   * Delete an idempotency entry
   * @param {string} idempotencyKey - Unique request identifier
   */
  delete(idempotencyKey) {
    const deleted = this.cache.delete(idempotencyKey);
    if (deleted) {
      logger.debug('Idempotency entry deleted', { idempotencyKey });
    }
    return deleted;
  }

  /**
   * Get statistics about stored entries
   * @returns {Object} - Statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    const stats = {
      total: entries.length,
      pending: 0,
      completed: 0,
      failed: 0,
      expired: 0
    };

    entries.forEach(entry => {
      if (now > entry.expiresAt) {
        stats.expired++;
      } else {
        stats[entry.status]++;
      }
    });

    return stats;
  }

  /**
   * Clean up expired entries
   */
  cleanupExpired() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Cleaned up expired idempotency entries', { count: cleaned });
    }

    return cleaned;
  }

  /**
   * Start periodic cleanup of expired entries
   */
  startCleanupInterval() {
    // Clean up every hour
    const intervalMs = parseInt(process.env.CLEANUP_INTERVAL) || 3600000;
    
    setInterval(() => {
      this.cleanupExpired();
    }, intervalMs);

    logger.info('Idempotency cleanup interval started', { intervalMs });
  }

  /**
   * Clear all entries (useful for testing)
   */
  clear() {
    this.cache.clear();
    logger.debug('Idempotency cache cleared');
  }

  /**
   * Get all entries (for debugging)
   * @returns {Array} - All entries
   */
  getAllEntries() {
    return Array.from(this.cache.values());
  }

  /**
   * Increment the attempts counter for a request
   * @param {string} idempotencyKey - Unique request identifier
   * @returns {number} - New attempts count
   */
  incrementAttempts(idempotencyKey) {
    const existing = this.get(idempotencyKey);
    if (!existing) {
      throw new Error('Idempotency key not found');
    }

    // Get current attempts from either the top level or result level
    const currentAttempts = existing.attempts || existing.result?.attempts || 0;
    const newAttempts = currentAttempts + 1;
    
    const updatedEntry = {
      ...existing,
      attempts: newAttempts,
      result: {
        ...existing.result,
        attempts: newAttempts
      },
      lastAttemptAt: new Date().toISOString()
    };

    this.cache.set(idempotencyKey, updatedEntry);
    
    logger.debug('Idempotency attempts incremented', { 
      idempotencyKey, 
      attempts: newAttempts,
      lastAttemptAt: updatedEntry.lastAttemptAt
    });

    return newAttempts;
  }
}

// Export singleton instance
module.exports = new IdempotencyManager();
