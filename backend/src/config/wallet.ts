/**
 * Playground Wallet Configuration
 * This contains the public address for the playground wallet.
 * The private key is stored securely in environment variables.
 */

export const PLAYGROUND_WALLET_CONFIG = {
  // Public IOTA address for the playground wallet (safe to expose)
  address: '0x0dbf98bc44ca05fefc6c9d43342bccb49e28017b69af0e34d78976be77772004',
  network: 'testnet' as const,
  description: 'IOTA Playground Testnet Wallet',
  explorerUrl: 'https://explorer.iota.org/address/0x0dbf98bc44ca05fefc6c9d43342bccb49e28017b69af0e34d78976be77772004?network=testnet',
  faucetUrl: 'https://faucet.testnet.iota.org',
  rpcUrl: 'https://api.testnet.iota.org',
  gasConfig: {
    gasBudget: 100000000, // 0.1 IOTA
    gasPrice: 1000,
  },
  // Additional metadata
  metadata: {
    created: 'Auto-generated for playground deployments',
    purpose: 'Shared testnet wallet for all playground users',
    warning: 'Do not send real IOTA to this address',
  }
} as const;

// Helper to get the private key from environment (never expose this)
export function getPlaygroundPrivateKey(): string | undefined {
  return process.env.PLAYGROUND_WALLET_PRIVATE_KEY;
}