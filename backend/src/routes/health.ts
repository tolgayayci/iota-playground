import { Router } from 'express';
import { supabase } from '../config/database';
import { verifyIOTAInstallation } from '../config/iota';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      services: {
        database: false,
        iotaCLI: false
      }
    };

    // Check database connection
    try {
      const { error } = await supabase.from('users').select('count').limit(1);
      health.services.database = !error;
    } catch (error) {
      logger.error('Database health check failed:', error);
    }

    // Check IOTA CLI availability
    health.services.iotaCLI = await verifyIOTAInstallation();

    const statusCode = health.services.database && health.services.iotaCLI ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed'
      }
    });
  }
});

export default router;