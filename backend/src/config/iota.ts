import { logger } from '../utils/logger';

export const IOTA_CONFIG = {
  network: process.env.IOTA_NETWORK || 'testnet',
  nodeUrl: process.env.IOTA_NODE_URL || 'https://api.testnet.iota.cafe',
  faucetUrl: process.env.IOTA_FAUCET_URL || 'https://faucet.testnet.iota.cafe',
  explorerUrl: process.env.IOTA_NETWORK === 'mainnet' 
    ? 'https://explorer.iota.org'
    : 'https://explorer.testnet.iota.org',
  gasConfig: {
    maxGasLimit: 50000000,
    gasBudget: 5000000,
    gasPrice: 1000
  }
};

// Dynamic config that reads environment variables at runtime
export function getMoveConfig() {
  return {
    compilerPath: process.env.MOVE_COMPILER_PATH || '/usr/local/bin/iota',
    workspacePath: process.env.COMPILER_WORKSPACE || '/tmp/iota-playground',
    timeout: 30000, // 30 seconds
    maxCodeSize: 1024 * 1024, // 1MB
    supportedVersions: ['2024.1.0', '2024.2.0']
  };
}

export const MOVE_CONFIG = getMoveConfig();

// Verify IOTA CLI is installed
export async function verifyIOTAInstallation(): Promise<boolean> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    const config = getMoveConfig();
    const { stdout } = await execAsync(`${config.compilerPath} --version`);
    logger.info(`IOTA CLI found: ${stdout.trim()}`);
    return true;
  } catch (error) {
    logger.error('IOTA CLI not found. Please install IOTA CLI to enable compilation.');
    return false;
  }
}