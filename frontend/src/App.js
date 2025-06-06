import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Container, Box } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeContextProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import SendEmail from './pages/SendEmail';
import BulkEmail from './pages/BulkEmail';
import StatusCheck from './pages/StatusCheck';
import ServiceHealth from './pages/ServiceHealth';
import './App.css';

const pageVariants = {
  initial: {
    opacity: 0,
    x: -20,
  },
  in: {
    opacity: 1,
    x: 0,
  },
  out: {
    opacity: 0,
    x: 20,
  },
};

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.4,
};

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
            >
              <Home />
            </motion.div>
          }
        />
        <Route
          path="/send-email"
          element={
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
            >
              <SendEmail />
            </motion.div>
          }
        />
        <Route
          path="/bulk-email"
          element={
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
            >
              <BulkEmail />
            </motion.div>
          }
        />
        <Route
          path="/status"
          element={
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
            >
              <StatusCheck />
            </motion.div>
          }
        />
        <Route
          path="/health"
          element={
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
            >
              <ServiceHealth />
            </motion.div>
          }
        />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  return (
    <ThemeContextProvider>
      <Router>
        <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
          <Navbar />
          <Container maxWidth="lg" sx={{ py: 4 }}>
            <AnimatedRoutes />
          </Container>
        </Box>
      </Router>
    </ThemeContextProvider>
  );
}

export default App;
