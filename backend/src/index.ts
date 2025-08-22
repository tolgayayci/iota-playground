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
import deployRouter from './routes/deploy';
import deployV2Router from './routes/deployV2';
import projectRouter from './routes/projects';
import healthRouter from './routes/health';
import ptbExecuteRouter from './routes/ptbExecute';
import moveTomlRouter from './routes/moveToml';

// Import middleware (after dotenv is loaded)
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { authentication } from './middleware/authentication';

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api', rateLimiter);

// Routes
app.use('/api/health', healthRouter);
app.use('/api/compile', compileRouter); // Temporarily removed auth for testing
app.use('/api/deploy', deployRouter); // Legacy deployment endpoint
app.use('/api/v2/deploy', deployV2Router); // New deployment with SDK
app.use('/api/v2/ptb', ptbExecuteRouter); // PTB execution with playground wallet
app.use('/api/projects', authentication, projectRouter);
app.use('/api', authentication, moveTomlRouter); // Move.toml endpoints

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
  
  // Check configuration
  const { checkSupabaseConfig } = await import('./config/database');
  const hasSupabase = checkSupabaseConfig();
  if (!hasSupabase) {
    logger.warn('⚠️  Running without full Supabase configuration');
  } else {
    logger.info('✅ Supabase configured');
  }
  
  // Check IOTA CLI
  const { verifyIOTAInstallation } = await import('./config/iota');
  const hasIOTA = await verifyIOTAInstallation();
  if (!hasIOTA) {
    logger.warn('⚠️  IOTA CLI not found - compilation features disabled');
  }
});