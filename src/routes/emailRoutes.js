const express = require('express');
const { getEmailServiceInstance } = require('../services/EmailServiceInstance');
const { validateEmailRequest } = require('../middleware/validation');
const logger = require('../utils/Logger');

const router = express.Router();
const emailService = getEmailServiceInstance();

/**
 * Send Email Endpoint
 * POST /api/email/send
 */
router.post('/send', validateEmailRequest, emailService.getRateLimiterMiddleware(), async (req, res) => {
  try {
    const { to, subject, body, idempotencyKey, priority, delay } = req.body;
    
    logger.info('Email send request received', { 
      to, 
      subject: subject.substring(0, 50), 
      idempotencyKey 
    });

    const result = await emailService.sendEmail({
      to,
      subject,
      body,
      idempotencyKey,
      priority,
      delay
    });

    // Return appropriate status code based on result
    if (result.success) {
      const statusCode = result.status === 'queued' ? 202 : 200;
      res.status(statusCode).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Email send endpoint error', { 
      error: error.message, 
      idempotencyKey: req.body.idempotencyKey 
    });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message,
      idempotencyKey: req.body.idempotencyKey
    });
  }
});

/**
 * Get Email Status Endpoint
 * GET /api/email/status/:idempotencyKey
 */
router.get('/status/:idempotencyKey', (req, res) => {
  try {
    const { idempotencyKey } = req.params;
    
    if (!idempotencyKey) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Idempotency key is required'
      });
    }

    const status = emailService.getEmailStatus(idempotencyKey);
    
    if (!status.found) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Email not found',
        idempotencyKey
      });
    }

    res.json(status);

  } catch (error) {
    logger.error('Email status endpoint error', { 
      error: error.message, 
      idempotencyKey: req.params.idempotencyKey 
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      idempotencyKey: req.params.idempotencyKey
    });
  }
});

/**
 * Bulk Send Email Endpoint
 * POST /api/email/bulk-send
 */
router.post('/bulk-send', async (req, res) => {
  try {
    const { emails } = req.body;
    
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Field "emails" must be a non-empty array'
      });
    }

    if (emails.length > 100) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Maximum 100 emails allowed per bulk request'
      });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      
      try {
        // Validate each email
        if (!email.to || !email.subject || !email.body || !email.idempotencyKey) {
          errors.push({
            index: i,
            error: 'Missing required fields: to, subject, body, idempotencyKey'
          });
          continue;
        }

        const result = await emailService.sendEmail(email);
        results.push({
          index: i,
          idempotencyKey: email.idempotencyKey,
          result
        });

      } catch (error) {
        errors.push({
          index: i,
          idempotencyKey: email.idempotencyKey,
          error: error.message
        });
      }
    }

    const response = {
      success: errors.length === 0,
      processed: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    };

    const statusCode = errors.length === 0 ? 200 : 207; // 207 Multi-Status
    res.status(statusCode).json(response);

  } catch (error) {
    logger.error('Bulk send endpoint error', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * Resend Email Endpoint
 * POST /api/email/resend/:idempotencyKey
 */
router.post('/resend/:idempotencyKey', async (req, res) => {
  try {
    const { idempotencyKey } = req.params;
    const { force = false } = req.body;

    // Get original email status
    const originalStatus = emailService.getEmailStatus(idempotencyKey);
    
    if (!originalStatus.found) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Original email not found',
        idempotencyKey
      });
    }

    // Check if email was already sent successfully (unless forced)
    if (!force && originalStatus.status === 'sent') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email was already sent successfully. Use force=true to resend.',
        idempotencyKey
      });
    }

    // Create new idempotency key for resend
    const newIdempotencyKey = `${idempotencyKey}_resend_${Date.now()}`;
    
    // Extract original email data (this would need to be stored in a real implementation)
    const result = await emailService.sendEmail({
      to: 'example@example.com', // In real implementation, this would be retrieved
      subject: 'Resent Email',    // from the original request data
      body: 'This is a resent email',
      idempotencyKey: newIdempotencyKey
    });

    res.json({
      ...result,
      originalIdempotencyKey: idempotencyKey,
      newIdempotencyKey
    });

  } catch (error) {
    logger.error('Resend endpoint error', { 
      error: error.message, 
      idempotencyKey: req.params.idempotencyKey 
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      idempotencyKey: req.params.idempotencyKey
    });
  }
});

/**
 * Get Queue Status Endpoint
 * GET /api/email/queue/status
 */
router.get('/queue/status', (req, res) => {
  try {
    const queueStats = emailService.getQueueStatus();
    
    res.json({
      ...queueStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Queue status endpoint error', { error: error.message });

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
