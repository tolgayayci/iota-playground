import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';
import { Transaction } from '@iota/iota-sdk/transactions';
import { fromB64, toB64 } from '@iota/iota-sdk/utils';
import { getPlaygroundPrivateKey } from '../config/wallet';
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface SimulationResult {
  success: boolean;
  effects?: {
    gasUsed: {
      computationCost: string;
      storageCost: string;
      storageRebate?: string;
    };
  };
  objectChanges?: Array<{
    type: string;
    packageId?: string;
    modules?: string[];
  }>;
  error?: string;
  network: 'testnet' | 'mainnet';
}

/**
 * Get compiled modules and dependencies from the last successful compilation
 */
async function getCompiledPackageData(projectId: string, userId: string) {
  // Import the function from compileService to get bytecode
  const { getBytecodeForDeployment } = await import('./compileService');
  
  logger.info(`Getting compiled package data for simulation: project ${projectId}, user ${userId}`);
  
  const bytecodeData = await getBytecodeForDeployment(userId, projectId);
  
  if (!bytecodeData.modules || bytecodeData.modules.length === 0) {
    throw new AppError('Project must be compiled successfully before simulation', 400);
  }

  return {
    modules: bytecodeData.modules,
    dependencies: bytecodeData.dependencies || ['0x1', '0x2'],
    code: '' // Not needed for simulation
  };
}

/**
 * Simulate deployment transaction
 */
export async function simulateDeployment(
  projectId: string,
  userId: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<SimulationResult> {
  try {
    logger.info(`Simulating deployment for project ${projectId} on ${network}`);

    // Get compiled package data
    const { modules, dependencies } = await getCompiledPackageData(projectId, userId);

    // Get playground wallet keypair
    const privateKey = getPlaygroundPrivateKey();
    if (!privateKey) {
      throw new AppError('Playground wallet not configured', 500);
    }

    // Initialize IOTA client
    const client = new IotaClient({ url: getFullnodeUrl(network) });
    
    const keypair = Ed25519Keypair.fromSecretKey(privateKey);
    const address = keypair.getPublicKey().toIotaAddress();

    logger.info(`Using playground wallet address for simulation: ${address}`);

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
    tx.transferObjects([upgradeCap], address);
    
    // Set gas budget
    tx.setGasBudget(1000000000); // 1 IOTA
    tx.setSender(address);

    // Build transaction for dry run
    const txBytes = await tx.build({ client });
    
    // Perform dry run simulation
    const dryRunResult = await client.dryRunTransactionBlock({
      transactionBlock: toB64(txBytes),
    });

    logger.info(`Simulation result:`, dryRunResult);

    if (dryRunResult.effects?.status?.status === 'failure') {
      const errorMessage = dryRunResult.effects?.status?.error || 'Simulation failed';
      return {
        success: false,
        error: errorMessage,
        network,
      };
    }

    // Extract simulation results
    const effects = {
      gasUsed: {
        computationCost: dryRunResult.effects?.gasUsed?.computationCost || '0',
        storageCost: dryRunResult.effects?.gasUsed?.storageCost || '0',
        storageRebate: dryRunResult.effects?.gasUsed?.storageRebate || '0',
      }
    };

    // Extract object changes
    const objectChanges = dryRunResult.objectChanges?.map((change: any) => ({
      type: change.type,
      packageId: change.packageId,
      modules: change.modules,
    })) || [];

    return {
      success: true,
      effects,
      objectChanges,
      network,
    };
  } catch (error: any) {
    logger.error('Simulation error:', error);
    
    if (error instanceof AppError) {
      throw error;
    }

    return {
      success: false,
      error: error.message || 'Simulation failed',
      network,
    };
  }
}