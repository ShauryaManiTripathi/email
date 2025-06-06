import React from 'react';
import {
  Typography,
  Card,
  CardContent,
  Grid,
  Box,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Email,
  Send,
  Assessment,
  Security,
  Speed,
  CheckCircle,
} from '@mui/icons-material';

const Home = () => {
  const features = [
    {
      icon: <Send />,
      title: 'Reliable Email Delivery',
      description: 'Multiple provider fallback ensures your emails are delivered',
    },
    {
      icon: <Speed />,
      title: 'Rate Limiting',
      description: 'Built-in rate limiting to prevent service overload',
    },
    {
      icon: <Security />,
      title: 'Idempotency',
      description: 'Duplicate email prevention with request deduplication',
    },
    {
      icon: <Assessment />,
      title: 'Circuit Breaker',
      description: 'Automatic failure detection and recovery',
    },
  ];

  const capabilities = [
    'Exponential backoff retry logic',
    'Provider health monitoring',
    'Priority-based email queue',
    'Comprehensive status tracking',
    'Bulk email sending',
    'Real-time service metrics',
  ];

  return (
    <Box>
      <Typography variant="h3" component="h1" gutterBottom align="center" color="primary">
        Resilient Email Service
      </Typography>
      
      <Typography variant="h6" component="p" gutterBottom align="center" color="textSecondary" sx={{ mb: 4 }}>
        A robust email delivery system with multiple providers, retry logic, and comprehensive monitoring
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {features.map((feature, index) => (
          <Grid item xs={12} md={6} key={index}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {feature.icon}
                  <Typography variant="h6" component="h2" sx={{ ml: 1 }}>
                    {feature.title}
                  </Typography>
                </Box>
                <Typography variant="body2" color="textSecondary">
                  {feature.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            <Email sx={{ mr: 1, verticalAlign: 'middle' }} />
            Key Capabilities
          </Typography>
          <List>
            {capabilities.map((capability, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <CheckCircle color="primary" />
                </ListItemIcon>
                <ListItemText primary={capability} />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 2 }}>
            Service Status
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label="Primary Provider" color="success" variant="outlined" />
            <Chip label="Secondary Provider" color="success" variant="outlined" />
            <Chip label="Circuit Breaker: CLOSED" color="success" variant="outlined" />
            <Chip label="Rate Limiter: Active" color="info" variant="outlined" />
          </Box>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
            Visit the Service Health page for detailed monitoring information.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Home;
