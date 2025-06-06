const EmailService = require('../../src/services/EmailService');
const RateLimiter = require('../../src/services/RateLimiter');
const { CircuitBreaker, CircuitBreakerManager } = require('../../src/services/CircuitBreaker');
const EmailQueue = require('../../src/services/EmailQueue');
const idempotencyManager = require('../../src/utils/IdempotencyManager');

describe('Email Services', () => {
  beforeEach(() => {
    // Clean up before each test
    idempotencyManager.clear();
    CircuitBreakerManager.clear();
  });

  describe('EmailService', () => {
    let emailService;

    beforeEach(() => {
      emailService = new EmailService({
        maxRetries: 2,
        initialRetryDelay: 100,
        enableQueue: false // Disable queue for direct testing
      });
    });

    afterEach(() => {
      emailService.cleanup();
    });

    test('should send email successfully', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        idempotencyKey: 'test-key-1'
      };

      const result = await emailService.sendEmail(emailData);

      expect(result.success).toBe(true);
      expect(result.idempotencyKey).toBe('test-key-1');
      expect(result.messageId).toBeDefined();
    });

    test('should handle idempotent requests', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        idempotencyKey: 'test-key-2'
      };

      // Send first request
      const result1 = await emailService.sendEmail(emailData);
      
      // Send same request again
      const result2 = await emailService.sendEmail(emailData);

      expect(result1.idempotencyKey).toBe(result2.idempotencyKey);
      // Should return cached result for second request
    });

    test('should validate email data', async () => {
      const invalidEmailData = {
        to: '', // invalid
        subject: 'Test Subject',
        body: 'Test Body',
        idempotencyKey: 'test-key-3'
      };

      await expect(emailService.sendEmail(invalidEmailData))
        .rejects.toThrow('Email recipient (to) is required');
    });

    test('should get email status', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        idempotencyKey: 'test-key-4'
      };

      await emailService.sendEmail(emailData);
      const status = emailService.getEmailStatus('test-key-4');

      expect(status.found).toBe(true);
      expect(status.idempotencyKey).toBe('test-key-4');
    });

    test('should return not found for unknown email', () => {
      const status = emailService.getEmailStatus('unknown-key');

      expect(status.found).toBe(false);
      expect(status.message).toBe('Email not found');
    });

    test('should get health status', async () => {
      const health = await emailService.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.providers).toBeDefined();
      expect(health.circuitBreakers).toBeDefined();
      expect(health.queue).toBeDefined();
    });
  });

  describe('RateLimiter', () => {
    let rateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 5
      });
    });

    afterEach(() => {
      rateLimiter.clear();
    });

    test('should allow requests within limit', () => {
      const mockReq = { ip: '127.0.0.1' };

      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.checkLimit(mockReq);
        expect(result.allowed).toBe(true);
        expect(result.tokens).toBe(4 - i);
      }
    });

    test('should block requests exceeding limit', () => {
      const mockReq = { ip: '127.0.0.1' };

      // Use up all tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(mockReq);
      }

      // Next request should be blocked
      const result = rateLimiter.checkLimit(mockReq);
      expect(result.allowed).toBe(false);
      expect(result.tokens).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('should reset tokens after window', async () => {
      const mockReq = { ip: '127.0.0.1' };

      // Use up all tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(mockReq);
      }

      // Wait for window to pass
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should allow requests again
      const result = rateLimiter.checkLimit(mockReq);
      expect(result.allowed).toBe(true);
    });

    test('should track different IPs separately', () => {
      const req1 = { ip: '127.0.0.1' };
      const req2 = { ip: '192.168.1.1' };

      // Use up tokens for first IP
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(req1);
      }

      // Second IP should still have tokens
      const result = rateLimiter.checkLimit(req2);
      expect(result.allowed).toBe(true);
    });

    test('should get rate limiter stats', () => {
      const mockReq = { ip: '127.0.0.1' };
      rateLimiter.checkLimit(mockReq);

      const stats = rateLimiter.getStats();
      expect(stats.totalKeys).toBe(1);
      expect(stats.config.maxRequests).toBe(5);
      expect(stats.buckets['127.0.0.1']).toBeDefined();
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker('test-breaker', {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000
      });
    });

    test('should execute function successfully', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(mockFn, 'arg1', 'arg2');

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    test('should open circuit after threshold failures', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('failure'));

      // Trigger failures
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getStatus().state).toBe('OPEN');
    });

    test('should reject requests when circuit is open', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('failure'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }

      // Next request should be rejected immediately
      await expect(circuitBreaker.execute(mockFn))
        .rejects.toThrow('Circuit breaker is OPEN');
    });

    test('should transition to half-open after timeout', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockRejectedValueOnce(new Error('failure'))
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValue('success');

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should transition to half-open and allow next request
      const result = await circuitBreaker.execute(mockFn);
      expect(result).toBe('success');
    });

    test('should reset circuit breaker', () => {
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getStatus().state).toBe('OPEN');

      circuitBreaker.reset();
      expect(circuitBreaker.getStatus().state).toBe('CLOSED');
    });
  });

  describe('EmailQueue', () => {
    let emailQueue;

    beforeEach(() => {
      emailQueue = new EmailQueue({
        maxRetries: 2,
        retryDelay: 100,
        processInterval: 50
      });
    });

    afterEach(() => {
      emailQueue.stopProcessing();
      emailQueue.clear();
    });

    test('should add job to queue', () => {
      const jobData = {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test Body'
      };

      const jobId = emailQueue.add(jobData);

      expect(jobId).toBeDefined();
      expect(emailQueue.getStats().queued).toBe(1);
    });

    test('should process jobs with processor', async () => {
      const processor = jest.fn().mockResolvedValue({ success: true });
      emailQueue.process(processor);

      const jobData = { test: 'data' };
      const jobId = emailQueue.add(jobData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(processor).toHaveBeenCalledWith(jobData);
      
      const job = emailQueue.getJob(jobId);
      expect(job.status).toBe('completed');
    });

    test('should retry failed jobs', async () => {
      const processor = jest.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValue({ success: true });

      emailQueue.process(processor);

      const jobData = { test: 'data' };
      const jobId = emailQueue.add(jobData);

      // Wait for processing and retry
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(processor).toHaveBeenCalledTimes(2);
      
      const job = emailQueue.getJob(jobId);
      expect(job.status).toBe('completed');
    });

    test('should handle job priority', () => {
      const lowPriorityJob = emailQueue.add({ data: 'low' }, { priority: 1 });
      const highPriorityJob = emailQueue.add({ data: 'high' }, { priority: 5 });

      const stats = emailQueue.getStats();
      expect(stats.queued).toBe(2);

      // High priority job should be first in queue
      const nextJob = emailQueue._getNextJob();
      expect(nextJob.data.data).toBe('high');
    });

    test('should get queue statistics', () => {
      emailQueue.add({ test: 'data1' });
      emailQueue.add({ test: 'data2' });

      const stats = emailQueue.getStats();

      expect(stats.queued).toBe(2);
      expect(stats.processing).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });
});
