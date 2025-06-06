import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Paper,
  Chip,
  Grid,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { 
  Refresh, 
  CheckCircle, 
  Error, 
  Warning,
  RestartAlt,
  Clear,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { emailApi } from '../services/emailApi';
                </Typography>
              </CardContent>
            </Card>
          </motion.div>Grid,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { 
  Refresh, 
  CheckCircle, 
  Error, 
  Warning,
  RestartAlt,
  Clear,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { emailApi } from '../services/emailApi';

const ServiceHealth = () => {
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  const fetchHealthData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [healthResponse, metricsResponse] = await Promise.all([
        emailApi.getDetailedHealth(),
        emailApi.getMetrics(),
      ]);
      setHealth(healthResponse);
      setMetrics(metricsResponse);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  };

  const handleResetCircuitBreaker = async () => {
    try {
      await emailApi.resetCircuitBreaker();
      await fetchHealthData(); // Refresh data
    } catch (err) {
      setError('Failed to reset circuit breaker');
    }
  };

  const handleClearIdempotencyCache = async () => {
    try {
      await emailApi.clearIdempotencyCache();
      await fetchHealthData(); // Refresh data
    } catch (err) {
      setError('Failed to clear idempotency cache');
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'active':
      case 'closed':
        return <CheckCircle color="success" />;
      case 'unhealthy':
      case 'inactive':
      case 'open':
        return <Error color="error" />;
      case 'half-open':
        return <Warning color="warning" />;
      default:
        return <Warning color="disabled" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'active':
      case 'closed':
        return 'success';
      case 'unhealthy':
      case 'inactive':
      case 'open':
        return 'error';
      case 'half-open':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (loading && !health) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Service Health Dashboard
        </Typography>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={20} /> : <Refresh />}
            onClick={fetchHealthData}
            disabled={loading}
          >
            Refresh
          </Button>
        </motion.div>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {health && (
        <>
          {/* Overall Health Status */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {getStatusIcon(health.status)}
                <Typography variant="h5" sx={{ ml: 1 }}>
                  Overall Status: {health.status}
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary">
                Last updated: {new Date(health.timestamp).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>

          {/* Service Components */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {health.services && Object.entries(health.services).map(([service, data]) => (
              <Grid item xs={12} md={6} key={service}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      {getStatusIcon(data.status)}
                      <Typography variant="h6" sx={{ ml: 1, textTransform: 'capitalize' }}>
                        {service.replace(/([A-Z])/g, ' $1').trim()}
                      </Typography>
                    </Box>
                    <Chip 
                      label={data.status} 
                      color={getStatusColor(data.status)}
                      size="small"
                    />
                    {data.message && (
                      <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                        {data.message}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Email Providers */}
          {health.providers && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Email Providers
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Provider</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Success Rate</TableCell>
                        <TableCell>Last Check</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(health.providers).map(([provider, data]) => (
                        <TableRow key={provider}>
                          <TableCell>{provider}</TableCell>
                          <TableCell>
                            <Chip 
                              label={data.status} 
                              color={getStatusColor(data.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {data.successRate ? `${(data.successRate * 100).toFixed(1)}%` : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {data.lastCheck ? new Date(data.lastCheck).toLocaleString() : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* Circuit Breaker */}
          {health.circuitBreaker && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Circuit Breaker
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<RestartAlt />}
                    onClick={handleResetCircuitBreaker}
                    disabled={health.circuitBreaker.state === 'CLOSED'}
                  >
                    Reset
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip 
                    label={`State: ${health.circuitBreaker.state}`}
                    color={getStatusColor(health.circuitBreaker.state)}
                  />
                  <Chip 
                    label={`Failures: ${health.circuitBreaker.failures}`}
                    variant="outlined"
                  />
                  <Chip 
                    label={`Success: ${health.circuitBreaker.successCount}`}
                    variant="outlined"
                  />
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Rate Limiter */}
          {health.rateLimiter && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Rate Limiter
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip 
                    label={`Active Clients: ${health.rateLimiter.activeClients || 0}`}
                    variant="outlined"
                  />
                  <Chip 
                    label={`Total Requests: ${health.rateLimiter.totalRequests || 0}`}
                    variant="outlined"
                  />
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Idempotency Cache */}
          {health.idempotency && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Idempotency Cache
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Clear />}
                    onClick={handleClearIdempotencyCache}
                  >
                    Clear Cache
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip 
                    label={`Cached Requests: ${health.idempotency.cacheSize || 0}`}
                    variant="outlined"
                  />
                  <Chip 
                    label={`Hit Rate: ${health.idempotency.hitRate ? (health.idempotency.hitRate * 100).toFixed(1) + '%' : 'N/A'}`}
                    variant="outlined"
                  />
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Service Metrics */}
          {metrics && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Service Metrics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {metrics.totalEmails || 0}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Total Emails
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4" color="success.main">
                        {metrics.successfulEmails || 0}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Successful
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4" color="error.main">
                        {metrics.failedEmails || 0}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Failed
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4" color="warning.main">
                        {metrics.queuedEmails || 0}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Queued
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {metrics.successRate !== undefined && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="body2" gutterBottom>
                      Success Rate: {(metrics.successRate * 100).toFixed(1)}%
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={metrics.successRate * 100}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </motion.div>
  );
};

export default ServiceHealth;
