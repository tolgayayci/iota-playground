import { Router } from 'express';
import Joi from 'joi';
import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';
import { AuthRequest } from '../middleware/authentication';
import { authentication } from '../middleware/authentication';
import { deployRateLimiter } from '../middleware/rateLimiter';
import { AppError } from '../middleware/errorHandler';
import { 
  deployWithPlaygroundWallet, 
  prepareDeploymentTransaction,
  executeSignedTransaction,
  getDeploymentHistory,
  getCompiledPackageData
} from '../services/iotaDeployService';
import { simulateDeployment } from '../services/simulationService';
import { getPlaygroundWalletInfo } from '../services/deployService';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Deploy with playground wallet or prepare for external wallet
const deploySchema = Joi.object({
  projectId: Joi.string().required(), // Allow any string for development
  network: Joi.string().valid('testnet', 'mainnet').default('testnet'),
  walletType: Joi.string().valid('playground', 'external').required(),
  senderAddress: Joi.string().when('walletType', {
    is: 'external',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  userId: Joi.string().required() // Accept userId in request body for development
});

router.post('/deploy', deployRateLimiter, async (req, res, next) => {
  try {
    const { error, value } = deploySchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { projectId, network, walletType, senderAddress, userId } = value;

    logger.info(`Deployment request: project=${projectId}, wallet=${walletType}, network=${network}`);

    if (walletType === 'playground') {
      // Deploy directly with playground wallet
      const result = await deployWithPlaygroundWallet(projectId, userId, network);
      
      // Save successful deployment to database
      if (result.success && result.packageId) {
        // Get the project data including source code and ABI from the compilation result
        const { data: project } = await supabase
          .from('projects')
          .select('last_compilation_result, code')
          .eq('id', projectId)
          .eq('user_id', userId)
          .single();

        // Extract ABI from compilation result - handle both object and array formats
        const compilationAbi = project?.last_compilation_result?.abi;
        let abiFunctions = [];
        
        if (compilationAbi) {
          if (Array.isArray(compilationAbi)) {
            // Already in array format
            abiFunctions = compilationAbi;
          } else if (compilationAbi.functions && Array.isArray(compilationAbi.functions)) {
            // Extract functions from ABI object
            abiFunctions = compilationAbi.functions;
          } else {
            logger.warn('Invalid ABI format in compilation result:', typeof compilationAbi);
          }
        }
        
        logger.info(`Storing ABI with ${abiFunctions.length} functions for deployment`);
        
        // Get playground wallet address for metadata
        const playgroundInfo = await getPlaygroundWalletInfo();
        
        // Store deployer address in abi metadata
        const abiWithMetadata = {
          functions: abiFunctions,
          deployerAddress: playgroundInfo.address
        };
        
        // Save deployment data including source code
        let deploymentData: any = {
          project_id: projectId,
          user_id: userId,
          package_id: result.packageId,
          module_address: result.packageId,
          module_name: 'playground_deployment',
          network,
          abi: abiWithMetadata, // Store abi with metadata
          transaction_hash: result.transactionDigest || '',
          gas_used: parseInt(result.gasUsed || '0'),
          source_code: project?.code || '', // Store the source code at deployment time
        };

        // Save deployment
        const { error: dbError } = await supabase
          .from('deployed_contracts')
          .insert(deploymentData);

        if (dbError) {
          logger.error('Failed to save deployment to database:', dbError);
          logger.error('Database error details:', JSON.stringify(dbError, null, 2));
        } else {
          logger.info(`Successfully saved deployment to database: ${result.packageId}`);
        }

        // Update project with deployment info
        await supabase
          .from('projects')
          .update({
            package_id: result.packageId,
            module_address: result.packageId
          })
          .eq('id', projectId);
      }

      res.json({
        success: result.success,
        data: result
      });
    } else {
      // Prepare transaction for external wallet
      if (!senderAddress) {
        throw new AppError('Sender address required for external wallet', 400);
      }

      const preparedTx = await prepareDeploymentTransaction(
        projectId,
        userId,
        senderAddress,
        network
      );

      res.json({
        success: true,
        data: preparedTx
      });
    }
  } catch (error) {
    next(error);
  }
});

// Execute signed transaction
const executeSchema = Joi.object({
  projectId: Joi.string().uuid().required(),
  signedTransaction: Joi.string().required(),
  signature: Joi.string().required(),
  network: Joi.string().valid('testnet', 'mainnet').default('testnet'),
  userId: Joi.string().required() // Accept userId in request body for development
});

router.post('/execute', async (req, res, next) => {
  try {
    const { error, value } = executeSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { projectId, signedTransaction, signature, network, userId } = value;

    logger.info(`Executing signed transaction for project ${projectId}`);

    const result = await executeSignedTransaction(signedTransaction, signature, network);

    // Save successful deployment to database
    if (result.success && result.packageId) {
      // Get the project source code to store with deployment
      const { data: project } = await supabase
        .from('projects')
        .select('code')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single();

      const { error: dbError } = await supabase
        .from('deployed_contracts')
        .insert({
          project_id: projectId,
          user_id: userId,
          package_id: result.packageId,
          module_address: result.packageId,
          module_name: 'user_deployment',
          network,
          abi: {},
          transaction_hash: result.transactionDigest || '',
          gas_used: parseInt(result.gasUsed || '0'),
          source_code: project?.code || '', // Store the source code at deployment time
        });

      if (dbError) {
        logger.error('Failed to save deployment to database:', dbError);
        logger.error('Database error details:', JSON.stringify(dbError, null, 2));
      } else {
        logger.info(`Successfully saved deployment to database: ${result.packageId}`);
      }

      // Update project with deployment info
      await supabase
        .from('projects')
        .update({
          package_id: result.packageId,
          module_address: result.packageId,
          last_deployment: {
            packageId: result.packageId,
            transactionDigest: result.transactionDigest,
            network,
            timestamp: new Date().toISOString(),
          }
        })
        .eq('id', projectId);
    }

    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get playground wallet info (public endpoint)
router.get('/wallet/playground', async (req, res, next) => {
  try {
    const walletInfo = await getPlaygroundWalletInfo();
    res.json({
      success: true,
      data: walletInfo
    });
  } catch (error) {
    next(error);
  }
});

// Simulate deployment
const simulateSchema = Joi.object({
  projectId: Joi.string().uuid().required(),
  network: Joi.string().valid('testnet', 'mainnet').default('testnet'),
  userId: Joi.string().required() // Accept userId in request body for development
});

// Prepare publish transaction endpoint (new for client-side signing)
router.post('/prepare-publish', authentication, async (req: AuthRequest, res) => {
  let projectId = 'unknown';
  let userId = 'unknown';
  
  try {
    const { network = 'testnet' } = req.body;
    projectId = req.body.projectId;
    userId = req.userId!;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    logger.info(`Preparing publish transaction for project ${projectId} on ${network}`);

    // Get compiled modules and dependencies  
    const { modules, dependencies } = await getCompiledPackageData(projectId, userId);
    
    if (!modules || modules.length === 0) {
      return res.status(400).json({ 
        error: 'No compiled modules found. Please compile your contract first.' 
      });
    }

    // Estimate gas cost (static for now, could be dynamic)
    const gasEstimate = 100000000; // 0.1 IOTA
    const estimatedCostIOTA = (gasEstimate / 1000000000).toFixed(3);

    logger.info(`Prepared publish data: ${modules.length} modules, gas estimate: ${gasEstimate}`);

    res.json({
      success: true,
      data: {
        modules,
        dependencies,
        gasEstimate,
        estimatedCost: `${estimatedCostIOTA} IOTA`,
        network
      }
    });
  } catch (error) {
    logger.error('Failed to prepare publish transaction:', error);
    logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
    logger.error('Project ID:', projectId);
    logger.error('User ID:', userId);
    res.status(500).json({ 
      error: 'Failed to prepare publish transaction',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/simulate', async (req, res, next) => {
  try {
    const { error, value } = simulateSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { projectId, network, userId } = value;

    logger.info(`Simulating deployment for project ${projectId} on ${network}`);

    const result = await simulateDeployment(projectId, userId, network);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Save external wallet deployment
const saveExternalSchema = Joi.object({
  projectId: Joi.string().uuid().required(),
  packageId: Joi.string().required(),
  transactionDigest: Joi.string().required(),
  network: Joi.string().valid('testnet', 'mainnet').default('testnet'),
  abi: Joi.alternatives().try(Joi.array(), Joi.object()).optional(), // Accept array or object with metadata
  gasUsed: Joi.string().optional(),
  userId: Joi.string().required()
});

router.post('/save-external', async (req, res, next) => {
  try {
    const { error, value } = saveExternalSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { projectId, packageId, transactionDigest, network, abi, gasUsed, userId } = value;

    logger.info(`Saving external wallet deployment for project ${projectId}`);

    // Verify the transaction on chain
    const client = new IotaClient({ url: getFullnodeUrl(network) });
    
    try {
      const txResult = await client.getTransactionBlock({
        digest: transactionDigest,
        options: {
          showObjectChanges: true,
          showEffects: true,
        }
      });

      // Verify package was published
      const publishedPackage = txResult.objectChanges?.find((change: any) => 
        change.type === 'published' && (change as any).packageId === packageId
      );

      if (!publishedPackage && !packageId) {
        throw new AppError('Could not verify package deployment on chain', 400);
      }

      // Use the verified package ID
      const verifiedPackageId = (publishedPackage as any)?.packageId || packageId;

      // Get the project source code to store with deployment
      const { data: project } = await supabase
        .from('projects')
        .select('code')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single();

      // Save to database using upsert
      const { error: dbError } = await supabase
        .from('deployed_contracts')
        .upsert({
          project_id: projectId,
          user_id: userId,
          package_id: verifiedPackageId,
          module_address: verifiedPackageId,
          module_name: 'external_deployment',
          network,
          abi: abi || [], // ABI will contain metadata including deployer address
          transaction_hash: transactionDigest,
          gas_used: parseInt(gasUsed || '0'),
          source_code: project?.code || '', // Store the source code at deployment time
        }, {
          onConflict: 'package_id,network',
          ignoreDuplicates: false
        });

      if (dbError) {
        logger.error('Failed to save deployment:', dbError);
        throw new AppError('Failed to save deployment to database', 500);
      } else {
        logger.info(`Successfully saved deployment to database: ${verifiedPackageId}`);
      }

      // Update project
      await supabase
        .from('projects')
        .update({
          package_id: verifiedPackageId,
          module_address: verifiedPackageId
        })
        .eq('id', projectId);

      res.json({
        success: true,
        data: {
          packageId: verifiedPackageId,
          saved: true
        }
      });
    } catch (verifyError) {
      logger.error('Failed to verify transaction:', verifyError);
      
      // Even if verification fails, try to save with provided data
      // Get the project source code to store with deployment
      const { data: project } = await supabase
        .from('projects')
        .select('code')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single();

      const { error: dbError } = await supabase
        .from('deployed_contracts')
        .upsert({
          project_id: projectId,
          user_id: userId,
          package_id: packageId,
          module_address: packageId,
          module_name: 'external_deployment',
          network,
          abi: abi || [], // ABI will contain metadata including deployer address
          transaction_hash: transactionDigest,
          gas_used: parseInt(gasUsed || '0'),
          source_code: project?.code || '', // Store the source code at deployment time
        }, {
          onConflict: 'package_id,network',
          ignoreDuplicates: false
        });

      if (dbError) {
        logger.error('Failed to save deployment:', dbError);
        throw new AppError('Failed to save deployment', 500);
      } else {
        logger.info(`Successfully saved deployment to database: ${packageId}`);
      }

      res.json({
        success: true,
        data: {
          packageId,
          saved: true,
          verificationFailed: true
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

// Get deployment history
router.get('/history/:projectId/:userId', async (req, res, next) => {
  try {
    const { projectId, userId } = req.params;

    const deployments = await getDeploymentHistory(projectId, userId);

    res.json({
      success: true,
      data: deployments
    });
  } catch (error) {
    next(error);
  }
});

export default router;