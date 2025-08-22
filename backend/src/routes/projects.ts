import { Router } from 'express';
import Joi from 'joi';
import { AuthRequest } from '../middleware/authentication';
import { AppError } from '../middleware/errorHandler';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const createProjectSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  code: Joi.string().min(1).max(1024 * 1024).required(),
  language: Joi.string().valid('move').default('move'),
  is_template: Joi.boolean().default(false)
});

const updateProjectSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).optional(),
  code: Joi.string().min(1).max(1024 * 1024).optional()
});

// Get all projects for the authenticated user
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new AppError('Failed to fetch projects', 500, 'DATABASE_ERROR');
    }

    res.json({
      success: true,
      data: projects || []
    });
  } catch (error) {
    next(error);
  }
});

// Get a specific project
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    next(error);
  }
});

// Create a new project
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { error: validationError, value } = createProjectSchema.validate(req.body);
    if (validationError) {
      throw new AppError(validationError.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const userId = req.userId!;
    
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        ...value,
        user_id: userId
      })
      .select()
      .single();

    if (error) {
      throw new AppError('Failed to create project', 500, 'DATABASE_ERROR');
    }

    logger.info(`Created project ${project.id} for user ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project
    });
  } catch (error) {
    next(error);
  }
});

// Update a project
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { error: validationError, value } = updateProjectSchema.validate(req.body);
    if (validationError) {
      throw new AppError(validationError.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { id } = req.params;
    const userId = req.userId!;
    
    const { data: project, error } = await supabase
      .from('projects')
      .update({
        ...value,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !project) {
      throw new AppError('Project not found or update failed', 404, 'PROJECT_NOT_FOUND');
    }

    logger.info(`Updated project ${id} for user ${userId}`);

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: project
    });
  } catch (error) {
    next(error);
  }
});

// Delete a project
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new AppError('Failed to delete project', 500, 'DATABASE_ERROR');
    }

    logger.info(`Deleted project ${id} for user ${userId}`);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get template projects
router.get('/templates/list', async (req: AuthRequest, res, next) => {
  try {
    const { data: templates, error } = await supabase
      .from('projects')
      .select('id, name, description, code, language')
      .eq('is_template', true)
      .order('created_at', { ascending: true });

    if (error) {
      throw new AppError('Failed to fetch templates', 500, 'DATABASE_ERROR');
    }

    res.json({
      success: true,
      data: templates || []
    });
  } catch (error) {
    next(error);
  }
});

export default router;