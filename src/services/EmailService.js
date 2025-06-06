const providerFactory = require('../providers/ProviderFactory');
const logger = require('../utils/Logger');
const idempotencyManager = require('../utils/IdempotencyManager');
const RateLimiter = require('./RateLimiter');
const { CircuitBreakerManager } = require('./CircuitBreaker');
const EmailQueue = require('./EmailQueue');

/**
 * Resilient Email Service
 * Main service that orchestrates email sending with retry logic, fallback, and resilience patterns
 */
class EmailService {
  constructor(config = {}) {
    this.config = {
      maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
      initialRetryDelay: parseInt(process.env.INITIAL_RETRY_DELAY) || 1000, // 1 second
      maxRetryDelay: parseInt(process.env.MAX_RETRY_DELAY) || 30000, // 30 seconds
      retryMultiplier: parseFloat(process.env.RETRY_MULTIPLIER) || 2,
      enableCircuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER !== 'false',
      enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
      enableQueue: process.env.ENABLE_QUEUE !== 'false',
      ...config
    };

    // Initialize services
    this.rateLimiter = new RateLimiter();
    this.emailQueue = new EmailQueue();
    
    // Setup queue processor if enabled
    if (this.config.enableQueue) {
      this.emailQueue.process(this._processEmailJob.bind(this));
    }

    logger.info('EmailService initialized', { config: this.config });
  }

  /**
   * Send an email with full resilience features
   * @param {Object} emailData - Email data
   * @param {Object} options - Sending options
   * @returns {Promise<Object>} - Send result
   */
  async sendEmail(emailData, options = {}) {
    const { 
      to, 
      subject, 
      body, 
      idempotencyKey, 
      priority = 0,
      delay = 0
    } = emailData;

    // Validate required fields
    this._validateEmailData({ to, subject, body, idempotencyKey });

    // Check idempotency
    const existingResult = idempotencyManager.get(idempotencyKey);
    if (existingResult) {
      if (existingResult.status === 'pending') {
        return {
          success: false,
          status: 'pending',
          message: 'Email is already being processed',
          idempotencyKey
        };
      }
      
      logger.info('Returning cached result for idempotent request', { idempotencyKey });
      return existingResult.result;
    }

    // Mark as pending
    idempotencyManager.markAsPending(idempotencyKey, { 
      to, 
      subject, 
      startedAt: new Date().toISOString() 
    });

    try {
      let result;

      if (this.config.enableQueue) {
        // Add to queue for async processing
        const jobId = this.emailQueue.add({
          to,
          subject,
          body,
          idempotencyKey,
          priority,
          delay
        });

        result = {
          success: true,
          status: 'queued',
          jobId,
          idempotencyKey,
          message: 'Email queued for processing'
        };
      } else {
        // Process immediately
        result = await this._processEmailDirectly({ to, subject, body, idempotencyKey });
      }

      // Mark as completed
      idempotencyManager.markAsCompleted(idempotencyKey, result);
      return result;

    } catch (error) {
      logger.error('Email sending failed', { 
        idempotencyKey, 
        error: error.message 
      });

      const errorResult = {
        success: false,
        status: 'failed',
        error: error.message,
        code: error.code,
        idempotencyKey
      };

      idempotencyManager.markAsFailed(idempotencyKey, error);
      return errorResult;
    }
  }

  /**
   * Process email job (used by queue)
   * @param {Object} jobData - Job data
   * @returns {Promise<Object>} - Processing result
   * @private
   */
  async _processEmailJob(jobData) {
    const { to, subject, body, idempotencyKey } = jobData;
    
    logger.debug('Processing email job', { idempotencyKey });
    
    try {
      const result = await this._processEmailDirectly({ to, subject, body, idempotencyKey });
      
      // Update idempotency cache with final result
      idempotencyManager.markAsCompleted(idempotencyKey, result);
      
      return result;
    } catch (error) {
      // Update idempotency cache with error
      idempotencyManager.markAsFailed(idempotencyKey, error);
      throw error;
    }
  }

  /**
   * Process email directly (without queue)
   * @param {Object} emailData - Email data
   * @returns {Promise<Object>} - Send result
   * @private
   */
  async _processEmailDirectly(emailData) {
    const { idempotencyKey } = emailData;
    const providers = ['primary', 'secondary'];
    let lastError;

    for (const providerName of providers) {
      try {
        logger.debug('Attempting to send email', { 
          provider: providerName, 
          idempotencyKey 
        });

        const result = await this._sendWithProvider(providerName, emailData);
        
        logger.info('Email sent successfully', { 
          provider: providerName, 
          idempotencyKey,
          messageId: result.messageId
        });

        return {
          success: true,
          status: 'sent',
          provider: providerName,
          messageId: result.messageId,
          timestamp: result.timestamp,
          idempotencyKey
        };

      } catch (error) {
        lastError = error;
        
        const isLastProvider = providers.indexOf(providerName) === providers.length - 1;
        
        logger.warn('Provider failed, analyzing next steps', { 
          provider: providerName, 
          idempotencyKey,
          error: error.message,
          retryable: error.retryable,
          code: error.code,
          isLastProvider,
          remainingProviders: providers.slice(providers.indexOf(providerName) + 1)
        });

        // Only break for errors that are truly non-retryable across ALL providers
        // Allow fallback for provider-specific errors like validation differences
        if (error.retryable === false && this._isGloballyNonRetryable(error)) {
          logger.warn('Error is globally non-retryable, skipping remaining providers', {
            provider: providerName,
            idempotencyKey,
            error: error.message,
            code: error.code
          });
          break;
        }

        // Log provider switch if there are more providers to try
        if (!isLastProvider) {
          const nextProvider = providers[providers.indexOf(providerName) + 1];
          logger.info('Switching to fallback provider', {
            fromProvider: providerName,
            toProvider: nextProvider,
            reason: error.message,
            idempotencyKey
          });
          
          // Update idempotency manager with provider switch info
          try {
            idempotencyManager.update(idempotencyKey, {
              providerSwitch: {
                from: providerName,
                to: nextProvider,
                reason: error.message,
                switchedAt: new Date().toISOString()
              }
            });
          } catch (updateError) {
            logger.debug('Could not update provider switch info', { idempotencyKey });
          }
        }
      }
    }

    // All providers failed
    throw lastError || new Error('All email providers failed');
  }

  /**
   * Send email with a specific provider (with retry logic)
   * @param {string} providerName - Provider name
   * @param {Object} emailData - Email data
   * @returns {Promise<Object>} - Send result
   * @private
   */
  async _sendWithProvider(providerName, emailData) {
    const provider = providerFactory.getProvider(providerName);
    const { idempotencyKey } = emailData;

    // Get circuit breaker for this provider
    let circuitBreaker = null;
    if (this.config.enableCircuitBreaker) {
      circuitBreaker = CircuitBreakerManager.getBreaker(providerName);
    }

    // Retry logic with exponential backoff
    let attempt = 0;
    let delay = this.config.initialRetryDelay;

    while (attempt < this.config.maxRetries) {
      attempt++;

      // Update attempts counter in idempotency manager
      try {
        const currentAttempts = idempotencyManager.incrementAttempts(idempotencyKey);
        
        // Also update with current provider attempt details
        idempotencyManager.update(idempotencyKey, {
          currentProvider: providerName,
          currentAttempt: attempt,
          maxRetries: this.config.maxRetries,
          lastAttemptAt: new Date().toISOString()
        });
      } catch (error) {
        // Idempotency key might not exist if this is a direct call
        logger.debug('Could not increment attempts counter', { idempotencyKey, error: error.message });
      }

      try {
        logger.debug('Sending email attempt', { 
          provider: providerName, 
          attempt, 
          maxRetries: this.config.maxRetries,
          idempotencyKey 
        });

        let result;
        
        if (circuitBreaker) {
          // Use circuit breaker
          result = await circuitBreaker.execute(
            provider.sendEmail.bind(provider), 
            emailData
          );
        } else {
          // Direct call
          result = await provider.sendEmail(emailData);
        }

        return result;

      } catch (error) {
        logger.error('Email sending attempt failed', { 
          provider: providerName, 
          attempt, 
          maxRetries: this.config.maxRetries,
          error: error.message,
          code: error.code,
          retryable: error.retryable,
          idempotencyKey,
          willRetry: attempt < this.config.maxRetries && error.retryable !== false
        });

        // Check if we should retry
        if (attempt >= this.config.maxRetries || error.retryable === false) {
          // Log final failure
          logger.error('All retry attempts exhausted for provider', {
            provider: providerName,
            totalAttempts: attempt,
            maxRetries: this.config.maxRetries,
            finalError: error.message,
            idempotencyKey
          });
          throw error;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.config.maxRetries) {
          const actualDelay = error.retryAfter ? error.retryAfter * 1000 : delay;
          
          logger.info('Retrying email send after delay', { 
            provider: providerName, 
            attempt, 
            nextAttempt: attempt + 1,
            maxRetries: this.config.maxRetries,
            delay: actualDelay,
            retryReason: error.message,
            idempotencyKey 
          });

          await this._sleep(actualDelay);
          delay = Math.min(delay * this.config.retryMultiplier, this.config.maxRetryDelay);
        }
      }
    }
  }

  /**
   * Get email status
   * @param {string} idempotencyKey - Request ID
   * @returns {Object} - Status information
   */
  getEmailStatus(idempotencyKey) {
    const idempotencyEntry = idempotencyManager.get(idempotencyKey);
    
    if (!idempotencyEntry) {
      return {
        found: false,
        message: 'Email not found'
      };
    }

    // Determine the current actual status
    let currentStatus = idempotencyEntry.status;
    let error = null;
    let messageId = null;
    let provider = null;
    let attempts = idempotencyEntry.attempts || 0;
    let lastAttemptAt = idempotencyEntry.lastAttemptAt;

    // If email was queued, check job status for more current information
    if (idempotencyEntry.result && idempotencyEntry.result.jobId) {
      const job = this.emailQueue.getJob(idempotencyEntry.result.jobId);
      if (job) {
        // Job status takes precedence for queued emails
        currentStatus = job.status;
        attempts = Math.max(attempts, job.attempts || 0);
        
        if (job.status === 'completed' && job.result) {
          currentStatus = 'sent';
          messageId = job.result.messageId;
          provider = job.result.provider;
        } else if (job.status === 'failed' && job.error) {
          currentStatus = 'failed';
          error = {
            message: job.error.message,
            code: job.error.code
          };
        } else if (job.status === 'processing') {
          currentStatus = 'processing';
        } else if (job.status === 'retrying') {
          currentStatus = 'retrying';
        }
        // 'queued' status remains as is
        
        if (job.startedAt) {
          lastAttemptAt = job.startedAt;
        }
      }
    } else {
      // Handle direct processing results
      if (idempotencyEntry.status === 'completed' && idempotencyEntry.result) {
        if (idempotencyEntry.result.success) {
          currentStatus = 'sent';
          messageId = idempotencyEntry.result.messageId;
          provider = idempotencyEntry.result.provider;
        }
      } else if (idempotencyEntry.status === 'failed' && idempotencyEntry.result && idempotencyEntry.result.error) {
        currentStatus = 'failed';
        error = {
          message: idempotencyEntry.result.error.message,
          code: idempotencyEntry.result.error.code
        };
      }
    }

    // Return consistent, simple status structure
    const response = {
      found: true,
      status: currentStatus,
      idempotencyKey,
      attempts,
      createdAt: idempotencyEntry.createdAt,
      lastAttemptAt,
      updatedAt: idempotencyEntry.updatedAt
    };

    // Add optional fields only if they exist
    if (messageId) response.messageId = messageId;
    if (provider) response.provider = provider;
    if (error) response.error = error;

    return response;
  }

  /**
   * Get service health status
   * @returns {Promise<Object>} - Health status
   */
  async getHealthStatus() {
    const providersHealth = await providerFactory.checkAllProvidersHealth();
    const circuitBreakersStatus = CircuitBreakerManager.getAllStatus();
    const queueStats = this.emailQueue.getStats();
    const rateLimiterStats = this.rateLimiter.getStats();
    const idempotencyStats = idempotencyManager.getStats();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      providers: providersHealth,
      circuitBreakers: circuitBreakersStatus,
      queue: queueStats,
      rateLimiter: rateLimiterStats,
      idempotency: idempotencyStats,
      config: this.config
    };
  }

  /**
   * Get queue status
   * @returns {Object} - Queue status
   */
  getQueueStatus() {
    return this.emailQueue.getStats();
  }

  /**
   * Validate email data
   * @param {Object} emailData - Email data to validate
   * @private
   */
  _validateEmailData({ to, subject, body, idempotencyKey }) {
    if (!to) {
      throw new Error('Email recipient (to) is required');
    }
    
    if (!subject) {
      throw new Error('Email subject is required');
    }
    
    if (!body) {
      throw new Error('Email body is required');
    }
    
    if (!idempotencyKey) {
      throw new Error('Idempotency key is required');
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      throw new Error('Invalid email address format');
    }
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get rate limiter middleware
   * @returns {Function} - Express middleware
   */
  getRateLimiterMiddleware() {
    return this.rateLimiter.middleware();
  }

  /**
   * Clear idempotency cache
   */
  clearIdempotencyCache() {
    idempotencyManager.clear();
    logger.info('Idempotency cache cleared');
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.emailQueue.stopProcessing();
    logger.info('EmailService cleanup completed');
  }

  /**
   * Determine if an error should prevent fallback to other providers
   * Only truly global errors (not provider-specific validation differences) should prevent fallback
   * @param {Error} error - The error to check
   * @returns {boolean} - True if error is globally non-retryable
   * @private
   */
  _isGloballyNonRetryable(error) {
    // Define error codes that are truly global and shouldn't be retried with any provider
    const globallyNonRetryableErrors = [
      'MALFORMED_EMAIL_DATA',     // Completely invalid request structure
      'AUTHENTICATION_FAILED',    // Our credentials are invalid (affects all providers)
      'QUOTA_EXCEEDED',          // Account-level quota exceeded
      'SERVICE_SUSPENDED'        // Service account suspended
    ];

    // Provider-specific errors that might succeed with another provider should allow fallback
    const providerSpecificErrors = [
      'INVALID_EMAIL',           // Different providers have different validation rules
      'CONTENT_REJECTED',        // Different providers have different content policies
      'DOMAIN_BLOCKED',          // Different providers may have different blocked domains
      'RECIPIENT_REJECTED'       // Different providers may have different recipient rules
    ];

    // If it's a known provider-specific error, allow fallback
    if (providerSpecificErrors.includes(error.code)) {
      return false;
    }

    // If it's a known globally non-retryable error, prevent fallback
    if (globallyNonRetryableErrors.includes(error.code)) {
      return true;
    }

    // For unknown error codes, be conservative and allow fallback
    // This ensures new provider-specific errors don't break fallback
    return false;
  }
}

module.exports = EmailService;
