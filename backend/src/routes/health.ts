import { Router } from 'express';
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
        iotaCLI: false
      }
    };

    // Check IOTA CLI availability
    health.services.iotaCLI = await verifyIOTAInstallation();

    const statusCode = health.services.iotaCLI ? 200 : 503;

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