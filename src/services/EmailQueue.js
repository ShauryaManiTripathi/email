const logger = require('../utils/Logger');

/**
 * Simple Email Queue System
 * In production, this would be replaced with Redis Queue, Bull, or similar
 */
class EmailQueue {
  constructor(config = {}) {
    this.config = {
      maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.QUEUE_RETRY_DELAY) || 5000, // 5 seconds
      maxConcurrency: parseInt(process.env.QUEUE_MAX_CONCURRENCY) || 5,
      processInterval: parseInt(process.env.QUEUE_PROCESS_INTERVAL) || 1000, // 1 second
      jobTimeout: parseInt(process.env.QUEUE_JOB_TIMEOUT) || 90000, // 90 seconds (allow for provider fallback)
      stuckJobCleanupInterval: parseInt(process.env.QUEUE_STUCK_JOB_CLEANUP_INTERVAL) || 60000, // 1 minute
      ...config
    };

    this.queue = [];
    this.processing = new Map(); // Currently processing jobs
    this.completed = [];
    this.failed = [];
    this.isProcessing = false;
    this.activeJobs = 0;

    logger.info('Email queue initialized', { config: this.config });
    
    // Start periodic cleanup for stuck jobs
    this._startStuckJobCleanup();
  }

  /**
   * Add a job to the queue
   * @param {Object} jobData - Job data
   * @param {Object} options - Job options (priority, delay)
   * @returns {string} - Job ID
   */
  add(jobData, options = {}) {
    const job = {
      id: this._generateJobId(),
      data: jobData,
      attempts: 0,
      maxRetries: this.config.maxRetries,
      createdAt: new Date().toISOString(),
      status: 'queued',
      priority: options.priority || jobData.priority || 0, // Higher number = higher priority
      delay: options.delay || jobData.delay || 0 // Delay in milliseconds
    };

    // Add delay if specified
    if (job.delay > 0) {
      job.executeAfter = Date.now() + job.delay;
    }

    // Insert job in priority order
    this._insertByPriority(job);

    logger.debug('Job added to queue', { 
      jobId: job.id, 
      priority: job.priority,
      delay: job.delay,
      queueSize: this.queue.length 
    });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }

    return job.id;
  }

  /**
   * Insert job into queue maintaining priority order
   * @param {Object} job - Job to insert
   * @private
   */
  _insertByPriority(job) {
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      if (job.priority > this.queue[i].priority) {
        this.queue.splice(i, 0, job);
        inserted = true;
        break;
      }
    }
    
    if (!inserted) {
      this.queue.push(job);
    }
  }

  /**
   * Get the next job to process
   * @returns {Object|null} - Next job or null if none available
   * @private
   */
  _getNextJob() {
    const now = Date.now();
    
    // Find the highest priority job that's ready to execute
    let bestJobIndex = -1;
    let bestPriority = -1;
    
    for (let i = 0; i < this.queue.length; i++) {
      const job = this.queue[i];
      
      // Check if job is ready to execute (no delay or delay has passed)
      if ((!job.executeAfter || now >= job.executeAfter) && job.priority > bestPriority) {
        bestJobIndex = i;
        bestPriority = job.priority;
      }
    }
    
    if (bestJobIndex >= 0) {
      return this.queue.splice(bestJobIndex, 1)[0];
    }
    
    return null;
  }

  /**
   * Process jobs in the queue
   * @param {Function} processor - Function to process jobs
   */
  async process(processor) {
    this.processor = processor;
    
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  /**
   * Start processing jobs
   */
  startProcessing() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    logger.info('Queue processing started');

    this.processingInterval = setInterval(async () => {
      await this._processJobs();
    }, this.config.processInterval);
  }

  /**
   * Stop processing jobs
   */
  stopProcessing() {
    if (!this.isProcessing) {
      return;
    }

    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    logger.info('Queue processing stopped');
  }

  /**
   * Process jobs from the queue
   * @private
   */
  async _processJobs() {
    if (!this.processor) {
      return;
    }

    // Don't exceed max concurrency
    while (this.activeJobs < this.config.maxConcurrency) {
      const job = this._getNextJob();
      
      if (!job) {
        break; // No jobs available
      }

      this.activeJobs++;
      this.processing.set(job.id, job);
      
      // Process job with timeout and proper error handling
      this._processJobWithTimeout(job)
        .then(() => {
          // Job completed or failed, cleanup handled in _processJob
        })
        .catch((error) => {
          // Handle any uncaught errors
          logger.error('Uncaught error in job processing', { 
            jobId: job.id, 
            error: error.message 
          });
          
          // Force job to failed state if it's still processing
          if (job.status === 'processing') {
            job.status = 'failed';
            job.failedAt = new Date().toISOString();
            job.error = {
              message: error.message || 'Unknown processing error',
              code: 'PROCESSING_TIMEOUT',
              stack: error.stack
            };
            this.failed.push(job);
          }
        })
        .finally(() => {
          // Always cleanup
          this.activeJobs--;
          this.processing.delete(job.id);
        });
    }
  }

  /**
   * Process a single job with timeout
   * @param {Object} job - Job to process
   * @private
   */
  async _processJobWithTimeout(job) {
    const timeoutMs = this.config.jobTimeout; // Use configured timeout
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Job ${job.id} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    try {
      // Race between job processing and timeout
      await Promise.race([
        this._processJob(job),
        timeoutPromise
      ]);
    } catch (error) {
      // Re-throw to be handled by caller
      throw error;
    }
  }

  /**
   * Process a single job
   * @param {Object} job - Job to process
   * @private
   */
  async _processJob(job) {
    job.attempts++;
    job.status = 'processing';
    job.startedAt = new Date().toISOString();

    logger.debug('Processing job', { 
      jobId: job.id, 
      attempts: job.attempts, 
      maxRetries: job.maxRetries 
    });

    try {
      const result = await this.processor(job.data);
      
      // Job completed successfully
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.result = result;
      
      this.completed.push(job);
      
      logger.debug('Job completed', { 
        jobId: job.id, 
        attempts: job.attempts 
      });
      
    } catch (error) {
      logger.error('Job failed', { 
        jobId: job.id, 
        attempts: job.attempts, 
        error: error.message 
      });

      // Check if we should retry
      if (job.attempts < job.maxRetries && error.retryable !== false) {
        // Add back to queue with delay
        job.status = 'retrying';
        job.executeAfter = Date.now() + (this.config.retryDelay * job.attempts); // Exponential backoff
        
        this._insertByPriority(job);
        
        logger.debug('Job scheduled for retry', { 
          jobId: job.id, 
          attempts: job.attempts,
          retryAfter: new Date(job.executeAfter).toISOString()
        });
        
      } else {
        // Job failed permanently
        job.status = 'failed';
        job.failedAt = new Date().toISOString();
        job.error = {
          message: error.message,
          code: error.code,
          stack: error.stack
        };
        
        this.failed.push(job);
        
        logger.error('Job failed permanently', { 
          jobId: job.id, 
          attempts: job.attempts,
          error: error.message
        });
      }
    }
  }

  /**
   * Get job by ID
   * @param {string} jobId - Job ID
   * @returns {Object|null} - Job or null if not found
   */
  getJob(jobId) {
    // Check processing jobs
    if (this.processing.has(jobId)) {
      return this.processing.get(jobId);
    }

    // Check queued jobs
    const queuedJob = this.queue.find(job => job.id === jobId);
    if (queuedJob) {
      return queuedJob;
    }

    // Check completed jobs
    const completedJob = this.completed.find(job => job.id === jobId);
    if (completedJob) {
      return completedJob;
    }

    // Check failed jobs
    const failedJob = this.failed.find(job => job.id === jobId);
    if (failedJob) {
      return failedJob;
    }

    return null;
  }

  /**
   * Get queue statistics
   * @returns {Object} - Queue statistics
   */
  getStats() {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.length,
      failed: this.failed.length,
      activeJobs: this.activeJobs,
      isProcessing: this.isProcessing,
      config: this.config
    };
  }

  /**
   * Clear completed and failed jobs
   * @param {Object} options - Cleanup options
   */
  cleanup(options = {}) {
    const { maxAge = 86400000, keepCount = 100 } = options; // 24 hours, keep 100 jobs
    const cutoffTime = Date.now() - maxAge;

    // Clean completed jobs
    this.completed = this.completed
      .filter(job => new Date(job.completedAt).getTime() > cutoffTime)
      .slice(-keepCount);

    // Clean failed jobs
    this.failed = this.failed
      .filter(job => new Date(job.failedAt).getTime() > cutoffTime)
      .slice(-keepCount);

    logger.debug('Queue cleanup completed', { 
      completed: this.completed.length,
      failed: this.failed.length
    });
  }

  /**
   * Generate unique job ID
   * @returns {string} - Job ID
   * @private
   */
  _generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all jobs (useful for testing)
   */
  clear() {
    this.queue = [];
    this.processing.clear();
    this.completed = [];
    this.failed = [];
    logger.debug('Queue cleared');
  }

  /**
   * Pause queue processing
   */
  pause() {
    this.stopProcessing();
    logger.info('Queue paused');
  }

  /**
   * Resume queue processing
   */
  resume() {
    this.startProcessing();
    logger.info('Queue resumed');
  }

  /**
   * Start periodic cleanup of stuck jobs
   * @private
   */
  _startStuckJobCleanup() {
    setInterval(() => {
      this._cleanupStuckJobs();
    }, this.config.stuckJobCleanupInterval);
  }

  /**
   * Cleanup stuck jobs that have not progressed
   * @private
   */
  _cleanupStuckJobs() {
    const now = Date.now();
    const cutoffTime = now - this.config.jobTimeout;

    // Move stuck processing jobs to failed
    for (const [jobId, job] of this.processing) {
      if (job.status === 'processing' && new Date(job.startedAt).getTime() < cutoffTime) {
        logger.warn('Job marked as failed due to timeout', { jobId: job.id });
        
        job.status = 'failed';
        job.failedAt = new Date().toISOString();
        job.error = {
          message: 'Job processing timed out',
          code: 'PROCESSING_TIMEOUT',
          stack: ''
        };
        
        this.failed.push(job);
        this.processing.delete(jobId);
      }
    }
  }
}

module.exports = EmailQueue;
