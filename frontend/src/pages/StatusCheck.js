import React, { useState } from 'react';
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
  Divider,
} from '@mui/material';
import { Search, Refresh } from '@mui/icons-material';
import { emailApi } from '../services/emailApi';

const StatusCheck = () => {
  const [emailId, setEmailId] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emailId.trim()) {
      setError('Please enter an idempotency key');
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const response = await emailApi.getEmailStatus(emailId.trim());
      setStatus(response);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to fetch email status');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (emailId.trim()) {
      handleSubmit({ preventDefault: () => {} });
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'sent':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      case 'queued':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Email Status Check
      </Typography>
      
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Enter Idempotency Key
          </Typography>
          
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                fullWidth
                label="Idempotency Key"
                value={emailId}
                onChange={(e) => setEmailId(e.target.value)}
                placeholder="Enter idempotency key to check status"
                disabled={loading}
              />
              
              <Button
                type="submit"
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <Search />}
                disabled={loading}
                sx={{ minWidth: 120 }}
              >
                {loading ? 'Checking...' : 'Check'}
              </Button>
              
              {status && (
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  Refresh
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {status && (
        <Paper sx={{ mt: 2, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Email Status Details
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" color="textSecondary" sx={{ minWidth: 120 }}>
                Status:
              </Typography>
              <Chip 
                label={status.status} 
                color={getStatusColor(status.status)}
                variant="filled"
              />
            </Box>

            <Divider />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" color="textSecondary" sx={{ minWidth: 120 }}>
                Idempotency Key:
              </Typography>
              <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                {status.idempotencyKey || emailId}
              </Typography>
            </Box>

            {status.to && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body1" color="textSecondary" sx={{ minWidth: 120 }}>
                  To:
                </Typography>
                <Typography variant="body1">
                  {status.to}
                </Typography>
              </Box>
            )}

            {status.subject && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body1" color="textSecondary" sx={{ minWidth: 120 }}>
                  Subject:
                </Typography>
                <Typography variant="body1">
                  {status.subject}
                </Typography>
              </Box>
            )}

            {status.provider && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body1" color="textSecondary" sx={{ minWidth: 120 }}>
                  Provider:
                </Typography>
                <Chip 
                  label={status.provider} 
                  variant="outlined"
                  size="small"
                />
              </Box>
            )}

            {status.priority && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body1" color="textSecondary" sx={{ minWidth: 120 }}>
                  Priority:
                </Typography>
                <Chip 
                  label={status.priority} 
                  color={status.priority === 'high' ? 'error' : status.priority === 'low' ? 'info' : 'default'}
                  variant="outlined"
                  size="small"
                />
              </Box>
            )}

            <Divider />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" color="textSecondary" sx={{ minWidth: 120 }}>
                Created:
              </Typography>
              <Typography variant="body1">
                {formatTimestamp(status.createdAt)}
              </Typography>
            </Box>

            {status.sentAt && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body1" color="textSecondary" sx={{ minWidth: 120 }}>
                  Sent:
                </Typography>
                <Typography variant="body1">
                  {formatTimestamp(status.sentAt)}
                </Typography>
              </Box>
            )}

            {status.updatedAt && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body1" color="textSecondary" sx={{ minWidth: 120 }}>
                  Updated:
                </Typography>
                <Typography variant="body1">
                  {formatTimestamp(status.updatedAt)}
                </Typography>
              </Box>
            )}

            {status.attempts && status.attempts > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body1" color="textSecondary" sx={{ minWidth: 120 }}>
                  Attempts:
                </Typography>
                <Chip 
                  label={`${status.attempts} attempt(s)`} 
                  size="small"
                  color={status.attempts > 1 ? 'warning' : 'default'}
                />
              </Box>
            )}

            {status.error && (
              <>
                <Divider />
                <Box>
                  <Typography variant="body1" color="textSecondary" gutterBottom>
                    Error Details:
                  </Typography>
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {status.error}
                  </Alert>
                </Box>
              </>
            )}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default StatusCheck;
