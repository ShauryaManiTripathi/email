const request = require('supertest');
const app = require('../../src/server');

describe('Email API Integration Tests', () => {
  beforeEach(() => {
    // Clear any existing state before each test
    jest.clearAllMocks();
  });

  describe('POST /api/email/send', () => {
    test('should send email successfully', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        body: 'This is a test email',
        idempotencyKey: 'test-integration-1'
      };

      const response = await request(app)
        .post('/api/email/send')
        .send(emailData)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.idempotencyKey).toBe(emailData.idempotencyKey);
      expect(response.body.messageId || response.body.jobId).toBeDefined();
    });

    test('should return 400 for missing required fields', async () => {
      const invalidData = {
        to: 'test@example.com',
        subject: 'Test Email'
        // missing body and idempotencyKey
      };

      const response = await request(app)
        .post('/api/email/send')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.details).toContain('Field "body" is required');
      expect(response.body.details).toContain('Field "idempotencyKey" is required');
    });

    test('should return 400 for invalid email address', async () => {
      const invalidData = {
        to: 'invalid-email',
        subject: 'Test Email',
        body: 'Test body',
        idempotencyKey: 'test-integration-2'
      };

      const response = await request(app)
        .post('/api/email/send')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.details).toContain('Field "to" must be a valid email address');
    });

    test('should handle idempotent requests', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        body: 'This is a test email',
        idempotencyKey: 'test-integration-3'
      };

      // Send first request
      const response1 = await request(app)
        .post('/api/email/send')
        .send(emailData)
        .expect(202);

      // Send same request again
      const response2 = await request(app)
        .post('/api/email/send')
        .send(emailData);

      expect(response1.body.idempotencyKey).toBe(response2.body.idempotencyKey);
    });

    test('should validate priority field', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        body: 'Test body',
        idempotencyKey: 'test-integration-4',
        priority: 15 // Invalid priority (> 10)
      };

      const response = await request(app)
        .post('/api/email/send')
        .send(emailData)
        .expect(400);

      expect(response.body.details).toContain('Field "priority" must be a number between 0 and 10');
    });

    test('should validate delay field', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        body: 'Test body',
        idempotencyKey: 'test-integration-5',
        delay: 400000 // Invalid delay (> 5 minutes)
      };

      const response = await request(app)
        .post('/api/email/send')
        .send(emailData)
        .expect(400);

      expect(response.body.details).toContain('Field "delay" must be a number between 0 and 300000 (5 minutes)');
    });
  });

  describe('GET /api/email/status/:idempotencyKey', () => {
    test('should return email status', async () => {
      // First send an email
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        body: 'Test body',
        idempotencyKey: 'test-status-1'
      };

      await request(app)
        .post('/api/email/send')
        .send(emailData)
        .expect(202);

      // Then check status
      const response = await request(app)
        .get('/api/email/status/test-status-1')
        .expect(200);

      expect(response.body.found).toBe(true);
      expect(response.body.idempotencyKey).toBe('test-status-1');
      expect(response.body.status).toBeDefined();
    });

    test('should return 404 for unknown email', async () => {
      const response = await request(app)
        .get('/api/email/status/unknown-key')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Email not found');
    });

    test('should return 400 for missing idempotency key', async () => {
      const response = await request(app)
        .get('/api/email/status/')
        .expect(404); // Express returns 404 for missing path parameter
    });
  });

  describe('POST /api/email/bulk-send', () => {
    test('should send multiple emails', async () => {
      const bulkData = {
        emails: [
          {
            to: 'test1@example.com',
            subject: 'Test Email 1',
            body: 'Test body 1',
            idempotencyKey: 'bulk-test-1'
          },
          {
            to: 'test2@example.com',
            subject: 'Test Email 2',
            body: 'Test body 2',
            idempotencyKey: 'bulk-test-2'
          }
        ]
      };

      const response = await request(app)
        .post('/api/email/bulk-send')
        .send(bulkData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.processed).toBe(2);
      expect(response.body.failed).toBe(0);
      expect(response.body.results).toHaveLength(2);
    });

    test('should return 400 for empty emails array', async () => {
      const bulkData = {
        emails: []
      };

      const response = await request(app)
        .post('/api/email/bulk-send')
        .send(bulkData)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Field "emails" must be a non-empty array');
    });

    test('should return 400 for too many emails', async () => {
      const emails = Array(101).fill().map((_, i) => ({
        to: `test${i}@example.com`,
        subject: `Test ${i}`,
        body: `Body ${i}`,
        idempotencyKey: `bulk-${i}`
      }));

      const response = await request(app)
        .post('/api/email/bulk-send')
        .send({ emails })
        .expect(400);

      expect(response.body.message).toBe('Maximum 100 emails allowed per bulk request');
    });

    test('should handle partial failures in bulk send', async () => {
      const bulkData = {
        emails: [
          {
            to: 'test1@example.com',
            subject: 'Test Email 1',
            body: 'Test body 1',
            idempotencyKey: 'bulk-partial-1'
          },
          {
            to: 'invalid-email', // This will fail validation
            subject: 'Test Email 2',
            body: 'Test body 2',
            idempotencyKey: 'bulk-partial-2'
          }
        ]
      };

      const response = await request(app)
        .post('/api/email/bulk-send')
        .send(bulkData)
        .expect(207); // Multi-Status

      expect(response.body.processed).toBe(1);
      expect(response.body.failed).toBe(1);
      expect(response.body.errors).toHaveLength(1);
    });
  });

  describe('GET /health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/health');

      // Health can be either 200 (healthy) or 503 (unhealthy) depending on providers
      expect([200, 503]).toContain(response.status);
      expect(response.body.status).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
      expect(response.body.providers).toBeDefined();
    });
  });

  describe('GET /health/detailed', () => {
    test('should return detailed health status', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.providers).toBeDefined();
      expect(response.body.circuitBreakers).toBeDefined();
      expect(response.body.queue).toBeDefined();
      expect(response.body.rateLimiter).toBeDefined();
    });
  });

  describe('GET /providers/stats', () => {
    test('should return provider statistics', async () => {
      const response = await request(app)
        .get('/providers/stats')
        .expect(200);

      expect(response.body.providers).toBeDefined();
      expect(response.body.providers).toHaveLength(2);
      expect(response.body.providers[0].name).toBeDefined();
      expect(response.body.providers[1].name).toBeDefined();
    });
  });

  describe('GET /circuit-breakers', () => {
    test('should return circuit breaker status', async () => {
      const response = await request(app)
        .get('/circuit-breakers')
        .expect(200);

      expect(response.body.circuitBreakers).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('POST /circuit-breakers/reset', () => {
    test('should reset all circuit breakers', async () => {
      const response = await request(app)
        .post('/circuit-breakers/reset')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('All circuit breakers have been reset');
    });

    test('should reset specific circuit breaker', async () => {
      const response = await request(app)
        .post('/circuit-breakers/reset')
        .send({ provider: 'primary' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Circuit breaker for primary has been reset');
    });
  });

  describe('GET /', () => {
    test('should return service information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body.service).toBe('Resilient Email Service');
      expect(response.body.status).toBe('running');
      expect(response.body.endpoints).toBeDefined();
    });
  });

  describe('404 handling', () => {
    test('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toContain('Route GET /unknown-route not found');
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        body: 'Test body',
        idempotencyKey: 'rate-limit-test'
      };

      // Make multiple requests quickly (this depends on rate limit config)
      const requests = Array(10).fill().map((_, i) => {
        return request(app)
          .post('/api/email/send')
          .send({
            ...emailData,
            idempotencyKey: `rate-limit-test-${i}`
          });
      });

      const responses = await Promise.all(requests);

      // Check if rate limiting headers are present
      const firstResponse = responses[0];
      expect(firstResponse.headers['x-ratelimit-limit']).toBeDefined();
      expect(firstResponse.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });
});
