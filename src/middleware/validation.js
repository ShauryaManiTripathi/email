/**
 * Request validation middleware
 */
const validateEmailRequest = (req, res, next) => {
  const { to, subject, body, idempotencyKey } = req.body;
  
  const errors = [];

  if (!to) {
    errors.push('Field "to" is required');
  } else if (typeof to !== 'string') {
    errors.push('Field "to" must be a string');
  } else {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      errors.push('Field "to" must be a valid email address');
    }
  }

  if (!subject) {
    errors.push('Field "subject" is required');
  } else if (typeof subject !== 'string') {
    errors.push('Field "subject" must be a string');
  } else if (subject.length > 200) {
    errors.push('Field "subject" must be less than 200 characters');
  }

  if (!body) {
    errors.push('Field "body" is required');
  } else if (typeof body !== 'string') {
    errors.push('Field "body" must be a string');
  } else if (body.length > 10000) {
    errors.push('Field "body" must be less than 10,000 characters');
  }

  if (!idempotencyKey) {
    errors.push('Field "idempotencyKey" is required');
  } else if (typeof idempotencyKey !== 'string') {
    errors.push('Field "idempotencyKey" must be a string');
  } else if (idempotencyKey.length < 1 || idempotencyKey.length > 100) {
    errors.push('Field "idempotencyKey" must be between 1 and 100 characters');
  }

  // Optional fields validation
  if (req.body.priority !== undefined) {
    if (typeof req.body.priority !== 'number' || req.body.priority < 0 || req.body.priority > 10) {
      errors.push('Field "priority" must be a number between 0 and 10');
    }
  }

  if (req.body.delay !== undefined) {
    if (typeof req.body.delay !== 'number' || req.body.delay < 0 || req.body.delay > 300000) {
      errors.push('Field "delay" must be a number between 0 and 300000 (5 minutes)');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Request validation failed',
      details: errors
    });
  }

  next();
};

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', err);

  // Default error response
  let statusCode = 500;
  let response = {
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    response = {
      error: 'Validation Error',
      message: err.message
    };
  } else if (err.code === 'CIRCUIT_BREAKER_OPEN') {
    statusCode = 503;
    response = {
      error: 'Service Unavailable',
      message: err.message,
      retryAfter: err.retryAfter
    };
  } else if (err.code === 'RATE_LIMIT_EXCEEDED') {
    statusCode = 429;
    response = {
      error: 'Too Many Requests',
      message: err.message,
      retryAfter: err.retryAfter
    };
  }

  // Include request ID if available
  if (req.body && req.body.idempotencyKey) {
    response.idempotencyKey = req.body.idempotencyKey;
  }

  res.status(statusCode).json(response);
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    idempotencyKey: req.body ? req.body.idempotencyKey : undefined
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
};

module.exports = {
  validateEmailRequest,
  errorHandler,
  requestLogger
};
