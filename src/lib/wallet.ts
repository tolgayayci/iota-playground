import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';
import { Transaction } from '@iota/iota-sdk/transactions';
import type { IotaTransactionBlockResponse } from '@iota/iota-sdk/client';

export type NetworkType = 'testnet' | 'mainnet';

export interface WalletInterface {
  address: string;
  signAndExecuteTransaction(transaction: Transaction, client: IotaClient): Promise<IotaTransactionBlockResponse>;
  getAddress(): string;
}

export class PlaygroundWallet implements WalletInterface {
  private keypair: Ed25519Keypair;
  public readonly address: string;

  constructor(privateKey: string) {
    this.keypair = Ed25519Keypair.fromSecretKey(privateKey);
    this.address = this.keypair.getPublicKey().toIotaAddress();
  }

  async signAndExecuteTransaction(
    transaction: Transaction, 
    client: IotaClient
  ): Promise<IotaTransactionBlockResponse> {
    return await client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: transaction,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      }
    });
  }

  getAddress(): string {
    return this.address;
  }
}

export class ExternalWallet implements WalletInterface {
  public readonly address: string;
  private signAndExecuteFn: (transaction: Transaction) => Promise<IotaTransactionBlockResponse>;

  constructor(
    address: string, 
    signAndExecuteFn: (transaction: Transaction) => Promise<IotaTransactionBlockResponse>
  ) {
    this.address = address;
    this.signAndExecuteFn = signAndExecuteFn;
  }

  async signAndExecuteTransaction(
    transaction: Transaction, 
    client: IotaClient
  ): Promise<IotaTransactionBlockResponse> {
    // External wallets handle their own client connection
    return await this.signAndExecuteFn(transaction);
  }

  getAddress(): string {
    return this.address;
  }
}

export function createPlaygroundWallet(): PlaygroundWallet | null {
  const privateKey = import.meta.env.VITE_PLAYGROUND_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    console.warn('Playground wallet private key not found in environment');
    return null;
  }
  return new PlaygroundWallet(privateKey);
}

export function getNetworkConfig(network: NetworkType) {
  return {
    name: network,
    rpcUrl: getFullnodeUrl(network),
    explorerUrl: network === 'testnet' 
      ? 'https://explorer.iota.org'
      : 'https://explorer.iota.org',
    faucetUrl: network === 'testnet' 
      ? 'https://faucet.testnet.iota.org'
      : undefined,
  };
}

export function createIotaClient(network: NetworkType): IotaClient {
  return new IotaClient({ 
    url: getFullnodeUrl(network) 
  });
}