import { Router } from 'express';
import Joi from 'joi';
import { compileRateLimiter } from '../middleware/rateLimiter';
import { AppError } from '../middleware/errorHandler';
import { compileMove, getBytecodeForDeployment } from '../services/compileService';
import { logger } from '../utils/logger';
import { supabase } from '../config/database';

const router = Router();

// Validation schema
const compileSchema = Joi.object({
  user_id: Joi.string().required(),
  project_id: Joi.string().required(),
  code: Joi.string().min(1).max(1024 * 1024).required() // Max 1MB
});

router.post('/', compileRateLimiter, async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = compileSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { user_id, project_id, code } = value;

    logger.info(`Compiling project ${project_id} for user ${user_id}`);

    // Compile the Move code
    const compilationResult = await compileMove(code, project_id, user_id);

    // Store compilation result in projects table if successful
    if (compilationResult.success) {
      try {
        await supabase
          .from('projects')
          .update({
            last_compilation_result: compilationResult,
            updated_at: new Date().toISOString()
          })
          .eq('id', project_id)
          .eq('user_id', user_id);
        
        logger.info(`Stored compilation result in database for project ${project_id}`);
      } catch (error) {
        logger.warn(`Failed to store compilation result in database:`, error);
      }
    }

    res.json({
      success: compilationResult.success,
      message: compilationResult.success ? 'Compilation successful' : 'Compilation failed',
      data: compilationResult
    });
  } catch (error) {
    next(error);
  }
});

// Bytecode endpoint for deployment
const bytecodeSchema = Joi.object({
  userId: Joi.string().required(),
  projectId: Joi.string().required()
});

router.post('/bytecode', async (req, res, next) => {
  try {
    const { error, value } = bytecodeSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { userId, projectId } = value;

    logger.info(`Getting bytecode for project ${projectId} user ${userId}`);

    // Get compiled bytecode for deployment
    const result = await getBytecodeForDeployment(userId, projectId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;