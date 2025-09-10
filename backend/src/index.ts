// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env file from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });


import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// Import logger (after dotenv is loaded)
import { logger } from './utils/logger';

// Import routes (after dotenv is loaded)
import compileRouter from './routes/compile';
import deployV2Router from './routes/deployV2';
import healthRouter from './routes/health';
import ptbExecuteRouter from './routes/ptbExecute';
import moveTomlRouter from './routes/moveToml';

// Import middleware (after dotenv is loaded)
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());

// Configure CORS to allow multiple origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://iotaplay.app',
  'https://www.iotaplay.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(null, true); // In production, you might want to be more restrictive
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api', rateLimiter);

// Routes
app.use('/api/health', healthRouter);
app.use('/api/compile', compileRouter);
app.use('/api/v2/deploy', deployV2Router); // Deployment endpoints
app.use('/api/v2/ptb', ptbExecuteRouter); // PTB execution with playground wallet
app.use('/api/move-toml', moveTomlRouter); // Move.toml endpoints (no auth)

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Start server
app.listen(PORT, async () => {
  logger.info(`🚀 IOTA Playground Backend running on port ${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🔗 IOTA Network: ${process.env.IOTA_NETWORK}`);
  
  // Supabase removed - running as stateless service
  logger.info('✅ Running as stateless compilation service (no database)')
  
  // Check IOTA CLI
  const { verifyIOTAInstallation } = await import('./config/iota');
  const hasIOTA = await verifyIOTAInstallation();
  if (!hasIOTA) {
    logger.warn('⚠️  IOTA CLI not found - compilation features disabled');
  }
});