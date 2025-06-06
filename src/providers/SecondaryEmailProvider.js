const BaseEmailProvider = require('./BaseEmailProvider');

/**
 * Secondary Email Provider (fallback provider)
 * This provider has slightly lower performance but serves as a backup
 */
class SecondaryEmailProvider extends BaseEmailProvider {
  constructor(config = {}) {
    super('Secondary', {
      successRate: 0.95, // 95% success rate (very high for testing fallback)
      minLatency: 300,
      maxLatency: 1200,
      ...config
    });
  }

  /**
   * Send an email via the secondary provider
   * @param {Object} emailData - Email data
   * @returns {Promise<Object>} - Result object
   */
  async sendEmail(emailData) {
    const { to, subject, body } = emailData;
    
    // Validate email data
    if (!to || !subject || !body) {
      throw new Error('Missing required email fields: to, subject, body');
    }

    // Simulate network latency (higher than primary)
    await this._simulateLatency();

    // Simulate different types of failures
    const shouldSucceed = this._shouldSucceed();
    
    if (!shouldSucceed) {
      // Simulate different error types (different distribution than primary)
      const errorType = Math.random();
      
      if (errorType < 0.4) {
        // Temporary error (40% of failures - higher than primary)
        const error = new Error('Service temporarily unavailable');
        error.code = 'TEMPORARY_FAILURE';
        error.retryable = true;
        throw error;
      } else if (errorType < 0.7) {
        // Rate limit error (30% of failures)
        const error = new Error('Daily quota exceeded');
        error.code = 'QUOTA_EXCEEDED';
        error.retryable = true;
        error.retryAfter = 10000; // 10 seconds
        throw error;
      } else {
        // Permanent error (30% of failures)
        const error = new Error('Authentication failed');
        error.code = 'AUTH_FAILED';
        error.retryable = false;
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
        processingTime: Math.floor(Math.random() * 800) + 200 // Higher processing time
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
      // Simulate slightly lower uptime than primary
      return Math.random() > 0.15; // 85% uptime
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
      lastHealthCheck: new Date().toISOString(),
      role: 'fallback'
    };
  }
}

module.exports = SecondaryEmailProvider;
