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
      console.error('Health fetch error:', err);
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
      case 'sent':
        return <CheckCircle color="success" />;
      case 'degraded':
      case 'warning':
        return <Warning color="warning" />;
      case 'unhealthy':
      case 'error':
      case 'failed':
        return <Error color="error" />;
      default:
        return <Warning color="disabled" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'active':
      case 'sent':
        return 'success';
      case 'degraded':
      case 'warning':
        return 'warning';
      case 'unhealthy':
      case 'error':
      case 'failed':
        return 'error';
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
          {/* Overall Status */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
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
          </motion.div>

          {/* Service Components */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {health.providers && Object.entries(health.providers).map(([provider, data], index) => (
              <Grid item xs={12} md={6} key={provider}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        {getStatusIcon(data.healthy ? 'healthy' : 'unhealthy')}
                        <Typography variant="h6" sx={{ ml: 1, textTransform: 'capitalize' }}>
                          {provider}
                        </Typography>
                      </Box>
                      <Chip 
                        label={data.healthy ? 'Healthy' : 'Unhealthy'} 
                        color={data.healthy ? 'success' : 'error'}
                        size="small"
                      />
                      <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                        Response Time: {data.responseTime}ms
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Last Check: {new Date(data.lastCheck).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>

          {/* Circuit Breakers */}
          {health.circuitBreakers && Object.keys(health.circuitBreakers).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      Circuit Breakers
                    </Typography>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<RestartAlt />}
                        onClick={handleResetCircuitBreaker}
                      >
                        Reset All
                      </Button>
                    </motion.div>
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Provider</TableCell>
                          <TableCell>State</TableCell>
                          <TableCell>Failures</TableCell>
                          <TableCell>Next Attempt</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(health.circuitBreakers).map(([provider, breaker]) => (
                          <TableRow key={provider}>
                            <TableCell>{provider}</TableCell>
                            <TableCell>
                              <Chip 
                                label={breaker.state} 
                                color={breaker.state === 'CLOSED' ? 'success' : breaker.state === 'OPEN' ? 'error' : 'warning'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>{breaker.failureCount}</TableCell>
                            <TableCell>
                              {breaker.nextAttempt ? new Date(breaker.nextAttempt).toLocaleString() : 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Admin Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Admin Actions
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      variant="outlined"
                      startIcon={<Clear />}
                      onClick={handleClearIdempotencyCache}
                      color="warning"
                    >
                      Clear Idempotency Cache
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      variant="outlined"
                      startIcon={<RestartAlt />}
                      onClick={handleResetCircuitBreaker}
                    >
                      Reset Circuit Breakers
                    </Button>
                  </motion.div>
                </Box>
              </CardContent>
            </Card>
          </motion.div>

          {/* System Metrics */}
          {metrics && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    System Metrics
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle2" gutterBottom>
                        Memory Usage
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Used: {metrics.memory?.used || 0} MB / Total: {metrics.memory?.total || 0} MB
                      </Typography>
                      {metrics.memory && (
                        <LinearProgress
                          variant="determinate"
                          value={(metrics.memory.used / metrics.memory.total) * 100}
                          sx={{ mt: 1, height: 8, borderRadius: 4 }}
                        />
                      )}
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle2" gutterBottom>
                        Uptime
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {Math.floor((metrics.uptime || 0) / 3600)} hours {Math.floor(((metrics.uptime || 0) % 3600) / 60)} minutes
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle2" gutterBottom>
                        System Info
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Platform: {metrics.system?.platform || 'Unknown'}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Node: {metrics.system?.nodeVersion || 'Unknown'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default ServiceHealth;
