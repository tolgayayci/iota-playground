import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { AppError } from '../middleware/errorHandler';
import { readMoveToml, updateMoveToml, validateMoveToml, parseMoveToml } from '../services/moveTomlService';
import { logger } from '../utils/logger';

const router = Router();

// Validation schema for Move.toml update
const updateMoveTomlSchema = Joi.object({
  content: Joi.string().min(1).max(100 * 1024).required() // Max 100KB
});

// Get Move.toml for a project
router.get('/:userId/:projectId', async (req: Request, res: Response, next) => {
  try {
    const { userId, projectId } = req.params;
    
    // Read Move.toml from filesystem
    const content = await readMoveToml(userId, projectId);
    
    res.json({
      success: true,
      data: {
        content,
        projectId
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update Move.toml for a project
router.put('/:userId/:projectId', async (req: Request, res: Response, next) => {
  try {
    const { userId, projectId } = req.params;
    
    // Validate request body
    const { error: validationError, value } = updateMoveTomlSchema.validate(req.body);
    if (validationError) {
      throw new AppError(validationError.details[0].message, 400, 'VALIDATION_ERROR');
    }
    
    // Validate Move.toml content
    const validation = validateMoveToml(value.content);
    if (!validation.valid) {
      throw new AppError(
        `Invalid Move.toml: ${validation.errors?.join(', ')}`,
        400,
        'INVALID_MOVE_TOML'
      );
    }
    
    // Update Move.toml in filesystem
    await updateMoveToml(userId, projectId, value.content);
    
    logger.info(`Updated Move.toml for project ${projectId} by user ${userId}`);
    
    res.json({
      success: true,
      message: 'Move.toml updated successfully',
      data: {
        projectId,
        validation: {
          valid: true
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Validate Move.toml content (without saving)
router.post('/validate', async (req: Request, res: Response, next) => {
  try {
    // Validate request body
    const { error: validationError, value } = updateMoveTomlSchema.validate(req.body);
    if (validationError) {
      throw new AppError(validationError.details[0].message, 400, 'VALIDATION_ERROR');
    }
    
    // Validate Move.toml content
    const validation = validateMoveToml(value.content);
    
    res.json({
      success: true,
      data: {
        valid: validation.valid,
        errors: validation.errors
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get parsed Move.toml data
router.get('/:userId/:projectId/parsed', async (req: Request, res: Response, next) => {
  try {
    const { userId, projectId } = req.params;
    
    // Parse Move.toml
    const config = await parseMoveToml(userId, projectId);
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
});

export default router;