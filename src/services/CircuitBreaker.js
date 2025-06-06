const logger = require('../utils/Logger');

/**
 * Circuit Breaker Service
 * Implements circuit breaker pattern to prevent cascading failures
 * States: CLOSED (normal), OPEN (failing), HALF_OPEN (testing)
 */
class CircuitBreaker {
  constructor(name, config = {}) {
    this.name = name;
    this.config = {
      failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5,    // Number of failures to open circuit
      successThreshold: parseInt(process.env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD) || 2, // Number of successes to close circuit
      timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 30000,          // Time to wait before trying again (ms)
      ...config
    };

    this.state = 'CLOSED';  // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    logger.info('Circuit breaker created', { 
      name: this.name, 
      config: this.config 
    });
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Function to execute
   * @param {...any} args - Arguments for the function
   * @returns {Promise<any>} - Function result
   */
  async execute(fn, ...args) {
    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        error.code = 'CIRCUIT_BREAKER_OPEN';
        error.retryAfter = Math.ceil((this.nextAttemptTime - Date.now()) / 1000);
        throw error;
      } else {
        // Try to half-open the circuit
        this._setState('HALF_OPEN');
      }
    }

    try {
      const result = await fn(...args);
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   * @private
   */
  _onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      
      if (this.successCount >= this.config.successThreshold) {
        this._setState('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failureCount = 0;
    }

    logger.debug('Circuit breaker success', {
      name: this.name,
      state: this.state,
      successCount: this.successCount,
      failureCount: this.failureCount
    });
  }

  /**
   * Handle failed execution
   * @param {Error} error - Error that occurred
   * @private
   */
  _onFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // Only count retryable errors towards circuit breaker
    if (error.retryable === false) {
      logger.debug('Non-retryable error, not counting towards circuit breaker', {
        name: this.name,
        error: error.message
      });
      return;
    }

    if (this.state === 'HALF_OPEN') {
      // If we fail while half-open, go back to open
      this._setState('OPEN');
    } else if (this.state === 'CLOSED' && this.failureCount >= this.config.failureThreshold) {
      this._setState('OPEN');
    }

    logger.debug('Circuit breaker failure', {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      error: error.message
    });
  }

  /**
   * Set circuit breaker state
   * @param {string} newState - New state
   * @private
   */
  _setState(newState) {
    const oldState = this.state;
    this.state = newState;

    switch (newState) {
      case 'CLOSED':
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttemptTime = null;
        break;
        
      case 'OPEN':
        this.successCount = 0;
        this.nextAttemptTime = Date.now() + this.config.timeout;
        break;
        
      case 'HALF_OPEN':
        this.successCount = 0;
        break;
    }

    if (oldState !== newState) {
      logger.logCircuitBreaker(this.name, newState, {
        failureCount: this.failureCount,
        successCount: this.successCount,
        nextAttemptTime: this.nextAttemptTime ? new Date(this.nextAttemptTime).toISOString() : null
      });
    }
  }

  /**
   * Get current circuit breaker status
   * @returns {Object} - Status information
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      nextAttemptTime: this.nextAttemptTime ? new Date(this.nextAttemptTime).toISOString() : null,
      config: this.config
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset() {
    this._setState('CLOSED');
    logger.info('Circuit breaker manually reset', { name: this.name });
  }

  /**
   * Force circuit breaker to open state
   */
  forceOpen() {
    this._setState('OPEN');
    logger.warn('Circuit breaker forced to OPEN state', { name: this.name });
  }

  /**
   * Check if circuit breaker allows requests
   * @returns {boolean}
   */
  canExecute() {
    if (this.state === 'CLOSED' || this.state === 'HALF_OPEN') {
      return true;
    }
    
    if (this.state === 'OPEN') {
      return Date.now() >= this.nextAttemptTime;
    }
    
    return false;
  }

  /**
   * Get time until next attempt (for OPEN state)
   * @returns {number|null} - Milliseconds until next attempt, null if not applicable
   */
  getTimeUntilNextAttempt() {
    if (this.state === 'OPEN' && this.nextAttemptTime) {
      const timeRemaining = this.nextAttemptTime - Date.now();
      return timeRemaining > 0 ? timeRemaining : 0;
    }
    return null;
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Get or create a circuit breaker
   * @param {string} name - Circuit breaker name
   * @param {Object} config - Configuration options
   * @returns {CircuitBreaker} - Circuit breaker instance
   */
  getBreaker(name, config = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name);
  }

  /**
   * Get all circuit breakers status
   * @returns {Object} - Status of all circuit breakers
   */
  getAllStatus() {
    const status = {};
    for (const [name, breaker] of this.breakers.entries()) {
      status[name] = breaker.getStatus();
    }
    return status;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    logger.info('All circuit breakers reset');
  }

  /**
   * Clear all circuit breakers (useful for testing)
   */
  clear() {
    this.breakers.clear();
    logger.debug('Circuit breaker manager cleared');
  }
}

// Export both classes
module.exports = {
  CircuitBreaker,
  CircuitBreakerManager: new CircuitBreakerManager() // Singleton
};
