import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MOVE_CONFIG, IOTA_CONFIG } from '../config/iota';
import { PLAYGROUND_WALLET_CONFIG } from '../config/wallet';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface DeploymentResult {
  success: boolean;
  contract_address?: string;
  package_id?: string;
  module_ids?: string[];
  transaction_hash?: string;
  gas_used?: number;
  gas_cost?: number;
  error?: string;
  network: 'testnet' | 'mainnet';
  explorer_url?: string;
}

async function createDeploymentProject(projectPath: string, code: string): Promise<void> {
  // Create project structure
  await mkdir(path.join(projectPath, 'sources'), { recursive: true });
  
  // Create Move.toml for deployment
  const moveToml = `[package]
name = "playground_deployment"
edition = "2024.beta"

[dependencies]
Iota = { git = "https://github.com/iotaledger/iota.git", subdir = "crates/iota-framework/packages/iota-framework", rev = "framework/testnet" }

[addresses]
playground = "0x0"
`;
  
  await writeFile(path.join(projectPath, 'Move.toml'), moveToml);
  
  // Write the Move source code
  await writeFile(path.join(projectPath, 'sources', 'module.move'), code);
}

async function getOrCreateWallet(userId: string): Promise<string> {
  // For production, you should properly manage wallets per user
  // This is a simplified version for development
  const walletPath = path.join(MOVE_CONFIG.workspacePath, 'wallets', `${userId}.keystore`);
  
  try {
    // Check if wallet exists
    await readFile(walletPath);
    return walletPath;
  } catch {
    // Create new wallet if doesn't exist
    await mkdir(path.dirname(walletPath), { recursive: true });
    
    const { stdout } = await execAsync(
      `${MOVE_CONFIG.compilerPath} keytool generate ed25519 --json`,
      { timeout: 10000 }
    );
    
    await writeFile(walletPath, stdout);
    
    // Request testnet tokens from faucet
    if (IOTA_CONFIG.network === 'testnet') {
      try {
        const keyData = JSON.parse(stdout);
        await requestTestnetTokens(keyData.address);
      } catch (error) {
        logger.warn('Failed to request testnet tokens:', error);
      }
    }
    
    return walletPath;
  }
}

async function requestTestnetTokens(address: string): Promise<void> {
  try {
    const response = await fetch(IOTA_CONFIG.faucetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });
    
    if (!response.ok) {
      throw new Error(`Faucet request failed: ${response.statusText}`);
    }
    
    logger.info(`Requested testnet tokens for address: ${address}`);
  } catch (error) {
    logger.error('Failed to request testnet tokens:', error);
  }
}

export async function getPlaygroundWalletInfo() {
  // Return full wallet configuration (all public info)
  return {
    address: PLAYGROUND_WALLET_CONFIG.address,
    network: PLAYGROUND_WALLET_CONFIG.network,
    description: PLAYGROUND_WALLET_CONFIG.description,
    explorerUrl: PLAYGROUND_WALLET_CONFIG.explorerUrl,
    faucetUrl: PLAYGROUND_WALLET_CONFIG.faucetUrl,
    rpcUrl: PLAYGROUND_WALLET_CONFIG.rpcUrl,
    gasConfig: PLAYGROUND_WALLET_CONFIG.gasConfig,
    metadata: PLAYGROUND_WALLET_CONFIG.metadata,
  };
}

// Keep for backward compatibility
export async function getPlaygroundWalletAddress(): Promise<string> {
  return PLAYGROUND_WALLET_CONFIG.address;
}

export async function deployToIOTA(
  code: string,
  projectId: string,
  userId: string,
  network: 'testnet' | 'mainnet'
): Promise<DeploymentResult> {
  const projectPath = path.join(MOVE_CONFIG.workspacePath, `deploy_${userId}_${projectId}_${uuidv4()}`);
  
  try {
    // Create deployment project
    await mkdir(projectPath, { recursive: true });
    await createDeploymentProject(projectPath, code);
    
    // Get or create user wallet
    const walletPath = await getOrCreateWallet(userId);
    
    logger.info(`Deploying Move project to ${network} from: ${projectPath}`);
    
    // Build the project first
    const buildCommand = `${MOVE_CONFIG.compilerPath} move build --path ${projectPath} --skip-fetch-latest-git-deps`;
    const { stderr: buildError } = await execAsync(buildCommand, {
      timeout: MOVE_CONFIG.timeout
    });
    
    if (buildError && buildError.includes('error')) {
      throw new AppError(`Build failed: ${buildError}`, 400, 'BUILD_FAILED');
    }
    
    // Deploy the package
    const deployCommand = `${MOVE_CONFIG.compilerPath} client publish \\
      --path ${projectPath} \\
      --gas-budget ${IOTA_CONFIG.gasConfig.gasBudget} \\
      --json`;
    
    const { stdout, stderr } = await execAsync(deployCommand, {
      timeout: 60000, // 60 seconds for deployment
      env: {
        ...process.env,
        IOTA_KEYSTORE: walletPath,
        IOTA_NETWORK: network
      }
    });
    
    if (stderr && stderr.includes('error')) {
      throw new AppError(`Deployment failed: ${stderr}`, 400, 'DEPLOYMENT_FAILED');
    }
    
    // Parse deployment result
    let deploymentData: any = {};
    try {
      deploymentData = JSON.parse(stdout);
    } catch {
      // If not JSON, try to extract information from text output
      const packageIdMatch = stdout.match(/Package ID: (0x[a-f0-9]+)/i);
      const txHashMatch = stdout.match(/Transaction Hash: (0x[a-f0-9]+)/i);
      const gasMatch = stdout.match(/Gas Used: (\d+)/i);
      
      deploymentData = {
        packageId: packageIdMatch?.[1],
        transactionHash: txHashMatch?.[1],
        gasUsed: gasMatch ? parseInt(gasMatch[1]) : undefined
      };
    }
    
    const explorerUrl = `${IOTA_CONFIG.explorerUrl}/package/${deploymentData.packageId || deploymentData.package_id}`;
    
    return {
      success: true,
      package_id: deploymentData.packageId || deploymentData.package_id,
      module_ids: deploymentData.modules || [],
      transaction_hash: deploymentData.transactionHash || deploymentData.digest,
      gas_used: deploymentData.gasUsed || deploymentData.gas_used,
      gas_cost: deploymentData.gasCost || deploymentData.gas_cost,
      network,
      explorer_url: explorerUrl
    };
  } catch (error: any) {
    logger.error('Deployment error:', error);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    return {
      success: false,
      error: error.message || 'Deployment failed',
      network
    };
  } finally {
    // Clean up temporary directory
    try {
      await rm(projectPath, { recursive: true, force: true });
    } catch (error) {
      logger.warn(`Failed to clean up deployment directory ${projectPath}:`, error);
    }
  }
}