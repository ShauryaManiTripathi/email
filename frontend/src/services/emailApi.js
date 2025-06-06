import axios from 'axios';

// Simple and reliable API base URL determination
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  
  // Production domain - use full URL
  if (hostname === 'demo-email.shaurya.codes') {
    return 'https://demo-email.shaurya.codes/api';
  }
  
  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'https://demo-email.shaurya.codes/api';
  }
  
  // Any other domain - use relative path
  return 'https://demo-email.shaurya.codes/api';
};

const API_BASE_URL = getApiBaseUrl();
const BASE_URL = API_BASE_URL.replace('/api', ''); // For health endpoints

console.log('Using API Base URL:', API_BASE_URL);
console.log('Using Base URL for health:', BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('Response error:', error);
    return Promise.reject(error);
  }
);

export const emailApi = {
  // Send single email
  sendEmail: async (emailData) => {
    const response = await api.post('/email/send', emailData);
    return response.data;
  },

  // Send bulk emails
  sendBulkEmails: async (emails) => {
    const response = await api.post('/email/bulk-send', { emails });
    return response.data;
  },

  // Get email status
  getEmailStatus: async (idempotencyKey) => {
    const response = await api.get(`/email/status/${idempotencyKey}`);
    return response.data;
  },

  // Get queue status
  getQueueStatus: async () => {
    const response = await api.get('/email/queue/status');
    return response.data;
  },

  // Get service health
  getServiceHealth: async () => {
    const response = await axios.get(`${BASE_URL}/health`);
    return response.data;
  },

  // Get detailed health info
  getDetailedHealth: async () => {
    const response = await axios.get(`${BASE_URL}/health/detailed`);
    return response.data;
  },

  // Get service metrics
  getMetrics: async () => {
    const response = await axios.get(`${BASE_URL}/metrics`);
    return response.data;
  },

  // Reset circuit breaker
  resetCircuitBreaker: async () => {
    const response = await axios.post(`${BASE_URL}/circuit-breakers/reset`);
    return response.data;
  },

  // Clear idempotency cache
  clearIdempotencyCache: async () => {
    const response = await axios.post(`${BASE_URL}/admin/idempotency/clear`);
    return response.data;
  }
};

// Utility function to parse email status responses consistently
export const parseEmailStatus = (statusResponse) => {
  if (!statusResponse || !statusResponse.found) {
    return {
      status: 'not_found',
      message: 'Email not found'
    };
  }

  // Backend now returns consistent status structure
  return {
    status: statusResponse.status, // Can be: pending, queued, processing, retrying, sent, failed
    attempts: statusResponse.attempts || 0,
    messageId: statusResponse.messageId,
    provider: statusResponse.provider,
    error: statusResponse.error,
    createdAt: statusResponse.createdAt,
    lastAttemptAt: statusResponse.lastAttemptAt,
    updatedAt: statusResponse.updatedAt,
    idempotencyKey: statusResponse.idempotencyKey
  };
};

// Helper function to determine if an email is still being processed
export const isEmailProcessing = (status) => {
  return ['pending', 'queued', 'processing', 'retrying'].includes(status);
};

// Helper function to get user-friendly status text
export const getStatusText = (status) => {
  const statusMap = {
    pending: 'Pending',
    queued: 'Queued',
    processing: 'Processing',
    retrying: 'Retrying',
    sent: 'Sent',
    failed: 'Failed',
    not_found: 'Not Found'
  };
  return statusMap[status] || status;
};

// Helper function to get status color for UI
export const getStatusColor = (status) => {
  const colorMap = {
    pending: 'orange',
    queued: 'blue',
    processing: 'orange',
    retrying: 'orange',
    sent: 'green',
    failed: 'red',
    not_found: 'gray'
  };
  return colorMap[status] || 'gray';
};

export default emailApi;
