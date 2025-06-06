const PrimaryEmailProvider = require('./PrimaryEmailProvider');
const SecondaryEmailProvider = require('./SecondaryEmailProvider');

/**
 * Provider Factory - Creates and manages email providers
 * Implements Factory pattern for provider creation
 */
class ProviderFactory {
  constructor() {
    this.providers = new Map();
    this._initializeProviders();
  }

  /**
   * Initialize email providers
   * @private
   */
  _initializeProviders() {
    // Create primary provider
    const primaryProvider = new PrimaryEmailProvider({
      successRate: parseFloat(process.env.PRIMARY_SUCCESS_RATE) || 0.9, // Default 90% success rate
      minLatency: parseInt(process.env.PRIMARY_MIN_LATENCY) || 200,
      maxLatency: parseInt(process.env.PRIMARY_MAX_LATENCY) || 800
    });

    // Create secondary provider
    const secondaryProvider = new SecondaryEmailProvider({
      successRate: parseFloat(process.env.SECONDARY_SUCCESS_RATE) || 0.95, // Default 95% success rate
      minLatency: parseInt(process.env.SECONDARY_MIN_LATENCY) || 300,
      maxLatency: parseInt(process.env.SECONDARY_MAX_LATENCY) || 1200
    });

    this.providers.set('primary', primaryProvider);
    this.providers.set('secondary', secondaryProvider);
  }

  /**
   * Get a provider by name
   * @param {string} providerName - Name of the provider
   * @returns {BaseEmailProvider} - Email provider instance
   */
  getProvider(providerName) {
    const provider = this.providers.get(providerName.toLowerCase());
    if (!provider) {
      throw new Error(`Provider '${providerName}' not found`);
    }
    return provider;
  }

  /**
   * Get primary provider
   * @returns {BaseEmailProvider}
   */
  getPrimaryProvider() {
    return this.getProvider('primary');
  }

  /**
   * Get secondary provider
   * @returns {BaseEmailProvider}
   */
  getSecondaryProvider() {
    return this.getProvider('secondary');
  }

  /**
   * Get all providers
   * @returns {Array<BaseEmailProvider>}
   */
  getAllProviders() {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider names
   * @returns {Array<string>}
   */
  getProviderNames() {
    return Array.from(this.providers.keys());
  }

  /**
   * Check health of all providers
   * @returns {Promise<Object>} - Health status of all providers
   */
  async checkAllProvidersHealth() {
    const healthChecks = {};
    
    for (const [name, provider] of this.providers) {
      try {
        const isHealthy = await provider.checkHealth();
        healthChecks[name] = {
          healthy: isHealthy,
          lastChecked: new Date().toISOString(),
          stats: provider.getStats ? provider.getStats() : null
        };
      } catch (error) {
        healthChecks[name] = {
          healthy: false,
          lastChecked: new Date().toISOString(),
          error: error.message
        };
      }
    }

    return healthChecks;
  }

  /**
   * Get provider statistics
   * @returns {Object} - Statistics for all providers
   */
  getProvidersStats() {
    const stats = {};
    
    for (const [name, provider] of this.providers) {
      stats[name] = provider.getStats ? provider.getStats() : {
        name: provider.name,
        status: 'unknown'
      };
    }

    return stats;
  }

  /**
   * Reset providers (useful for testing)
   */
  reset() {
    this.providers.clear();
    this._initializeProviders();
  }
}

// Export singleton instance
module.exports = new ProviderFactory();
