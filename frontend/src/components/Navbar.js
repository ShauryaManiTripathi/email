import React from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Box,
  IconButton,
} from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import EmailIcon from '@mui/icons-material/Email';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const Navbar = () => {
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useTheme();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Send Email', path: '/send-email' },
    { label: 'Bulk Email', path: '/bulk-email' },
    { label: 'Status Check', path: '/status' },
    { label: 'Service Health', path: '/health' },
  ];

  return (
    <AppBar position="static">
      <Toolbar>
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        >
          <EmailIcon sx={{ mr: 2 }} />
        </motion.div>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Email Service
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {navItems.map((item) => (
            <motion.div
              key={item.path}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                color="inherit"
                component={RouterLink}
                to={item.path}
                sx={{
                  backgroundColor: isActive(item.path) ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  },
                }}
              >
                {item.label}
              </Button>
            </motion.div>
          ))}
          <IconButton 
            onClick={toggleDarkMode} 
            color="inherit"
            sx={{ ml: 1 }}
          >
            {darkMode ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
