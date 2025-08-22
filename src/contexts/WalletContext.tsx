import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { 
  createNetworkConfig, 
  IotaClientProvider, 
  WalletProvider as IotaWalletProvider,
  useCurrentAccount,
  useWallets,
  useConnectWallet,
  useDisconnectWallet,
  useSwitchAccount,
  useAccounts,
  useSignAndExecuteTransaction,
} from '@iota/dapp-kit';
import { getFullnodeUrl } from '@iota/iota-sdk/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  WalletInterface, 
  PlaygroundWallet, 
  ExternalWallet, 
  NetworkType, 
  createPlaygroundWallet,
  createIotaClient,
  getNetworkConfig
} from '@/lib/wallet';
import { Transaction } from '@iota/iota-sdk/transactions';

// Create network configuration
const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
});

// Create query client
const queryClient = new QueryClient();

// Wallet context interface
interface WalletContextType {
  // Current wallet state
  currentWallet: WalletInterface | null;
  isConnected: boolean;
  network: NetworkType;
  
  // Playground wallet properties
  isPlaygroundWallet: boolean;
  playgroundAddress: string | null;
  
  // Network management
  switchNetwork: (network: NetworkType) => void;
  
  // Wallet validation
  isNetworkCompatible: (network: NetworkType) => boolean;
  
  // Wallet management
  connectPlaygroundWallet: () => Promise<void>;
  connectExternalWallet: (walletName?: string) => Promise<void>;
  disconnectWallet: () => void;
  
  // Transaction execution
  signAndExecuteTransaction: (transaction: Transaction) => Promise<any>;
  
  // External wallet integration
  availableWallets: ReturnType<typeof useWallets>;
  currentAccount: ReturnType<typeof useCurrentAccount>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Hook to use wallet context
export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}

// Inner component that has access to wallet hooks
function WalletContextProvider({ children }: { children: ReactNode }) {
  const [currentWallet, setCurrentWallet] = useState<WalletInterface | null>(null);
  const [network, setNetwork] = useState<NetworkType>('testnet');
  const { toast } = useToast();

  // External wallet hooks
  const currentAccount = useCurrentAccount();
  const wallets = useWallets();
  const accounts = useAccounts();
  const { mutate: connectWallet } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();
  const { mutate: switchAccount } = useSwitchAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // Create IOTA client for current network
  const client = createIotaClient(network);

  // Consolidated wallet initialization - handles both playground and external wallets
  useEffect(() => {
    let isStale = false;

    const initializeWallet = async () => {
      // Load saved network first
      const savedNetwork = localStorage.getItem('iota_network') as NetworkType;
      if (savedNetwork && (savedNetwork === 'testnet' || savedNetwork === 'mainnet')) {
        if (!isStale) setNetwork(savedNetwork);
      }

      const savedWalletType = localStorage.getItem('iota_wallet_type');

      // Handle external wallet connection
      if (currentAccount && currentAccount.address && !isStale) {
        const externalWallet = new ExternalWallet(
          currentAccount.address,
          async (transaction: Transaction) => {
            return new Promise((resolve, reject) => {
              signAndExecute(
                {
                  transaction,
                  chain: network === 'testnet' ? 'iota:testnet' : 'iota:mainnet',
                },
                {
                  onSuccess: (result) => resolve(result),
                  onError: (error) => reject(error),
                }
              );
            });
          }
        );
        
        setCurrentWallet(externalWallet);
        localStorage.setItem('iota_wallet_type', 'external');
      }
      // Handle playground wallet connection (only if no external wallet is connected)
      else if (savedWalletType === 'playground' && !currentAccount && !isStale) {
        const playgroundWallet = createPlaygroundWallet();
        if (playgroundWallet) {
          setCurrentWallet(playgroundWallet);
        }
      }
      // Clear wallet if no valid connection
      else if (!currentAccount && savedWalletType !== 'playground' && !isStale) {
        setCurrentWallet(null);
        localStorage.removeItem('iota_wallet_type');
      }
    };

    initializeWallet();

    return () => {
      isStale = true;
    };
  }, [currentAccount, signAndExecute, network]);

  const isNetworkCompatible = (targetNetwork: NetworkType): boolean => {
    // Playground wallet only supports testnet
    if (isPlaygroundWallet && targetNetwork === 'mainnet') {
      return false;
    }
    // External wallets support both networks
    return true;
  };

  const switchNetwork = (newNetwork: NetworkType) => {
    // Validate network compatibility before switching
    if (!isNetworkCompatible(newNetwork)) {
      toast({
        title: "Network Not Supported",
        description: "Playground wallet only supports testnet",
        variant: "destructive",
      });
      return;
    }

    setNetwork(newNetwork);
    localStorage.setItem('iota_network', newNetwork);
    
    toast({
      title: "Network Switched",
      description: `Switched to ${newNetwork}`,
    });
  };

  const connectPlaygroundWallet = async () => {
    if (network !== 'testnet') {
      toast({
        title: "Testnet Required",
        description: "Playground wallet is only available on testnet",
        variant: "destructive",
      });
      return;
    }

    try {
      const playgroundWallet = createPlaygroundWallet();
      if (!playgroundWallet) {
        throw new Error('Failed to create playground wallet');
      }

      setCurrentWallet(playgroundWallet);
      localStorage.setItem('iota_wallet_type', 'playground');
      
      toast({
        title: "Playground Wallet Connected",
        description: `Address: ${playgroundWallet.address.slice(0, 10)}...`,
      });
    } catch (error) {
      console.error('Failed to connect playground wallet:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect playground wallet",
        variant: "destructive",
      });
    }
  };

  const connectExternalWallet = async (walletName?: string) => {
    try {
      if (walletName) {
        const wallet = wallets.find(w => w.name === walletName);
        if (wallet) {
          connectWallet({ wallet });
        }
      } else {
        // Connect to first available wallet
        const firstWallet = wallets[0];
        if (firstWallet) {
          connectWallet({ wallet: firstWallet });
        }
      }
    } catch (error) {
      console.error('Failed to connect external wallet:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect external wallet",
        variant: "destructive",
      });
    }
  };

  const disconnectWallet = () => {
    if (currentAccount) {
      disconnect();
    }
    setCurrentWallet(null);
    localStorage.removeItem('iota_wallet_type');
    
    toast({
      title: "Wallet Disconnected",
      description: "Wallet has been disconnected",
    });
  };

  const executeTransaction = async (transaction: Transaction) => {
    if (!currentWallet) {
      throw new Error('No wallet connected');
    }

    return await currentWallet.signAndExecuteTransaction(transaction, client);
  };

  // Compute playground wallet properties
  const isPlaygroundWallet = currentWallet instanceof PlaygroundWallet;
  const playgroundAddress = isPlaygroundWallet ? currentWallet.address : null;

  const value: WalletContextType = {
    currentWallet,
    isConnected: !!currentWallet,
    network,
    isPlaygroundWallet,
    playgroundAddress,
    switchNetwork,
    isNetworkCompatible,
    connectPlaygroundWallet,
    connectExternalWallet,
    disconnectWallet,
    signAndExecuteTransaction: executeTransaction,
    availableWallets: wallets,
    currentAccount,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// Dynamic provider component that manages network state
function DynamicIotaProvider({ children }: { children: ReactNode }) {
  const [currentNetwork, setCurrentNetwork] = useState<'testnet' | 'mainnet'>(() => {
    const savedNetwork = localStorage.getItem('iota_network') as 'testnet' | 'mainnet' | null;
    return savedNetwork && (savedNetwork === 'testnet' || savedNetwork === 'mainnet') ? savedNetwork : 'testnet';
  });

  // Listen for network changes in localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'iota_network' && e.newValue) {
        const newNetwork = e.newValue as 'testnet' | 'mainnet';
        if (newNetwork === 'testnet' || newNetwork === 'mainnet') {
          setCurrentNetwork(newNetwork);
        }
      }
    };

    // Listen for storage changes from other tabs
    window.addEventListener('storage', handleStorageChange);

    // Also listen for changes within the same tab
    const interval = setInterval(() => {
      const savedNetwork = localStorage.getItem('iota_network') as 'testnet' | 'mainnet' | null;
      const networkToUse = savedNetwork && (savedNetwork === 'testnet' || savedNetwork === 'mainnet') ? savedNetwork : 'testnet';
      if (networkToUse !== currentNetwork) {
        setCurrentNetwork(networkToUse);
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [currentNetwork]);

  return (
    <IotaClientProvider networks={networkConfig} defaultNetwork={currentNetwork} key={currentNetwork}>
      <IotaWalletProvider>
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
      </IotaWalletProvider>
    </IotaClientProvider>
  );
}

// Main provider component that wraps everything
export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DynamicIotaProvider>
        {children}
      </DynamicIotaProvider>
    </QueryClientProvider>
  );
}