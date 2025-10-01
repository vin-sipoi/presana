const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    resetTime: new Date(Date.now() + 15 * 60 * 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Registration limiter
const registrationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many registration attempts, please try again later.',
    resetTime: new Date(Date.now() + 5 * 60 * 1000),
  },
});

// Email limiter
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: 'Email limit reached, please try again later.',
    resetTime: new Date(Date.now() + 60 * 60 * 1000),
  },
});

// Security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://suilens.xyz",
        "http://localhost:3009",  // ✅ backend (API) during dev
      ],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Validate & sanitize requests
const validateRequest = (req, res, next) => {
  if (req.body && Object.keys(req.body).length > 50) {
    return res.status(400).json({
      error: 'Request too large',
    });
  }

  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    return value;
  };

  if (req.body) {
    for (const key in req.body) {
      req.body[key] = sanitizeValue(req.body[key]);
    }
  }

  next();
};

// CORS options
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'https://suilens.xyz',
      'https://www.suilens.xyz',
      'http://localhost:3001', // ✅ frontend (Next.js) during dev
      'http://localhost:5173', // ✅ waitlist (Vite) during dev
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Export modules
module.exports = {
  generalLimiter,
  registrationLimiter,
  emailLimiter,
  securityHeaders,
  validateRequest,
  corsOptions,
  compression: compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
  }),
};
