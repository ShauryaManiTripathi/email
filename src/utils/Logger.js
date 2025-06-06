/**
 * Simple Logger utility
 * In production, this would be replaced with a proper logging library like Winston
 */
class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  /**
   * Check if log level should be logged
   * @param {string} level - Log level
   * @returns {boolean}
   */
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  /**
   * Format log message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   * @returns {string}
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Object} meta - Additional metadata
   */
  error(message, meta = {}) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, meta));
    }
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, meta));
    }
  }

  /**
   * Create a child logger with additional context
   * @param {Object} context - Additional context for all log messages
   * @returns {Logger}
   */
  child(context = {}) {
    const childLogger = new Logger();
    childLogger.logLevel = this.logLevel;
    
    // Override formatting to include context
    const originalFormatMessage = childLogger.formatMessage.bind(childLogger);
    childLogger.formatMessage = (level, message, meta = {}) => {
      return originalFormatMessage(level, message, { ...context, ...meta });
    };
    
    return childLogger;
  }

  /**
   * Log email sending attempt
   * @param {string} idempotencyKey - Request ID
   * @param {string} provider - Provider name
   * @param {string} status - Attempt status
   * @param {Object} details - Additional details
   */
  logEmailAttempt(idempotencyKey, provider, status, details = {}) {
    this.info('Email sending attempt', {
      idempotencyKey,
      provider,
      status,
      ...details
    });
  }

  /**
   * Log email sending result
   * @param {string} idempotencyKey - Request ID
   * @param {boolean} success - Whether the email was sent successfully
   * @param {Object} result - Result details
   */
  logEmailResult(idempotencyKey, success, result = {}) {
    const level = success ? 'info' : 'error';
    this[level]('Email sending result', {
      idempotencyKey,
      success,
      ...result
    });
  }

  /**
   * Log rate limiting event
   * @param {string} clientId - Client identifier
   * @param {number} attempts - Number of attempts
   * @param {number} limit - Rate limit
   */
  logRateLimit(clientId, attempts, limit) {
    this.warn('Rate limit triggered', {
      clientId,
      attempts,
      limit
    });
  }

  /**
   * Log circuit breaker event
   * @param {string} provider - Provider name
   * @param {string} state - Circuit breaker state
   * @param {Object} details - Additional details
   */
  logCircuitBreaker(provider, state, details = {}) {
    this.warn('Circuit breaker state change', {
      provider,
      state,
      ...details
    });
  }
}

// Export singleton instance
module.exports = new Logger();
