import React, { useState, useEffect, useRef } from 'react';
import {
  Box, 
  Typography, 
  TextField, 
  Button, 
  Card, 
  CardContent,
  Paper,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Add as AddIcon, 
  Send as SendIcon, 
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { emailApi, parseEmailStatus, isEmailProcessing } from '../services/emailApi';
import { useTheme } from '../context/ThemeContext';

const BulkEmail = () => {
  const { darkMode } = useTheme();
  const pollingIntervalRef = useRef(null);
  const queueStatusIntervalRef = useRef(null);
  
  const [emails, setEmails] = useState([
    { to: '', subject: '', body: '', priority: 'normal' }
  ]);
  const [sentEmails, setSentEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [randomEmailCount, setRandomEmailCount] = useState(3);
  const [queueStatus, setQueueStatus] = useState(null);
  const [queueStatusLoading, setQueueStatusLoading] = useState(false);

  // Function to fetch queue status
  const fetchQueueStatus = async () => {
    setQueueStatusLoading(true);
    try {
      const status = await emailApi.getQueueStatus();
      setQueueStatus(status);
    } catch (error) {
      console.error('Failed to fetch queue status:', error);
    } finally {
      setQueueStatusLoading(false);
    }
  };

  // Setup queue status monitoring and cleanup on mount/unmount
  useEffect(() => {
    // Initial fetch
    fetchQueueStatus();
    
    // Set up periodic queue status updates every 10 seconds
    queueStatusIntervalRef.current = setInterval(() => {
      fetchQueueStatus();
    }, 10000);
    
    // Cleanup on unmount
    return () => {
      if (queueStatusIntervalRef.current) {
        clearInterval(queueStatusIntervalRef.current);
        queueStatusIntervalRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []); // Empty dependency array for mount/unmount only

  const handleInputChange = (index, field, value) => {
    const updatedEmails = [...emails];
    updatedEmails[index][field] = value;
    setEmails(updatedEmails);
  };

  const addEmail = () => {
    setEmails([...emails, { to: '', subject: '', body: '', priority: 'normal' }]);
  };

  const removeEmail = (index) => {
    if (emails.length > 1) {
      const updatedEmails = emails.filter((_, i) => i !== index);
      setEmails(updatedEmails);
    }
  };

  // Function to update email statuses
  const updateEmailStatuses = async () => {
    if (!result || !result.results || result.results.length === 0) return;

    setStatusUpdating(true);
    try {
      const updatedResults = await Promise.all(
        result.results.map(async (emailResult, index) => {
          if (emailResult.idempotencyKey && 
              isEmailProcessing(emailResult.result?.status)) {
            try {
              const statusResponse = await emailApi.getEmailStatus(emailResult.idempotencyKey);
              const parsedStatus = parseEmailStatus(statusResponse);
              
              if (parsedStatus.status !== 'not_found') {
                return {
                  ...emailResult,
                  result: {
                    status: parsedStatus.status,
                    messageId: parsedStatus.messageId,
                    provider: parsedStatus.provider,
                    error: parsedStatus.error?.message || parsedStatus.error,
                    attempts: parsedStatus.attempts,
                    lastAttemptAt: parsedStatus.lastAttemptAt,
                    updatedAt: parsedStatus.updatedAt
                  }
                };
              }
            } catch (error) {
              console.warn('Failed to update status for:', emailResult.idempotencyKey, error);
            }
          }
          return emailResult;
        })
      );

      setResult(prev => ({
        ...prev,
        results: updatedResults
      }));

      // Stop polling if all emails are completed (sent/failed)
      const hasActiveEmails = updatedResults.some(r => 
        isEmailProcessing(r.result?.status)
      );
      
      if (!hasActiveEmails && pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        setPollingInterval(null);
      }
    } catch (error) {
      console.error('Error updating statuses:', error);
    } finally {
      setStatusUpdating(false);
    }
  };

  // Auto-refresh statuses for queued emails with faster refresh rate
  const startStatusPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    pollingIntervalRef.current = setInterval(async () => {
      await updateEmailStatuses();
      // Also refresh queue status during polling
      fetchQueueStatus();
    }, 5000); // Check every 5 seconds for real-time updates

    setPollingInterval(pollingIntervalRef.current);

    // Stop polling after 3 minutes
    setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        setPollingInterval(null);
      }
    }, 180000);
  };

  // Quick fill functions for testing
  const quickFillSample = () => {
    const sampleEmails = [
      {
        to: 'test1@example.com',
        subject: 'Test Email 1 - Sample Subject',
        body: 'This is a sample email body for testing purposes. It contains some basic content to verify the email functionality.',
        priority: 'high'
      },
      {
        to: 'test2@example.com',
        subject: 'Test Email 2 - Another Sample',
        body: 'This is another sample email with different content. This helps test bulk email functionality with varied data.',
        priority: 'normal'
      },
      {
        to: 'test3@example.com',
        subject: 'Test Email 3 - Low Priority',
        body: 'This is a low priority test email. It demonstrates how different priority levels work in the email queue system.',
        priority: 'low'
      }
    ];
    setEmails(sampleEmails);
  };

  const quickFillRandom = () => {
    const count = Math.max(1, Math.min(10, randomEmailCount)); // Limit form to 10 emails for UI performance
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Mary'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'test.com', 'example.org'];
    const subjects = ['Meeting Request', 'Project Update', 'Quick Question', 'Important Notice', 'Follow Up'];
    const priorities = ['high', 'normal', 'low'];

    const randomEmails = [];
    for (let i = 0; i < count; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const domain = domains[Math.floor(Math.random() * domains.length)];
      const subject = subjects[Math.floor(Math.random() * subjects.length)];
      const priority = priorities[Math.floor(Math.random() * priorities.length)];

      randomEmails.push({
        to: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i + 1}@${domain}`,
        subject: `${subject} #${i + 1} - ${new Date().toLocaleDateString()}`,
        body: `Hello ${firstName},\n\nThis is a randomly generated test email #${i + 1}.\n\nGenerated at: ${new Date().toLocaleString()}\n\nBest regards,\nTest System`,
        priority: priority
      });
    }
    setEmails(randomEmails);
  };

  // Generate emails efficiently without browser lag
  const generateBulkEmails = async () => {
    const count = Math.max(1, Math.min(100, randomEmailCount)); // Support up to 100 emails
    setLoading(true);
    setError(null);

    try {
      // Generate email data efficiently
      const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Mary', 'William', 'Jennifer', 'Richard', 'Linda', 'Charles', 'Susan', 'Thomas', 'Jessica', 'Christopher', 'Karen'];
      const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
      const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'company.com', 'business.org', 'test.net', 'example.com'];
      
      const subjectTemplates = [
        'Meeting Invitation for {date}',
        'Project Update - {topic}',
        'URGENT: Action Required',
        'Newsletter - {month} Edition',
        'Account Verification Required',
        'System Maintenance Notice',
        'New Feature Announcement',
        'Payment Reminder',
        'Event Registration Confirmation',
        'Survey Request - Your Feedback Needed'
      ];
      
      const bodyTemplates = [
        'Dear {name},\n\nI hope this email finds you well. This is regarding {topic}. Please review and respond at your earliest convenience.\n\nBest regards,\nSystem Admin',
        'Hello {name},\n\nWe have an important update about {topic}. Please take a moment to review this information.\n\nThank you,\nNotification System',
        'Hi {name},\n\nThis is a friendly reminder about {topic}. Please ensure you complete the required actions.\n\nRegards,\nAutomated System'
      ];

      const priorities = ['high', 'normal', 'low'];
      const generatedEmails = [];

      // Generate emails in batches to prevent UI blocking
      const batchSize = 10;
      for (let i = 0; i < count; i += batchSize) {
        const batch = [];
        const batchEnd = Math.min(i + batchSize, count);
        
        for (let j = i; j < batchEnd; j++) {
          const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
          const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
          const domain = domains[Math.floor(Math.random() * domains.length)];
          const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${j + 1}@${domain}`;
          
          const subjectTemplate = subjectTemplates[Math.floor(Math.random() * subjectTemplates.length)];
          const bodyTemplate = bodyTemplates[Math.floor(Math.random() * bodyTemplates.length)];
          
          const topics = ['project deadline', 'team meeting', 'system update', 'account review', 'policy change'];
          const topic = topics[Math.floor(Math.random() * topics.length)];
          
          const subject = subjectTemplate
            .replace('{date}', new Date().toLocaleDateString())
            .replace('{topic}', topic)
            .replace('{month}', new Date().toLocaleDateString('en-US', { month: 'long' }));
          
          const body = bodyTemplate
            .replace('{name}', firstName)
            .replace('{topic}', topic);

          batch.push({
            to: email,
            subject: subject,
            body: body,
            priority: priorities[Math.floor(Math.random() * priorities.length)]
          });
        }
        
        generatedEmails.push(...batch);
        
        // Small delay to prevent UI blocking
        if (i + batchSize < count) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      setEmails(generatedEmails);
      
      // Show success message
      setResult({
        success: true,
        message: `Generated ${generatedEmails.length} emails successfully!`,
        generatedAt: new Date().toLocaleTimeString()
      });
      
    } catch (err) {
      setError('Failed to generate bulk emails: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Send generated emails directly via API
  const sendGeneratedEmails = async () => {
    const count = Math.max(1, Math.min(100, randomEmailCount));
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Priority mapping to convert strings to numbers
      const priorityMap = {
        'high': 8,
        'normal': 5,
        'low': 2
      };

      // Generate emails on the fly and send directly
      const emailBatch = [];
      
      for (let i = 0; i < count; i++) {
        const firstName = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily'][Math.floor(Math.random() * 6)];
        const lastName = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][Math.floor(Math.random() * 5)];
        const domain = ['example.com', 'test.org', 'demo.net'][Math.floor(Math.random() * 3)];
        const priorityString = ['high', 'normal', 'low'][Math.floor(Math.random() * 3)];
        
        emailBatch.push({
          to: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i + 1}@${domain}`,
          subject: `Bulk Test Email #${i + 1} - ${new Date().toLocaleDateString()}`,
          body: `Hello ${firstName},\n\nThis is bulk email #${i + 1} sent at ${new Date().toLocaleTimeString()}.\n\nBest regards,\nBulk Email System`,
          priority: priorityMap[priorityString] || 5,
          idempotencyKey: `bulk-generated-${Date.now()}-${i}`
        });
      }

      // Send all emails at once
      const response = await emailApi.sendBulkEmails(emailBatch);
      
      // Store both sent emails and results
      setSentEmails(emailBatch);
      setResult(response);
      
      // Refresh queue status
      fetchQueueStatus();
      
      // Start status polling
      const hasActiveEmails = response.results?.some(r => 
        isEmailProcessing(r.result?.status)
      );
      
      if (hasActiveEmails) {
        startStatusPolling();
      }

      // Clear the form emails since we sent generated ones
      setEmails([{ to: '', subject: '', body: '', priority: 'normal' }]);
      
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to send bulk emails');
      setSentEmails([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setSentEmails([]);

    // Stop any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      setPollingInterval(null);
    }

    // Validate emails
    const validEmails = emails.filter(email => 
      email.to && email.subject && email.body
    );

    if (validEmails.length === 0) {
      setError('Please provide at least one complete email');
      setLoading(false);
      return;
    }

    try {
      // Convert priority strings to numbers and add idempotency keys
      const priorityMap = {
        'high': 8,
        'normal': 5,
        'low': 2
      };

      const processedEmails = validEmails.map((email, index) => ({
        ...email,
        idempotencyKey: `bulk-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
        priority: priorityMap[email.priority] || 5
      }));

      // Store the original emails for displaying in results
      setSentEmails(processedEmails);

      const response = await emailApi.sendBulkEmails(processedEmails);
      setResult(response);
      
      // Refresh queue status after sending emails
      fetchQueueStatus();
      
      // Start polling for status updates if there are active emails
      const hasActiveEmails = response.results?.some(r => 
        isEmailProcessing(r.result?.status)
      );
      
      if (hasActiveEmails) {
        startStatusPolling();
      }

      // Reset form on success
      setEmails([{ to: '', subject: '', body: '', priority: 'normal' }]);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to send bulk emails');
      // Reset sentEmails on error since we don't have valid results
      setSentEmails([]);
    } finally {
      setLoading(false);
    }
  };

  const priorities = [
    { value: 'high', label: 'High' },
    { value: 'normal', label: 'Normal' },
    { value: 'low', label: 'Low' },
  ];

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Bulk Email Sender
      </Typography>
      
      {/* Queue Status Display */}
      <Card sx={{ 
        mb: 2, 
        backgroundColor: darkMode ? '#2a2a2a' : '#f8f9fa',
        border: darkMode ? '1px solid #444' : '1px solid #e0e0e0',
        transition: 'all 0.3s ease'
      }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6" sx={{ 
              fontSize: '1.1rem', 
              fontWeight: 600,
              color: darkMode ? '#fff' : '#333'
            }}>
              📊 Email Queue Status
            </Typography>
            <Button
              variant="text"
              size="small"
              startIcon={queueStatusLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={fetchQueueStatus}
              disabled={queueStatusLoading}
              sx={{ 
                minWidth: 'auto', 
                px: 1,
                color: darkMode ? '#90caf9' : '#1976d2'
              }}
            >
              {queueStatusLoading ? '' : 'Refresh'}
            </Button>
          </Box>
          
          {queueStatus ? (
            <Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Chip 
                  label={`Active: ${queueStatus.processing || 0}`}
                  color="primary"
                  size="small"
                  variant={queueStatus.processing > 0 ? "filled" : "outlined"}
                  sx={{
                    backgroundColor: queueStatus.processing > 0 
                      ? (darkMode ? '#1976d2' : '#1976d2') 
                      : 'transparent',
                    borderColor: darkMode ? '#90caf9' : '#1976d2',
                    color: queueStatus.processing > 0 
                      ? '#fff' 
                      : (darkMode ? '#90caf9' : '#1976d2')
                  }}
                />
                <Chip 
                  label={`Queued: ${queueStatus.queued || 0}`}
                  color="warning"
                  size="small"
                  variant={queueStatus.queued > 0 ? "filled" : "outlined"}
                  sx={{
                    backgroundColor: queueStatus.queued > 0 
                      ? (darkMode ? '#f57c00' : '#ed6c02') 
                      : 'transparent',
                    borderColor: darkMode ? '#ffb74d' : '#ed6c02',
                    color: queueStatus.queued > 0 
                      ? '#fff' 
                      : (darkMode ? '#ffb74d' : '#ed6c02')
                  }}
                />
                <Chip 
                  label={`Completed: ${queueStatus.completed || 0}`}
                  color="success"
                  size="small"
                  sx={{
                    backgroundColor: darkMode ? '#2e7d32' : '#2e7d32',
                    color: '#fff'
                  }}
                />
                <Chip 
                  label={`Failed: ${queueStatus.failed || 0}`}
                  color="error"
                  size="small"
                  variant={queueStatus.failed > 0 ? "filled" : "outlined"}
                  sx={{
                    backgroundColor: queueStatus.failed > 0 
                      ? (darkMode ? '#d32f2f' : '#d32f2f') 
                      : 'transparent',
                    borderColor: darkMode ? '#f48fb1' : '#d32f2f',
                    color: queueStatus.failed > 0 
                      ? '#fff' 
                      : (darkMode ? '#f48fb1' : '#d32f2f')
                  }}
                />
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ 
                  color: darkMode ? '#bbb' : 'text.secondary'
                }}>
                  Queue Concurrency: {queueStatus.config?.maxConcurrency || 'N/A'} | 
                  Process Rate: {queueStatus.config?.processInterval || 'N/A'}ms intervals
                </Typography>
                <Typography variant="caption" sx={{ 
                  color: darkMode ? '#888' : 'text.secondary'
                }}>
                  Last updated: {queueStatus.timestamp ? new Date(queueStatus.timestamp).toLocaleTimeString() : 'N/A'}
                </Typography>
              </Box>
              
              {/* Show warning for large operations */}
              {emails.length > 25 && (
                <Alert 
                  severity="warning" 
                  sx={{ 
                    mt: 1, 
                    py: 0.5,
                    backgroundColor: darkMode ? '#3e2723' : '#fff3e0',
                    color: darkMode ? '#ffb74d' : '#e65100',
                    '& .MuiAlert-icon': {
                      color: darkMode ? '#ffb74d' : '#e65100'
                    }
                  }}
                >
                  <Typography variant="body2">
                    ⚠️ Large batch detected ({emails.length} emails). Consider processing in smaller batches for optimal performance.
                  </Typography>
                </Alert>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {queueStatusLoading ? (
                <>
                  <CircularProgress size={16} />
                  <Typography variant="body2" sx={{ 
                    color: darkMode ? '#bbb' : 'text.secondary'
                  }}>
                    Loading queue status...
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" sx={{ 
                  color: darkMode ? '#bbb' : 'text.secondary'
                }}>
                  Queue status unavailable
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h6">
              Email List
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                type="number"
                size="small"
                label="Count"
                value={randomEmailCount}
                onChange={(e) => setRandomEmailCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                inputProps={{ min: 1, max: 100 }}
                sx={{ width: 80 }}
              />
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
                Quick Fill Random ({Math.min(10, randomEmailCount)})
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={generateBulkEmails}
                color="primary"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : <AddIcon />}
              >
                Generate {randomEmailCount} Emails
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={sendGeneratedEmails}
                color="success"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
              >
                Send {randomEmailCount} Direct
              </Button>
            </Box>
          </Box>
          
          <Box component="form" onSubmit={handleSubmit}>
            <AnimatePresence>
              {emails.map((email, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Paper sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                        Email #{index + 1}
                      </Typography>
                      {emails.length > 1 && (
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                          <IconButton 
                            onClick={() => removeEmail(index)} 
                            color="error"
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </motion.div>
                      )}
                    </Box>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        fullWidth
                        label="To Email Address"
                        type="email"
                        value={email.to}
                        onChange={(e) => handleInputChange(index, 'to', e.target.value)}
                        required
                      />
                      
                      <TextField
                        fullWidth
                        label="Subject"
                        value={email.subject}
                        onChange={(e) => handleInputChange(index, 'subject', e.target.value)}
                        required
                      />
                      
                      <TextField
                        fullWidth
                        label="Message Body"
                        multiline
                        rows={3}
                        value={email.body}
                        onChange={(e) => handleInputChange(index, 'body', e.target.value)}
                        required
                      />
                      
                      <FormControl fullWidth>
                        <InputLabel>Priority</InputLabel>
                        <Select
                          value={email.priority}
                          label="Priority"
                          onChange={(e) => handleInputChange(index, 'priority', e.target.value)}
                        >
                          {priorities.map((priority) => (
                            <MenuItem key={priority.value} value={priority.value}>
                              {priority.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  </Paper>
                </motion.div>
              ))}
            </AnimatePresence>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={addEmail}
                >
                  Add Another Email
                </Button>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                  disabled={loading}
                  size="large"
                >
                  {loading ? 'Sending...' : `Send ${emails.length} Email(s)`}
                </Button>
              </motion.div>
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
        <Paper sx={{ mt: 2, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" color="success.main">
              Bulk Email Results
            </Typography>
            
            <Button
              variant="outlined"
              size="small"
              startIcon={statusUpdating ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={updateEmailStatuses}
              disabled={statusUpdating}
            >
              {statusUpdating ? 'Updating...' : 'Refresh Status'}
            </Button>
          </Box>
          
          <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip 
              label={`${result.processed || 0} Processed`} 
              color="info"
              sx={{
                backgroundColor: darkMode ? '#0288d1' : '#0288d1',
                color: '#fff'
              }}
            />
            {result.results && (
              <>
                <Chip 
                  label={`${result.results.filter(r => r.result?.status === 'sent').length} Sent`} 
                  color="success" 
                  variant="outlined"
                  sx={{
                    backgroundColor: darkMode ? '#1b5e20' : '#e8f5e8',
                    borderColor: darkMode ? '#4caf50' : '#4caf50',
                    color: darkMode ? '#81c784' : '#2e7d32'
                  }}
                />
                <Chip 
                  label={`${result.results.filter(r => 
                    isEmailProcessing(r.result?.status)
                  ).length} In Progress`} 
                  color="warning" 
                  variant="outlined"
                  sx={{
                    backgroundColor: darkMode ? '#e65100' : '#fff3e0',
                    borderColor: darkMode ? '#ff9800' : '#ff9800',
                    color: darkMode ? '#ffb74d' : '#e65100'
                  }}
                />
                <Chip 
                  label={`${result.results.filter(r => r.result?.error || r.result?.status === 'failed').length} Failed`} 
                  color="error" 
                  variant="outlined"
                  sx={{
                    backgroundColor: darkMode ? '#b71c1c' : '#ffebee',
                    borderColor: darkMode ? '#f44336' : '#f44336',
                    color: darkMode ? '#ef5350' : '#c62828'
                  }}
                />
              </>
            )}
            {(result.failed || 0) > 0 && (
              <Chip 
                label={`${result.failed || 0} Validation Errors`} 
                color="error"
                sx={{
                  backgroundColor: darkMode ? '#d32f2f' : '#d32f2f',
                  color: '#fff'
                }}
              />
            )}
          </Box>

          {result.results && result.results.length > 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>To</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Provider</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.results.map((emailResult, index) => {
                    // Find the original email data by matching the index
                    const originalEmail = sentEmails[emailResult.index] || {};
                    return (
                      <TableRow key={emailResult.idempotencyKey || index}>
                        <TableCell>{originalEmail.to || 'N/A'}</TableCell>
                        <TableCell>
                          {originalEmail.subject ? 
                            (originalEmail.subject.length > 30 ? 
                              originalEmail.subject.substring(0, 30) + '...' : 
                              originalEmail.subject
                            ) : 'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={
                              emailResult.result?.error ? 'failed' : 
                              (emailResult.result?.status || 'unknown')
                            }                            color={
                              emailResult.result?.error ? 'error' :
                              emailResult.result?.status === 'sent' ? 'success' :
                              isEmailProcessing(emailResult.result?.status) ? 'warning' : 'error'
                            }
                            size="small"
                          />
                          {emailResult.result?.error && (
                            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                              {emailResult.result.error.message || emailResult.result.error}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{emailResult.result?.provider || 'N/A'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {result.errors && result.errors.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom color="error.main">
                Failed Emails
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>To</TableCell>
                      <TableCell>Subject</TableCell>
                      <TableCell>Error</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.errors.map((errorResult, index) => {
                      // Find the original email data by matching the index
                      const originalEmail = sentEmails[errorResult.index] || {};
                      return (
                        <TableRow key={errorResult.idempotencyKey || index}>
                          <TableCell>{originalEmail.to || 'N/A'}</TableCell>
                          <TableCell>
                            {originalEmail.subject ? 
                              (originalEmail.subject.length > 30 ? 
                                originalEmail.subject.substring(0, 30) + '...' : 
                                originalEmail.subject
                              ) : 'N/A'
                            }
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="error">
                              {errorResult.error || 'Unknown error'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {pollingInterval && (
            <Alert 
              severity="info" 
              sx={{ 
                mt: 2,
                backgroundColor: darkMode ? '#0d47a1' : '#e3f2fd',
                color: darkMode ? '#90caf9' : '#0d47a1',
                border: darkMode ? '1px solid #1976d2' : '1px solid #90caf9',
                '& .MuiAlert-icon': {
                  color: darkMode ? '#90caf9' : '#1976d2'
                }
              }}
            >
              <Typography variant="body2">
                🔄 Auto-refreshing status every 5 seconds for real-time updates...
              </Typography>
            </Alert>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default BulkEmail;
