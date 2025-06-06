const BaseEmailProvider = require('./BaseEmailProvider');

/**
 * Primary Email Provider (simulates SendGrid, Mailgun, etc.)
 * This is the preferred provider with higher reliability
 */
class PrimaryEmailProvider extends BaseEmailProvider {
  constructor(config = {}) {
    super('Primary', {
      successRate: 0.9, // Default to 90% success rate
      minLatency: 200,
      maxLatency: 800,
      ...config
    });
  }

  /**
   * Send an email via the primary provider
   * @param {Object} emailData - Email data
   * @returns {Promise<Object>} - Result object
   */
  async sendEmail(emailData) {
    const { to, subject, body } = emailData;
    console.log("PRIMARY SUCCESS RATE: ", this.config.successRate);
    // Validate email data
    if (!to || !subject || !body) {
      const error = new Error('Missing required email fields: to, subject, body');
      error.code = 'MISSING_FIELDS';
      error.retryable = false;
      throw error;
    }

    // Simulate network latency
    await this._simulateLatency();

    // Simulate different types of failures
    const shouldSucceed = this._shouldSucceed();
    
    if (!shouldSucceed) {
      // Simulate different error types
      const errorType = Math.random();
      
      if (errorType < 0.3) {
        // Temporary error (30% of failures)
        const error = new Error('Temporary service unavailable');
        error.code = 'TEMPORARY_FAILURE';
        error.retryable = true;
        throw error;
      } else if (errorType < 0.6) {
        // Rate limit error (30% of failures)
        const error = new Error('Rate limit exceeded');
        error.code = 'RATE_LIMIT_EXCEEDED';
        error.retryable = true;
        error.retryAfter = 5; // 5 seconds
        throw error;
      } else {
        // Provider-specific validation error (40% of failures)
        const error = new Error('Primary provider: Invalid email format');
        error.code = 'INVALID_EMAIL';
        error.retryable = false; // Allow fallback to other providers
        throw error;
      }
    }

    // Success case
    const messageId = this._generateMessageId();
    
    return {
      success: true,
      messageId,
      provider: this.name,
      timestamp: new Date().toISOString(),
      details: {
        to,
        subject,
        processingTime: Math.floor(Math.random() * 500) + 100
      }
    };
  }

  /**
   * Check provider health
   * @returns {Promise<boolean>}
   */
  async checkHealth() {
    try {
      await this._simulateLatency();
      // Simulate occasional health check failures
      return Math.random() > 0.1; // 90% uptime
    } catch (error) {
      return false;
    }
  }

  /**
   * Get provider statistics (mock data)
   * @returns {Object}
   */
  getStats() {
    return {
      name: this.name,
      successRate: this.config.successRate,
      avgLatency: (this.config.minLatency + this.config.maxLatency) / 2,
      isHealthy: true,
      lastHealthCheck: new Date().toISOString()
    };
  }
}

module.exports = PrimaryEmailProvider;
