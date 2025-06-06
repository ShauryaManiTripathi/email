import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  Paper,
  Chip,
} from '@mui/material';
import { Send, Refresh } from '@mui/icons-material';
import { emailApi, parseEmailStatus, isEmailProcessing, getStatusText } from '../services/emailApi';

const SendEmail = () => {
  const [formData, setFormData] = useState({
    to: '',
    subject: '',
    body: '',
    priority: 'normal',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Quick fill functions for testing
  const quickFillSample = () => {
    setFormData({
      to: 'test@example.com',
      subject: 'Test Email - Sample Subject',
      body: 'This is a sample email body for testing purposes. It contains some basic content to verify the email functionality works correctly.',
      priority: 'normal'
    });
  };

  const quickFillRandom = () => {
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Mary', 'William', 'Jennifer', 'Richard', 'Linda', 'Charles', 'Susan', 'Thomas', 'Jessica', 'Christopher', 'Karen'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'company.com', 'business.org', 'test.net', 'example.com'];
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const randomEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 999)}@${domain}`;
    
    const subjectPrefixes = ['URGENT:', 'FYI:', 'ACTION REQUIRED:', 'REMINDER:', 'UPDATE:', 'NOTICE:', 'ALERT:', 'INFO:'];
    const subjectTopics = [
      'Meeting Scheduled', 'Project Update', 'System Maintenance', 'New Feature Release',
      'Security Alert', 'Account Verification', 'Payment Reminder', 'Newsletter Subscription',
      'Event Invitation', 'Survey Request', 'Document Review', 'Policy Update',
      'Training Session', 'Performance Report', 'Budget Review', 'Client Feedback'
    ];
    
    const hasPrefix = Math.random() > 0.6;
    const prefix = hasPrefix ? subjectPrefixes[Math.floor(Math.random() * subjectPrefixes.length)] + ' ' : '';
    const topic = subjectTopics[Math.floor(Math.random() * subjectTopics.length)];
    const randomSubject = prefix + topic;
    
    const bodyTemplates = [
      `Dear ${firstName},\n\nI hope this email finds you well. I wanted to reach out regarding ${topic.toLowerCase()}. Please let me know if you have any questions or concerns.\n\nBest regards,\nSender`,
      `Hello ${firstName},\n\nThis is a friendly reminder about ${topic.toLowerCase()}. Please take action at your earliest convenience.\n\nThank you,\nSender`,
      `Hi ${firstName},\n\nI wanted to update you on ${topic.toLowerCase()}. Everything is progressing smoothly and we expect completion soon.\n\nRegards,\nSender`,
      `Dear ${firstName},\n\nWe need your attention regarding ${topic.toLowerCase()}. Please review the attached information and respond accordingly.\n\nSincerely,\nSender`,
      `Hello ${firstName},\n\nGreat news! We have updates about ${topic.toLowerCase()} that I think you'll find interesting.\n\nBest,\nSender`
    ];
    
    const randomBody = bodyTemplates[Math.floor(Math.random() * bodyTemplates.length)];
    const priorities = ['high', 'normal', 'low'];
    
    setFormData({
      to: randomEmail,
      subject: randomSubject,
      body: randomBody,
      priority: priorities[Math.floor(Math.random() * priorities.length)]
    });
  };

  // Function to update email status
  const updateEmailStatus = async () => {
    if (!result || !result.idempotencyKey) return;

    // Skip if already completed
    if (!isEmailProcessing(result.status)) {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      return;
    }

    setStatusUpdating(true);
    try {
      const statusResponse = await emailApi.getEmailStatus(result.idempotencyKey);
      const parsedStatus = parseEmailStatus(statusResponse);
      
      if (parsedStatus.status !== 'not_found') {
        const updatedResult = {
          ...result,
          ...parsedStatus,
          lastUpdated: new Date().toLocaleTimeString(),
          statusHistory: [...(result.statusHistory || []), {
            status: parsedStatus.status,
            timestamp: new Date().toLocaleTimeString(),
            provider: parsedStatus.provider,
            attempts: parsedStatus.attempts,
            error: parsedStatus.error
          }]
        };
        
        setResult(updatedResult);
        
        // Stop polling when email is no longer being processed
        if (!isEmailProcessing(parsedStatus.status)) {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
      // Add error to status history
      setResult(prev => ({
        ...prev,
        lastUpdated: new Date().toLocaleTimeString(),
        statusHistory: [...(prev.statusHistory || []), {
          status: 'error',
          timestamp: new Date().toLocaleTimeString(),
          error: 'Failed to check status'
        }]
      }));
    } finally {
      setStatusUpdating(false);
    }
  };

  // Start status polling
  const startStatusPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    const interval = setInterval(async () => {
      await updateEmailStatus();
    }, 5000); // Check every 5 seconds for real-time updates

    setPollingInterval(interval);

    // Stop polling after 2 minutes
    setTimeout(() => {
      if (interval) {
        clearInterval(interval);
        setPollingInterval(null);
      }
    }, 120000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Generate a unique idempotency key
      const idempotencyKey = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Convert priority string to number
      const priorityMap = {
        'high': 8,
        'normal': 5,
        'low': 2
      };

      const emailData = {
        ...formData,
        idempotencyKey,
        priority: priorityMap[formData.priority] || 5
      };

      const response = await emailApi.sendEmail(emailData);
      setResult({
        ...response,
        idempotencyKey // Include the key for status checking
      });

      // Start polling if email is queued
      if (isEmailProcessing(response.status)) {
        startStatusPolling();
      }

      // Reset form on success
      setFormData({
        to: '',
        subject: '',
        body: '',
        priority: 'normal',
      });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  const priorities = [
    { value: 'high', label: 'High Priority' },
    { value: 'normal', label: 'Normal Priority' },
    { value: 'low', label: 'Low Priority' },
  ];

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Send Email
      </Typography>
      
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h6">
              Email Details
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={quickFillSample}
                color="info"
              >
                Quick Fill Sample
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={quickFillRandom}
                color="secondary"
              >
                Quick Fill Random
              </Button>
            </Box>
          </Box>
          
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="To Email Address"
              name="to"
              type="email"
              value={formData.to}
              onChange={handleInputChange}
              required
              margin="normal"
              placeholder="recipient@example.com"
            />
            
            <TextField
              fullWidth
              label="Subject"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              required
              margin="normal"
              placeholder="Enter email subject"
            />
            
            <TextField
              fullWidth
              label="Message Body"
              name="body"
              value={formData.body}
              onChange={handleInputChange}
              required
              multiline
              rows={6}
              margin="normal"
              placeholder="Enter your message here..."
            />
            
            <TextField
              select
              fullWidth
              label="Priority"
              name="priority"
              value={formData.priority}
              onChange={handleInputChange}
              margin="normal"
              SelectProps={{
                native: true,
              }}
            >
              {priorities.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </TextField>
            
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <Send />}
                disabled={loading}
                size="large"
              >
                {loading ? 'Sending...' : 'Send Email'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Paper sx={{ mt: 2, p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              📧 Email Response
              {result.lastUpdated && (
                <Typography variant="caption" color="textSecondary">
                  (Last updated: {result.lastUpdated})
                </Typography>
              )}
            </Typography>
            
            {isEmailProcessing(result.status) && (
              <Button
                variant="outlined"
                size="small"
                startIcon={statusUpdating ? <CircularProgress size={16} /> : <Refresh />}
                onClick={updateEmailStatus}
                disabled={statusUpdating}
              >
                {statusUpdating ? 'Updating...' : 'Refresh Status'}
              </Button>
            )}
          </Box>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2, mb: 2 }}>
            <Box>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Status
              </Typography>
              <Chip 
                label={getStatusText(result.status)} 
                color={
                  result.status === 'sent' ? 'success' : 
                  result.status === 'failed' ? 'error' : 
                  isEmailProcessing(result.status) ? 'warning' : 'info'
                } 
                size="medium"
                sx={{ fontWeight: 'bold' }}
              />
            </Box>
            
            <Box>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Message ID
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', p: 0.5, borderRadius: 1 }}>
                {result.messageId || result.idempotencyKey || 'N/A'}
              </Typography>
            </Box>
            
            {result.provider && (
              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Provider Used
                </Typography>
                <Chip 
                  label={result.provider.toUpperCase()} 
                  variant="outlined" 
                  size="medium"
                  color={result.provider === 'primary' ? 'primary' : 'secondary'}
                />
              </Box>
            )}
            
            {result.attempts && (
              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Attempts
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {result.attempts}
                </Typography>
              </Box>
            )}
          </Box>

          {result.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Error:</strong> {result.error}
              </Typography>
            </Alert>
          )}

          {result.statusHistory && result.statusHistory.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                📊 Status History
              </Typography>
              <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, maxHeight: 200, overflow: 'auto' }}>
                {result.statusHistory.map((entry, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="caption" color="textSecondary" sx={{ minWidth: 60 }}>
                      {entry.timestamp}
                    </Typography>
                    <Chip 
                      label={getStatusText(entry.status)} 
                      size="small"
                      color={
                        entry.status === 'sent' ? 'success' : 
                        entry.status === 'failed' || entry.status === 'error' ? 'error' : 
                        isEmailProcessing(entry.status) ? 'warning' : 'info'
                      }
                    />
                    {entry.provider && (
                      <Typography variant="caption" color="textSecondary">
                        via {entry.provider}
                      </Typography>
                    )}
                    {entry.attempts && (
                      <Typography variant="caption" color="textSecondary">
                        (attempt {entry.attempts})
                      </Typography>
                    )}
                    {entry.error && (
                      <Typography variant="caption" color="error">
                        - {entry.error}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {result.currentProvider && isEmailProcessing(result.status) && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                🔄 Currently processing via <strong>{result.currentProvider}</strong> provider...
              </Typography>
            </Alert>
          )}
          
          {pollingInterval && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                🔄 Auto-refreshing status every 5 seconds for real-time updates...
              </Typography>
            </Alert>
          )}

          <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="caption" color="textSecondary">
              💡 <strong>Tip:</strong> You can check this email's status anytime using ID: <code>{result.idempotencyKey}</code>
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default SendEmail;
