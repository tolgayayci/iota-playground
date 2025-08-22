import { Transaction } from '@iota/iota-sdk/transactions';
import { fromB64 } from '@iota/iota-sdk/utils';
import { useSignAndExecuteTransaction } from '@iota/dapp-kit';

export interface CompileResult {
  modules: string[]; // Base64 encoded module bytecode
  dependencies: string[]; // Package IDs of dependencies
  digest: string;
}

export interface DeploymentRequest {
  compiledModules: string[]; // Base64 encoded bytecode
  dependencies: string[]; // Dependency package IDs
  network: 'testnet' | 'mainnet';
}

export interface DeploymentResult {
  success: boolean;
  packageId?: string;
  publishedAt?: string;
  modules?: string[];
  transactionDigest?: string;
  error?: string;
  explorerUrl?: string;
}

/**
 * Create a transaction for publishing a Move package
 */
export function createPublishTransaction(
  modules: string[],
  dependencies: string[]
): Transaction {
  const tx = new Transaction();
  
  // Convert base64 modules to Uint8Array
  const moduleBytes = modules.map(m => fromB64(m));
  
  // Add publish transaction
  const [upgradeCap] = tx.publish({
    modules: moduleBytes,
    dependencies: dependencies,
  });
  
  // Transfer the upgrade capability to the sender
  tx.transferObjects([upgradeCap], tx.pure.address(tx.gas));
  
  return tx;
}

/**
 * Get bytecode and dependencies from backend compilation
 */
export async function getCompiledPackage(
  projectId: string,
  userId: string
): Promise<CompileResult> {
  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/compile/bytecode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId,
      userId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get compiled bytecode');
  }

  const data = await response.json();
  
  if (!data.modules || !Array.isArray(data.modules)) {
    throw new Error('Invalid compilation result: missing modules');
  }

  return {
    modules: data.modules,
    dependencies: data.dependencies || [],
    digest: data.digest || '',
  };
}

/**
 * Execute signed transaction on the backend
 */
export async function executeSignedTransaction(
  signedTransaction: string,
  signature: string,
  network: 'testnet' | 'mainnet'
): Promise<DeploymentResult> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/deploy/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signedTransaction,
        signature,
        network,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || 'Failed to execute transaction',
      };
    }

    const result = await response.json();
    
    // Get explorer URL based on network
    const explorerBaseUrl = 'https://explorer.iota.org';
    const networkParam = network === 'testnet' ? '?network=testnet' : '?network=mainnet';
    
    return {
      success: true,
      packageId: result.packageId,
      publishedAt: result.publishedAt,
      modules: result.modules,
      transactionDigest: result.digest,
      explorerUrl: `${explorerBaseUrl}/txblock/${result.digest}${networkParam}`,
    };
  } catch (error) {
    console.error('Failed to execute transaction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute transaction',
    };
  }
}

/**
 * Prepare deployment transaction
 * This creates the transaction but doesn't sign it
 */
export async function prepareDeployment(
  projectId: string,
  userId: string
): Promise<{ tx: Transaction; modules: string[]; dependencies: string[] }> {
  // Get compiled bytecode from backend
  const { modules, dependencies } = await getCompiledPackage(projectId, userId);
  
  // Create publish transaction
  const tx = createPublishTransaction(modules, dependencies);
  
  return { tx, modules, dependencies };
}

/**
 * Deploy using playground wallet (for testnet only)
 * This simulates deployment without a real wallet extension
 */
export async function deployWithPlaygroundWallet(
  projectId: string,
  userId: string,
  playgroundAddress: string
): Promise<DeploymentResult> {
  try {
    // Get compiled bytecode
    const { modules, dependencies } = await getCompiledPackage(projectId, userId);
    
    // Create transaction
    const tx = createPublishTransaction(modules, dependencies);
    
    // For playground wallet, we'll send the transaction to backend
    // which will use a server-side keypair for testnet
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/deploy/playground`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        userId,
        modules,
        dependencies,
        senderAddress: playgroundAddress,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || 'Failed to deploy with playground wallet',
      };
    }

    const result = await response.json();
    
    return {
      success: true,
      packageId: result.packageId,
      publishedAt: result.publishedAt,
      modules: result.modules,
      transactionDigest: result.digest,
      explorerUrl: `https://explorer.iota.org/txblock/${result.digest}?network=testnet`,
    };
  } catch (error) {
    console.error('Failed to deploy with playground wallet:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deploy',
    };
  }
}