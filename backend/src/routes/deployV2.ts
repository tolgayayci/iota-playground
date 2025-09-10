import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { 
  deployWithPlaygroundWallet, 
  prepareDeploymentTransaction,
  executeSignedTransaction,
  getCompiledPackageData
} from '../services/iotaDeployService';
import { simulateDeployment } from '../services/simulationService';
import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';

const router = Router();

// Validation schemas
const preparePublishSchema = Joi.object({
  projectId: Joi.string().required(),
  network: Joi.string().valid('testnet', 'mainnet').default('testnet'),
  userId: Joi.string().optional(), // Allow userId to be passed
});

const deploySchema = Joi.object({
  projectId: Joi.string().required(),
  network: Joi.string().valid('testnet', 'mainnet').default('testnet'),
  walletType: Joi.string().valid('playground', 'external').required(),
  senderAddress: Joi.string().when('walletType', {
    is: 'external',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  userId: Joi.string().required(),
});

const executeSchema = Joi.object({
  projectId: Joi.string().required(),
  signedTransaction: Joi.string().required(),
  signature: Joi.string().required(),
  network: Joi.string().valid('testnet', 'mainnet').default('testnet'),
  userId: Joi.string().required(),
});

const simulateSchema = Joi.object({
  projectId: Joi.string().required(),
  network: Joi.string().valid('testnet', 'mainnet').default('testnet'),
  userId: Joi.string().required(),
});

// Prepare publish transaction data
router.post('/prepare-publish', async (req: Request, res: Response, next) => {
  try {
    const { error, value } = preparePublishSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { projectId, network } = value;
    
    // Extract userId from the request body (sent by frontend)
    const userId = req.body.userId || req.body.user_id;
    
    if (!userId) {
      throw new AppError('User ID is required', 400, 'VALIDATION_ERROR');
    }

    logger.info(`Preparing publish transaction for project ${projectId}`);

    // Get compiled package data
    const { modules, dependencies } = await getCompiledPackageData(projectId, userId);

    // Estimate gas
    const gasEstimate = 1000000000; // 1 IOTA
    const estimatedCost = '1.0000 IOTA';

    res.json({
      success: true,
      data: {
        modules,
        dependencies,
        gasEstimate,
        estimatedCost,
        network,
      }
    });
  } catch (error) {
    next(error);
  }
});

// Deploy endpoint - handles both playground and external wallet
router.post('/deploy', async (req: Request, res: Response, next) => {
  try {
    const { error, value } = deploySchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { projectId, network, walletType, senderAddress, userId } = value;

    logger.info(`Deploying project ${projectId} with ${walletType} wallet on ${network}`);

    if (walletType === 'playground') {
      // Deploy with playground wallet
      const result = await deployWithPlaygroundWallet(projectId, userId, network);
      
      res.json({
        success: result.success,
        data: result,
        message: result.success ? 'Deployment successful' : 'Deployment failed',
      });
    } else {
      // Prepare transaction for external wallet
      const result = await prepareDeploymentTransaction(
        projectId,
        userId,
        senderAddress,
        network
      );
      
      res.json({
        success: true,
        data: result,
        message: 'Transaction prepared for signing',
      });
    }
  } catch (error) {
    next(error);
  }
});

// Execute signed transaction
router.post('/execute', async (req: Request, res: Response, next) => {
  try {
    const { error, value } = executeSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { signedTransaction, signature, network } = value;

    logger.info(`Executing signed transaction on ${network}`);

    const result = await executeSignedTransaction(
      signedTransaction,
      signature,
      network
    );

    res.json({
      success: result.success,
      data: result,
      message: result.success ? 'Transaction executed successfully' : 'Transaction execution failed',
    });
  } catch (error) {
    next(error);
  }
});

// Simulate deployment
router.post('/simulate', async (req: Request, res: Response, next) => {
  try {
    const { error, value } = simulateSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { projectId, network, userId } = value;

    logger.info(`Simulating deployment for project ${projectId} on ${network}`);

    const result = await simulateDeployment(projectId, userId, network);

    res.json({
      success: result.success,
      data: result,
      message: result.success ? 'Simulation successful' : 'Simulation failed',
    });
  } catch (error) {
    next(error);
  }
});

// Get deployment history (placeholder - returns empty array since we don't have DB)
router.get('/history/:projectId/:userId', async (req: Request, res: Response, next) => {
  try {
    const { projectId, userId } = req.params;
    
    logger.info(`Fetching deployment history for project ${projectId}, user ${userId}`);
    
    // Since we removed database, return empty history
    res.json({
      success: true,
      data: [],
      message: 'Deployment history retrieved',
    });
  } catch (error) {
    next(error);
  }
});

export default router;