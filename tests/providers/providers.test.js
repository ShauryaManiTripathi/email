const PrimaryEmailProvider = require('../../src/providers/PrimaryEmailProvider');
const SecondaryEmailProvider = require('../../src/providers/SecondaryEmailProvider');
const ProviderFactory = require('../../src/providers/ProviderFactory');

describe('Email Providers', () => {
  beforeEach(() => {
    // Reset providers before each test
    ProviderFactory.reset();
  });

  describe('PrimaryEmailProvider', () => {
    let provider;

    beforeEach(() => {
      provider = new PrimaryEmailProvider({
        successRate: 1.0, // 100% success for testing
        minLatency: 10,
        maxLatency: 20
      });
    });

    test('should send email successfully', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test Body'
      };

      const result = await provider.sendEmail(emailData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.provider).toBe('Primary');
      expect(result.timestamp).toBeDefined();
      expect(result.details.to).toBe(emailData.to);
      expect(result.details.subject).toBe(emailData.subject);
    });

    test('should throw error for missing required fields', async () => {
      const emailData = {
        to: 'test@example.com'
        // missing subject and body
      };

      await expect(provider.sendEmail(emailData)).rejects.toThrow('Missing required email fields');
    });

    test('should simulate failures based on success rate', async () => {
      const failingProvider = new PrimaryEmailProvider({
        successRate: 0.0, // 0% success rate
        minLatency: 10,
        maxLatency: 20
      });

      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test Body'
      };

      await expect(failingProvider.sendEmail(emailData)).rejects.toThrow();
    });

    test('should check health status', async () => {
      const isHealthy = await provider.checkHealth();
      expect(typeof isHealthy).toBe('boolean');
    });

    test('should return provider stats', () => {
      const stats = provider.getStats();
      
      expect(stats.name).toBe('Primary');
      expect(stats.successRate).toBeDefined();
      expect(stats.avgLatency).toBeDefined();
      expect(stats.isHealthy).toBe(true);
    });
  });

  describe('SecondaryEmailProvider', () => {
    let provider;

    beforeEach(() => {
      provider = new SecondaryEmailProvider({
        successRate: 1.0,
        minLatency: 10,
        maxLatency: 20
      });
    });

    test('should send email successfully', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test Body'
      };

      const result = await provider.sendEmail(emailData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.provider).toBe('Secondary');
      expect(result.details.to).toBe(emailData.to);
    });

    test('should have role as fallback', () => {
      const stats = provider.getStats();
      expect(stats.role).toBe('fallback');
    });
  });

  describe('ProviderFactory', () => {
    test('should get primary provider', () => {
      const provider = ProviderFactory.getPrimaryProvider();
      expect(provider.name).toBe('Primary');
    });

    test('should get secondary provider', () => {
      const provider = ProviderFactory.getSecondaryProvider();
      expect(provider.name).toBe('Secondary');
    });

    test('should get provider by name', () => {
      const primaryProvider = ProviderFactory.getProvider('primary');
      const secondaryProvider = ProviderFactory.getProvider('secondary');
      
      expect(primaryProvider.name).toBe('Primary');
      expect(secondaryProvider.name).toBe('Secondary');
    });

    test('should throw error for unknown provider', () => {
      expect(() => {
        ProviderFactory.getProvider('unknown');
      }).toThrow('Provider \'unknown\' not found');
    });

    test('should get all providers', () => {
      const providers = ProviderFactory.getAllProviders();
      expect(providers).toHaveLength(2);
      expect(providers[0].name).toBe('Primary');
      expect(providers[1].name).toBe('Secondary');
    });

    test('should get provider names', () => {
      const names = ProviderFactory.getProviderNames();
      expect(names).toContain('primary');
      expect(names).toContain('secondary');
    });

    test('should check all providers health', async () => {
      const healthChecks = await ProviderFactory.checkAllProvidersHealth();
      
      expect(healthChecks.primary).toBeDefined();
      expect(healthChecks.secondary).toBeDefined();
      expect(healthChecks.primary.healthy).toBeDefined();
      expect(healthChecks.secondary.healthy).toBeDefined();
    });

    test('should get providers stats', () => {
      const stats = ProviderFactory.getProvidersStats();
      
      expect(stats.primary).toBeDefined();
      expect(stats.secondary).toBeDefined();
      expect(stats.primary.name).toBe('Primary');
      expect(stats.secondary.name).toBe('Secondary');
    });
  });
});
