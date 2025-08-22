// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
export const MOVE_COMPILER_API = import.meta.env.VITE_MOVE_COMPILER_API;
export const MOVE_COMPILER_KEY = import.meta.env.VITE_MOVE_COMPILER_KEY;

// IOTA Network Configuration
export const IOTA_NETWORKS = {
  testnet: {
    name: "IOTA Testnet",
    rpc: import.meta.env.VITE_IOTA_TESTNET_RPC,
    explorer: import.meta.env.VITE_IOTA_TESTNET_EXPLORER,
    faucet: import.meta.env.VITE_IOTA_TESTNET_FAUCET,
  },
  mainnet: {
    name: "IOTA Mainnet",
    rpc: import.meta.env.VITE_IOTA_MAINNET_RPC,
    explorer: import.meta.env.VITE_IOTA_MAINNET_EXPLORER,
    faucet: null,
  },
} as const;

export const DEFAULT_NETWORK = import.meta.env.VITE_DEFAULT_NETWORK as 'testnet' | 'mainnet';

// Legacy Blockchain Configuration (for transition period)
export const BLOCKCHAIN_CONFIG = {
  arbitrumSepolia: {
    rpc: import.meta.env.VITE_ARB_SEPOLIA_RPC_URL || '',
    chainId: parseInt(import.meta.env.VITE_ARB_SEPOLIA_CHAIN_ID || '0'),
    name: "Superposition Testnet",
    explorerUrl: import.meta.env.VITE_ARB_SEPOLIA_EXPLORER_URL || '',
  },
} as const;

// Analytics Configuration
export const GA_TRACKING_ID = import.meta.env.VITE_GA_TRACKING_ID;

// Application Configuration
export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME || "IOTA Playground",
} as const;

// Application URLs
export const APP_URLS = {
  base: import.meta.env.VITE_APP_URL,
  docs: import.meta.env.VITE_DOCS_URL,
  telegram: import.meta.env.VITE_TELEGRAM_URL,
  discord: import.meta.env.VITE_DISCORD_URL,
} as const;

// Services
export const SERVICES = {
  avatar: import.meta.env.VITE_AVATAR_SERVICE_URL,
} as const;

// Supabase Configuration
export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
} as const;

// Environment validation
function validateEnvironment() {
  const requiredVars = {
    VITE_SUPABASE_URL: SUPABASE_CONFIG.url,
    VITE_SUPABASE_ANON_KEY: SUPABASE_CONFIG.anonKey,
  };

  const missingVars: string[] = [];
  
  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value || value === 'undefined' || value === '') {
      missingVars.push(key);
    }
  }

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    console.error('Please check your .env file and ensure these variables are set.');
    return false;
  }

  console.log('✅ Environment validation passed');
  return true;
}

// Run validation on module load
export const ENV_VALID = validateEnvironment();

// IOTA Explorer helper functions
export function getIotaExplorerTxUrl(txHash: string, network: 'testnet' | 'mainnet' = DEFAULT_NETWORK): string {
  return `${IOTA_NETWORKS[network].explorer}/txblock/${txHash}`;
}

export function getIotaExplorerAddressUrl(address: string, network: 'testnet' | 'mainnet' = DEFAULT_NETWORK): string {
  return `${IOTA_NETWORKS[network].explorer}/address/${address}`;
}

export function getIotaExplorerModuleUrl(packageId: string, network: 'testnet' | 'mainnet' = DEFAULT_NETWORK): string {
  return `${IOTA_NETWORKS[network].explorer}/object/${packageId}`;
}

// Legacy helper functions (for transition period)
export function getExplorerTxUrl(txHash: string): string {
  return `${BLOCKCHAIN_CONFIG.arbitrumSepolia.explorerUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string): string {
  return `${BLOCKCHAIN_CONFIG.arbitrumSepolia.explorerUrl}/address/${address}`;
}

// Helper function to get avatar URL
export function getAvatarUrl(seed: string): string {
  return `${SERVICES.avatar}/${seed}`;
}