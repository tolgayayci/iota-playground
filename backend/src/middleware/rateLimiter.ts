import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');

export const rateLimiter = rateLimit({
  windowMs,
  max: maxRequests,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later'
      }
    });
  }
});

// Stricter rate limit for compilation endpoints
export const compileRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 10, // 10 compilations per minute
  message: {
    success: false,
    error: {
      code: 'COMPILE_RATE_LIMIT',
      message: 'Too many compilation requests, please wait before trying again'
    }
  }
});

// Stricter rate limit for deployment endpoints
export const deployRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 5, // 5 deployments per minute
  message: {
    success: false,
    error: {
      code: 'DEPLOY_RATE_LIMIT',
      message: 'Too many deployment requests, please wait before trying again'
    }
  }
});