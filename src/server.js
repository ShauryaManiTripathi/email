// Load environment variables first
require('dotenv').config();

// Debug environment variables
console.log('Environment Variables Loaded:');
console.log('PORT:', process.env.PORT);
console.log('PRIMARY_SUCCESS_RATE:', process.env.PRIMARY_SUCCESS_RATE);
console.log('SECONDARY_SUCCESS_RATE:', process.env.SECONDARY_SUCCESS_RATE);
console.log('MAX_RETRIES:', process.env.MAX_RETRIES);
console.log('NODE_ENV:', process.env.NODE_ENV);

const express = require('express');
const cors = require('cors');
const emailRoutes = require('./routes/emailRoutes');
const providerFactory = require('./providers/ProviderFactory');
const { CircuitBreakerManager } = require('./services/CircuitBreaker');
const { errorHandler, requestLogger } = require('./middleware/validation');
const logger = require('./utils/Logger');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // In production with Nginx, requests come from the same origin, so no CORS needed
    if (process.env.NODE_ENV === 'production') {
      // In production, Nginx serves both frontend and backend on same domain
      // So either no origin header (same-origin) or the production domain
      if (!origin || origin === 'https://demo-email.shaurya.codes') {
        callback(null, true);
      } else {
        callback(null, true); // Allow all in production since Nginx filters
      }
    } else {
      // Development mode
      const allowedOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000'
      ];
      
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Idempotency-Key'],
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const providersHealth = await providerFactory.checkAllProvidersHealth();
    const circuitBreakersStatus = CircuitBreakerManager.getAllStatus();
    
    const allProvidersHealthy = Object.values(providersHealth).every(p => p.healthy);
    const anyCircuitBreakerOpen = Object.values(circuitBreakersStatus).some(cb => cb.state === 'OPEN');
    
    const overallHealth = allProvidersHealthy && !anyCircuitBreakerOpen ? 'healthy' : 'degraded';
    
    const healthStatus = {
      status: overallHealth,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      providers: providersHealth,
      circuitBreakers: circuitBreakersStatus,
      version: process.env.npm_package_version || '1.0.0'
    };

    const statusCode = overallHealth === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Detailed health endpoint
app.get('/health/detailed', async (req, res) => {
  try {
    const { getEmailServiceInstance } = require('./services/EmailServiceInstance');
    const emailService = getEmailServiceInstance();
    
    const detailedHealth = await emailService.getHealthStatus();
    res.json(detailedHealth);
    
  } catch (error) {
    logger.error('Detailed health check failed', { error: error.message });
    
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Provider stats endpoint
app.get('/providers/stats', async (req, res) => {
  try {
    const stats = providerFactory.getProvidersStats();
    const health = await providerFactory.checkAllProvidersHealth();
    
    res.json({
      timestamp: new Date().toISOString(),
      providers: Object.keys(stats).map(name => ({
        name,
        ...stats[name],
        ...health[name]
      }))
    });
    
  } catch (error) {
    logger.error('Provider stats failed', { error: error.message });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Circuit breaker status endpoint
app.get('/circuit-breakers', (req, res) => {
  try {
    const status = CircuitBreakerManager.getAllStatus();
    res.json({
      timestamp: new Date().toISOString(),
      circuitBreakers: status
    });
    
  } catch (error) {
    logger.error('Circuit breaker status failed', { error: error.message });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Reset circuit breaker endpoint
app.post('/circuit-breakers/reset', (req, res) => {
  try {
    const { provider } = req.body;
    
    if (provider) {
      const breaker = CircuitBreakerManager.getBreaker(provider);
      breaker.reset();
      logger.info('Circuit breaker reset', { provider });
      
      res.json({
        success: true,
        message: `Circuit breaker for ${provider} has been reset`
      });
    } else {
      CircuitBreakerManager.resetAll();
      logger.info('All circuit breakers reset');
      
      res.json({
        success: true,
        message: 'All circuit breakers have been reset'
      });
    }
    
  } catch (error) {
    logger.error('Circuit breaker reset failed', { error: error.message });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const { getEmailServiceInstance } = require('./services/EmailServiceInstance');
    const emailService = getEmailServiceInstance();
    
    const providerStats = providerFactory.getProvidersStats();
    const circuitBreakerStats = CircuitBreakerManager.getAllStatus();
    const memoryUsage = process.memoryUsage();
    
    // Basic metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      providers: providerStats,
      circuitBreakers: circuitBreakerStats,
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid
      }
    };
    
    res.json(metrics);
    
  } catch (error) {
    logger.error('Metrics endpoint failed', { error: error.message });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Admin endpoints
app.post('/admin/idempotency/clear', (req, res) => {
  try {
    const EmailService = require('./services/EmailService');
    const emailService = new EmailService();
    
    // Clear idempotency cache
    emailService.clearIdempotencyCache();
    
    logger.info('Idempotency cache cleared');
    
    res.json({
      success: true,
      message: 'Idempotency cache has been cleared',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Clear idempotency cache failed', { error: error.message });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// API routes
app.use('/api/email', emailRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Resilient Email Service',
    version: process.env.npm_package_version || '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      detailedHealth: '/health/detailed',
      sendEmail: 'POST /api/email/send',
      emailStatus: 'GET /api/email/status/:idempotencyKey',
      bulkSend: 'POST /api/email/bulk-send',
      resend: 'POST /api/email/resend/:idempotencyKey',
      providers: '/providers/stats',
      circuitBreakers: '/circuit-breakers'
    },
    documentation: 'https://github.com/your-repo/resilient-email-service'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info('Resilient Email Service started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid
  });
  
  // Log configuration
  logger.info('Service configuration', {
    maxRetries: process.env.MAX_RETRIES || 3,
    rateLimitWindow: process.env.RATE_LIMIT_WINDOW || 60000,
    rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
    circuitBreakerThreshold: process.env.CIRCUIT_BREAKER_THRESHOLD || 5,
    circuitBreakerTimeout: process.env.CIRCUIT_BREAKER_TIMEOUT || 30000
  });
});

module.exports = app;
