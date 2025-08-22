import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
import { Transaction } from '@iota/iota-sdk/transactions';
import { fromB64, toB64 } from '@iota/iota-sdk/utils';
import { PLAYGROUND_WALLET_CONFIG, getPlaygroundPrivateKey } from '../config/wallet';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { supabase } from '../config/database';

export interface DeploymentResult {
  success: boolean;
  packageId?: string;
  modules?: string[];
  transactionDigest?: string;
  gasUsed?: string;
  gasCost?: string;
  error?: string;
  network: 'testnet' | 'mainnet';
  explorerUrl?: string;
  objectChanges?: any[];
}

export interface PreparedTransaction {
  transactionBytes: string;
  gasBudget: number;
  estimatedGas?: number;
  network: 'testnet' | 'mainnet';
}

/**
 * Get compiled modules and dependencies from the last successful compilation
 * This works with both database projects and filesystem-based compilation
 */
export async function getCompiledPackageData(projectId: string, userId: string) {
  logger.info(`Getting compiled package data for project ${projectId}, user ${userId}`);
  
  // First try to get from filesystem (for development/testing)
  try {
    logger.info('Attempting to import compileService...');
    const { getBytecodeForDeployment } = await import('./compileService');
    logger.info('compileService imported successfully');
    
    logger.info('Calling getBytecodeForDeployment...');
    const filesystemData = await getBytecodeForDeployment(userId, projectId);
    logger.info(`Filesystem data retrieved:`, filesystemData ? 'success' : 'null');
    
    if (filesystemData.modules && filesystemData.modules.length > 0) {
      logger.info(`Returning filesystem data with ${filesystemData.modules.length} modules`);
      return {
        modules: filesystemData.modules,
        dependencies: filesystemData.dependencies || ['0x1', '0x2'],
        code: '' // Not needed for deployment
      };
    }
  } catch (fsError) {
    logger.info(`Filesystem compilation not found, checking database: ${fsError.message}`);
    logger.error('Filesystem error details:', fsError);
  }

  logger.info('Falling back to database approach...');
  
  // Fallback to database approach
  const { data: project, error } = await supabase
    .from('projects')
    .select('last_compilation_result, code')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  logger.info(`Database query result: project=${!!project}, error=${!!error}`);
  
  if (error) {
    logger.error('Database error:', error);
    throw new AppError('Project not found and no compiled modules available', 404);
  }
  
  if (!project) {
    logger.error('No project found in database');
    throw new AppError('Project not found and no compiled modules available', 404);
  }

  logger.info(`Project compilation result:`, project.last_compilation_result ? 'exists' : 'missing');
  
  if (!project.last_compilation_result?.success) {
    logger.error('Project compilation was not successful');
    throw new AppError('Project must be compiled successfully before deployment', 400);
  }

  const modules = project.last_compilation_result.modules || [];
  logger.info(`Returning database data with ${modules.length} modules`);

  return {
    modules,
    dependencies: project.last_compilation_result.dependencies || ['0x1', '0x2'],
    code: project.code
  };
}

/**
 * Deploy using playground wallet (backend keypair)
 */
export async function deployWithPlaygroundWallet(
  projectId: string,
  userId: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<DeploymentResult> {
  try {
    if (network !== 'testnet') {
      throw new AppError('Playground wallet only supports testnet', 400);
    }

    logger.info(`Deploying project ${projectId} with playground wallet`);

    // Get compiled package data
    const { modules, dependencies } = await getCompiledPackageData(projectId, userId);

    // Initialize IOTA client
    const client = new IotaClient({ url: getFullnodeUrl(network) });
    
    // Get playground wallet keypair
    const privateKey = getPlaygroundPrivateKey();
    if (!privateKey) {
      throw new AppError('Playground wallet not configured', 500);
    }

    const keypair = Ed25519Keypair.fromSecretKey(privateKey);
    const address = keypair.getPublicKey().toIotaAddress();
    
    logger.info(`Expected address: 0x83ea9aa6ffc1547bb7a3aa7e31b98c7adb62f477c6f087ef909e4359cddaca57`);
    logger.info(`Keypair derived address: ${address}`);

    logger.info(`Using playground wallet address: ${address}`);

    // Create publish transaction
    const tx = new Transaction();
    
    // Convert base64 modules to Uint8Array
    const moduleBytes = modules.map((m: string) => fromB64(m));
    
    // Convert dependencies to proper format
    // IOTA standard library package IDs
    const iotaDependencies = dependencies.map(dep => {
      if (dep === '0x1') return '0x0000000000000000000000000000000000000000000000000000000000000001';
      if (dep === '0x2') return '0x0000000000000000000000000000000000000000000000000000000000000002';
      return dep;
    });
    
    logger.info(`Publishing with ${moduleBytes.length} modules and ${iotaDependencies.length} dependencies`);
    logger.info(`Dependencies:`, iotaDependencies);
    
    // Publish the package
    const [upgradeCap] = tx.publish({
      modules: moduleBytes,
      dependencies: iotaDependencies,
    });
    
    // Transfer upgrade capability to the sender
    tx.transferObjects([upgradeCap], address);
    
    // Set gas budget
    tx.setGasBudget(1000000000); // 1 IOTA

    // Sign and execute transaction
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      }
    });

    logger.info(`Deployment result:`, JSON.stringify(result, null, 2));

    // Extract package ID from object changes
    const publishedPackage = result.objectChanges?.find((change: any) => 
      change.type === 'published'
    );

    logger.info(`Published package:`, publishedPackage);
    logger.info(`Object changes:`, result.objectChanges);

    if (!publishedPackage) {
      logger.error(`No published package found. Object changes:`, result.objectChanges);
      throw new AppError(`Failed to extract package ID from deployment. Object changes: ${JSON.stringify(result.objectChanges)}`, 500);
    }

    const explorerUrl = network === 'testnet'
      ? `https://explorer.iota.org/object/${publishedPackage.packageId}?network=testnet`
      : `https://explorer.iota.org/object/${publishedPackage.packageId}?network=mainnet`;

    return {
      success: true,
      packageId: publishedPackage.packageId,
      modules: publishedPackage.modules || [],
      transactionDigest: result.digest,
      gasUsed: result.effects?.gasUsed?.computationCost || '0',
      gasCost: result.effects?.gasUsed?.storageCost || '0',
      network,
      explorerUrl,
      objectChanges: result.objectChanges,
    };
  } catch (error: any) {
    logger.error('Deployment error:', error);
    
    if (error instanceof AppError) {
      throw error;
    }

    return {
      success: false,
      error: error.message || 'Deployment failed',
      network,
    };
  }
}

/**
 * Prepare transaction for external wallet signing
 */
export async function prepareDeploymentTransaction(
  projectId: string,
  userId: string,
  senderAddress: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<PreparedTransaction> {
  try {
    logger.info(`Preparing deployment transaction for project ${projectId}`);

    // Get compiled package data
    const { modules, dependencies } = await getCompiledPackageData(projectId, userId);

    // Initialize IOTA client
    const client = new IotaClient({ url: getFullnodeUrl(network) });

    // Create publish transaction
    const tx = new Transaction();
    
    // Convert base64 modules to Uint8Array
    const moduleBytes = modules.map((m: string) => fromB64(m));
    
    // Publish the package
    const [upgradeCap] = tx.publish({
      modules: moduleBytes,
      dependencies: dependencies || [],
    });
    
    // Transfer upgrade capability to the sender
    tx.transferObjects([upgradeCap], senderAddress);
    
    // Set gas budget (user can override this)
    const gasBudget = 1000000000; // 1 IOTA
    tx.setGasBudget(gasBudget);
    tx.setSender(senderAddress);

    // Build transaction bytes
    const txBytes = await tx.build({ client });
    
    // Dry run to estimate gas
    const dryRunResult = await client.dryRunTransactionBlock({
      transactionBlock: toB64(txBytes),
    });

    const estimatedGas = dryRunResult.effects?.gasUsed?.computationCost 
      ? parseInt(dryRunResult.effects.gasUsed.computationCost)
      : gasBudget;

    return {
      transactionBytes: toB64(txBytes),
      gasBudget,
      estimatedGas,
      network,
    };
  } catch (error: any) {
    logger.error('Failed to prepare transaction:', error);
    throw new AppError(
      error.message || 'Failed to prepare deployment transaction',
      500
    );
  }
}

/**
 * Execute a signed transaction
 */
export async function executeSignedTransaction(
  signedTransaction: string,
  signature: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<DeploymentResult> {
  try {
    logger.info('Executing signed transaction');

    // Initialize IOTA client
    const client = new IotaClient({ url: getFullnodeUrl(network) });

    // Execute the signed transaction
    const result = await client.executeTransactionBlock({
      transactionBlock: signedTransaction,
      signature,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      }
    });

    logger.info('Transaction execution result:', result);

    // Extract package ID from object changes
    const publishedPackage = result.objectChanges?.find((change: any) => 
      change.type === 'published'
    );

    if (!publishedPackage) {
      throw new AppError('Failed to extract package ID from deployment', 500);
    }

    const explorerUrl = network === 'testnet'
      ? `https://explorer.iota.org/object/${publishedPackage.packageId}?network=testnet`
      : `https://explorer.iota.org/object/${publishedPackage.packageId}?network=mainnet`;

    return {
      success: true,
      packageId: publishedPackage.packageId,
      modules: publishedPackage.modules || [],
      transactionDigest: result.digest,
      gasUsed: result.effects?.gasUsed?.computationCost || '0',
      gasCost: result.effects?.gasUsed?.storageCost || '0',
      network,
      explorerUrl,
      objectChanges: result.objectChanges,
    };
  } catch (error: any) {
    logger.error('Failed to execute transaction:', error);
    
    return {
      success: false,
      error: error.message || 'Failed to execute transaction',
      network,
    };
  }
}

/**
 * Get deployment history for a project
 */
export async function getDeploymentHistory(projectId: string, userId: string) {
  const { data, error } = await supabase
    .from('deployed_contracts')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError('Failed to fetch deployment history', 500);
  }

  return data || [];
}