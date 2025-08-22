import { Router } from 'express';
import Joi from 'joi';
import { AuthRequest } from '../middleware/authentication';
import { AppError } from '../middleware/errorHandler';
import { readMoveToml, updateMoveToml, validateMoveToml, parseMoveToml } from '../services/moveTomlService';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Validation schema for Move.toml update
const updateMoveTomlSchema = Joi.object({
  content: Joi.string().min(1).max(100 * 1024).required() // Max 100KB
});

// Get Move.toml for a project
router.get('/projects/:projectId/move-toml', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId!;
    
    // Verify project ownership
    const { data: project, error } = await (supabase as any)
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    
    if (error || !project) {
      throw new AppError('Project not found or access denied', 404, 'PROJECT_NOT_FOUND');
    }
    
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
router.put('/projects/:projectId/move-toml', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId!;
    
    // Validate request body
    const { error: validationError, value } = updateMoveTomlSchema.validate(req.body);
    if (validationError) {
      throw new AppError(validationError.details[0].message, 400, 'VALIDATION_ERROR');
    }
    
    // Verify project ownership
    const { data: project, error } = await (supabase as any)
      .from('projects')
      .select('id, user_id, name')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    
    if (error || !project) {
      throw new AppError('Project not found or access denied', 404, 'PROJECT_NOT_FOUND');
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
    
    // Update project's updated_at timestamp
    await (supabase as any)
      .from('projects')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', projectId);
    
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
router.post('/projects/:projectId/move-toml/validate', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId!;
    
    // Validate request body
    const { error: validationError, value } = updateMoveTomlSchema.validate(req.body);
    if (validationError) {
      throw new AppError(validationError.details[0].message, 400, 'VALIDATION_ERROR');
    }
    
    // Verify project ownership
    const { data: project, error } = await (supabase as any)
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    
    if (error || !project) {
      throw new AppError('Project not found or access denied', 404, 'PROJECT_NOT_FOUND');
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
router.get('/projects/:projectId/move-toml/parsed', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId!;
    
    // Verify project ownership
    const { data: project, error } = await (supabase as any)
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    
    if (error || !project) {
      throw new AppError('Project not found or access denied', 404, 'PROJECT_NOT_FOUND');
    }
    
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