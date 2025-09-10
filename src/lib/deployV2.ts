import { Transaction } from '@iota/iota-sdk/transactions';
import { fromB64, toB64 } from '@iota/iota-sdk/utils';
import { IotaClient } from '@iota/iota-sdk/client';
import { supabase } from '@/lib/supabase';

export interface DeploymentRequest {
  projectId: string;
  network: 'testnet' | 'mainnet';
  walletType: 'playground' | 'external';
  senderAddress?: string;
}

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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface PublishData {
  modules: string[];
  dependencies: string[];
  gasEstimate: number;
  estimatedCost: string;
  network: 'testnet' | 'mainnet';
}

/**
 * Check if wallet has sufficient gas balance
 */
export async function checkGasBalance(
  address: string, 
  requiredGas: number,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{ hasEnough: boolean; balance: string; required: string }> {
  try {
    const client = new IotaClient({
      url: network === 'testnet' 
        ? 'https://api.testnet.iota.cafe'
        : 'https://api.mainnet.iota.cafe'
    });
    
    // Get balance for the address
    const balance = await client.getBalance({ owner: address });
    const totalBalance = BigInt(balance.totalBalance || '0');
    const requiredBigInt = BigInt(requiredGas);
    
    return {
      hasEnough: totalBalance >= requiredBigInt,
      balance: (Number(totalBalance) / 1000000000).toFixed(4) + ' IOTA',
      required: (requiredGas / 1000000000).toFixed(4) + ' IOTA'
    };
  } catch (error) {
    console.error('Failed to check gas balance:', error);
    // Return optimistic result if check fails
    return {
      hasEnough: true,
      balance: 'Unknown',
      required: (requiredGas / 1000000000).toFixed(4) + ' IOTA'
    };
  }
}

/**
 * Prepare publish transaction data for client-side signing
 */
export async function preparePublishTransaction(
  projectId: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<PublishData> {
  try {
    // Get the current user session
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    const response = await fetch(`${API_URL}/v2/deploy/prepare-publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        network,
        userId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      const errorMessage = error.error?.message || error.message || error.error || 'Failed to prepare publish transaction';
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to prepare publish transaction:', error);
    throw error;
  }
}

/**
 * Deploy with playground wallet (backend handles everything)
 */
export async function deployWithPlaygroundWallet(
  projectId: string,
  network: 'testnet' = 'testnet'
): Promise<DeploymentResult> {
  try {
    // Get the current user session
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    const response = await fetch(`${API_URL}/v2/deploy/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        network,
        walletType: 'playground',
        userId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      const errorMessage = error.message || error.error || 'Deployment failed';
      
      // Parse specific error types
      if (errorMessage.includes('InsufficientGas') || errorMessage.includes('insufficient gas')) {
        throw new Error('Insufficient gas for deployment. The playground wallet may need funding.');
      } else if (errorMessage.includes('ObjectNotFound')) {
        throw new Error('Required objects not found. Please ensure all dependencies are available.');
      } else if (errorMessage.includes('InvalidTransaction')) {
        throw new Error('Invalid transaction. Please check your contract code.');
      } else {
        throw new Error(errorMessage);
      }
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Deployment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Deployment failed',
      network,
    };
  }
}

/**
 * Prepare transaction for external wallet signing
 */
export async function prepareDeploymentTransaction(
  projectId: string,
  senderAddress: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<PreparedTransaction> {
  try {
    // Get the current user session
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    const response = await fetch(`${API_URL}/v2/deploy/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        network,
        walletType: 'external',
        senderAddress,
        userId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to prepare transaction');
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to prepare transaction:', error);
    throw error;
  }
}

/**
 * Execute signed transaction on backend
 */
export async function executeSignedTransaction(
  projectId: string,
  signedTransaction: string,
  signature: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<DeploymentResult> {
  try {
    // Get the current user session
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    const response = await fetch(`${API_URL}/v2/deploy/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        signedTransaction,
        signature,
        network,
        userId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to execute transaction');
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to execute transaction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute transaction',
      network,
    };
  }
}

/**
 * Create a Transaction object from transaction bytes
 * This is used when we need to sign with the wallet
 */
export function transactionFromBytes(bytes: string): Transaction {
  const txBytes = fromB64(bytes);
  // Transaction doesn't have a direct fromBytes method, 
  // so we'll need to handle this differently
  // For now, we'll return a placeholder
  return new Transaction();
}

/**
 * Simulate deployment transaction
 */
export async function simulateDeployment(
  projectId: string,
  userId: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<any> {
  try {
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(`${API_URL}/v2/deploy/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        network,
        userId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      // Return error instead of throwing to maintain consistent return structure
      return {
        success: false,
        error: error.message || error.error?.message || 'Simulation failed',
        network,
      };
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Simulation error:', error);
    
    // Handle timeout errors specifically
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: 'Simulation timed out after 30 seconds. Please try again.',
        network,
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Simulation failed',
      network,
    };
  }
}

/**
 * Get deployment history for a project
 */
export async function getDeploymentHistory(projectId: string): Promise<any[]> {
  try {
    // Get the current user session
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    const response = await fetch(`${API_URL}/v2/deploy/history/${projectId}/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch deployment history');
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Failed to fetch deployment history:', error);
    return [];
  }
}