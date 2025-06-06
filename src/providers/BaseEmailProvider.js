/**
 * Base Email Provider Interface
 * Defines the contract that all email providers must implement
 */
class BaseEmailProvider {
  constructor(name, config = {}) {
    this.name = name;
    this.config = {
      successRate: 0.8, // 80% success rate by default
      minLatency: 100,   // minimum 100ms latency
      maxLatency: 1000,  // maximum 1000ms latency
      ...config
    };
  }

  /**
   * Send an email
   * @param {Object} emailData - Email data containing to, subject, body
   * @returns {Promise<Object>} - Result object with success status and details
   */
  async sendEmail(emailData) {
    throw new Error('sendEmail method must be implemented by subclass');
  }

  /**
   * Check provider health
   * @returns {Promise<boolean>} - Provider health status
   */
  async checkHealth() {
    throw new Error('checkHealth method must be implemented by subclass');
  }

  /**
   * Simulate network latency
   * @returns {Promise<void>}
   */
  async _simulateLatency() {
    const latency = Math.random() * (this.config.maxLatency - this.config.minLatency) + this.config.minLatency;
    return new Promise(resolve => setTimeout(resolve, latency));
  }

  /**
   * Simulate success/failure based on configured success rate
   * @returns {boolean}
   */
  _shouldSucceed() {
    return Math.random() < this.config.successRate;
  }

  /**
   * Generate a mock message ID
   * @returns {string}
   */
  _generateMessageId() {
    return `${this.name.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = BaseEmailProvider;
