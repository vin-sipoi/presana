const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');

const {
  generalLimiter,
  registrationLimiter,
  emailLimiter,
  securityHeaders,
  validateRequest,
  corsOptions,
  compression
} = require('./middleware/security');

const userRoutes = require('./routes/userRoutes');
const eventRoutes = require('./routes/eventRoutes');
const communityRoutes = require('./routes/communityRoutes');
const registrationsRoutes = require('./routes/registrations');
const dashboardRoutes = require('./routes/dashboardRoutes');
const sendBlastEmailRoutes = require('./routes/send-blast-email');
const newsletterRoutes = require('./routes/newsletterRoutes');
const authRoutes = require('./routes/authRoutes');
const verifyToken = require('./middleware/authenticateToken');
const { csrfProtection, csrfTokenHandler } = require('./middleware/csrfMiddleware');
const waitlistRoutes = require('./routes/waitlistRoute');
const EventSyncService = require('./services/eventSyncService');

// Load environment variables from client/.env first, then server/.env as fallback
require('dotenv').config({ path: '../client/.env' });
require('dotenv').config(); // Load server/.env if it exists

// Debug logging for environment variables
console.log('Environment variables loaded:');
console.log('- NEXT_PUBLIC_PACKAGE_ID:', process.env.NEXT_PUBLIC_PACKAGE_ID ? '✅ Set' : '❌ Not set');
console.log('- NEXT_PUBLIC_EVENT_REGISTRY_ID:', process.env.NEXT_PUBLIC_EVENT_REGISTRY_ID ? '✅ Set' : '❌ Not set');
console.log('- ENOKI_PRIVATE_KEY:', process.env.ENOKI_PRIVATE_KEY ? '✅ Set' : '❌ Not set');

// Show which values will actually be used (with fallbacks)
const effectivePackageId = process.env.PACKAGE_ID || process.env.NEXT_PUBLIC_PACKAGE_ID;
const effectiveRegistryId = process.env.EVENT_REGISTRY_ID || process.env.NEXT_PUBLIC_EVENT_REGISTRY_ID;
console.log('\nEffective configuration:');
console.log('- Package ID (effective):', effectivePackageId ? `✅ ${effectivePackageId.substring(0, 10)}...` : '❌ Not configured');
console.log('- Registry ID (effective):', effectiveRegistryId ? `✅ ${effectiveRegistryId.substring(0, 10)}...` : '❌ Not configured');

// Polyfill for crypto in Node.js environment
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = require('crypto');
}

const app = express();

// Instantiate EventSyncService for background syncing
const eventSyncService = new EventSyncService();

// ✅ Middleware setup (placed BEFORE routes)
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(securityHeaders);
app.use(compression);

// JSON body parser with size limit and validation
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (error) {
      res.status(400).json({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(validateRequest);

app.use(generalLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
    port: process.env.PORT,
    environment: process.env.NODE_ENV
  });
});

// ✅ Routes (all now behind CORS middleware)
app.use('/api/auth', authRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/user', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use('/api/registrations', registrationLimiter, registrationsRoutes);
app.use('/api/send-blast-email', emailLimiter, sendBlastEmailRoutes);
app.use('/api/newsletter', newsletterRoutes);

// Static files
app.use('/static', express.static(path.join(__dirname, 'public')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.status === 429) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Please slow down and try again later',
      resetTime: err.resetTime
    });
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS policy violation',
      message: 'Origin not allowed'
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON'
    });
  }

  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Catch-all for unknown API endpoints
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`
  });
});

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}, shutting down gracefully...`);
  try {
    await eventSyncService.stop(); // Assuming stop method exists to stop background sync
    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const PORT = process.env.PORT || 3009;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);

  const syncIntervalMs = parseInt(process.env.EVENT_SYNC_INTERVAL_MS, 10) || 60000;
  setInterval(async () => {
    try {
      await eventSyncService.syncEventsFromBlockchain();
    } catch (error) {
      console.error('Error during background event sync:', error);
    }
  }, syncIntervalMs);
});
