import { Router } from 'express';
import Joi from 'joi';
import { AuthRequest } from '../middleware/authentication';
import { authentication } from '../middleware/authentication';
import { deployRateLimiter } from '../middleware/rateLimiter';
import { AppError } from '../middleware/errorHandler';
import { deployToIOTA, getPlaygroundWalletInfo } from '../services/deployService';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Validation schema
const deploySchema = Joi.object({
  project_id: Joi.string().uuid().required(),
  network: Joi.string().valid('testnet', 'mainnet').default('testnet'),
  walletType: Joi.string().valid('playground', 'external').default('playground'),
  signedTransaction: Joi.string().when('walletType', {
    is: 'external',
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

router.post('/', authentication, deployRateLimiter, async (req: AuthRequest, res, next) => {
  try {
    // Validate request body
    const { error, value } = deploySchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { project_id, network, walletType, signedTransaction } = value;
    const userId = req.userId!;
    
    // Check network restrictions
    if (walletType === 'playground' && network !== 'testnet') {
      throw new AppError('Playground wallet is only available on testnet', 400);
    }

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      throw new AppError('Project not found or access denied', 404, 'PROJECT_NOT_FOUND');
    }

    // Check if project has been compiled
    if (!project.last_compilation_result || !project.last_compilation_result.success) {
      throw new AppError('Project must be compiled successfully before deployment', 400, 'NOT_COMPILED');
    }

    logger.info(`Deploying project ${project_id} to ${network} for user ${userId} using ${walletType} wallet`);

    let deploymentResult;
    
    if (walletType === 'playground') {
      // Use backend wallet for playground deployments
      deploymentResult = await deployToIOTA(
        project.code,
        project_id,
        userId,
        network
      );
    } else {
      // For external wallet, execute signed transaction
      if (!signedTransaction) {
        throw new AppError('Signed transaction required for external wallet', 400);
      }
      // TODO: Implement execution of signed transaction
      throw new AppError('External wallet deployment not yet implemented', 501);
    }

    // Save deployment to database if successful
    if (deploymentResult.success && deploymentResult.package_id) {
      const { error: insertError } = await supabase
        .from('deployed_contracts')
        .insert({
          project_id,
          user_id: userId,
          contract_address: deploymentResult.contract_address || deploymentResult.package_id,
          package_id: deploymentResult.package_id,
          module_ids: deploymentResult.module_ids,
          abi: project.last_compilation_result.abi || {},
          network,
          transaction_hash: deploymentResult.transaction_hash || '',
          gas_used: deploymentResult.gas_used
        });

      if (insertError) {
        logger.error('Failed to save deployment to database:', insertError);
      }
    }

    res.json({
      success: true,
      message: deploymentResult.success ? 'Deployment successful' : 'Deployment failed',
      data: deploymentResult
    });
  } catch (error) {
    next(error);
  }
});

// Get playground wallet info (public endpoint - no auth required)
router.get('/wallet/playground', async (req, res, next) => {
  try {
    // Return full wallet configuration
    const walletInfo = await getPlaygroundWalletInfo();
    
    res.json({
      success: true,
      data: walletInfo
    });
  } catch (error) {
    next(error);
  }
});

// Get deployment history for a project
router.get('/history/:projectId', authentication, async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId!;

    const { data: deployments, error } = await supabase
      .from('deployed_contracts')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError('Failed to fetch deployment history', 500, 'DATABASE_ERROR');
    }

    res.json({
      success: true,
      data: deployments || []
    });
  } catch (error) {
    next(error);
  }
});

export default router;