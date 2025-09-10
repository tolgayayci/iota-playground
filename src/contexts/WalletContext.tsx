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
  walletType: 'playground' | 'external' | 'none'; // Explicit wallet type tracking
  
  // Playground wallet properties
  isPlaygroundWallet: boolean;
  playgroundAddress: string | null;
  isPlaygroundConnected: boolean; // Helper for playground connection status
  
  // External wallet properties
  isExternalConnected: boolean; // Helper for external connection status
  
  // Network management
  switchNetwork: (network: NetworkType) => void;
  
  // Wallet validation
  isNetworkCompatible: (network: NetworkType) => boolean;
  canUseWalletForNetwork: (walletType: 'playground' | 'external', network: NetworkType) => boolean;
  
  // Wallet management
  connectPlaygroundWallet: () => Promise<void>;
  connectExternalWallet: (walletName?: string) => Promise<void>;
  disconnectWallet: () => void;
  getCurrentWalletType: () => 'playground' | 'external' | 'none';
  
  // Transaction execution
  signAndExecuteTransaction: (transaction: Transaction) => Promise<any>;
  
  // External wallet integration
  availableWallets: ReturnType<typeof useWallets>;
  currentAccount: ReturnType<typeof useCurrentAccount>;
  
  // Wallet type switching
  switchWalletType: (type: 'playground' | 'external') => Promise<boolean>;
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
  const [walletType, setWalletType] = useState<'playground' | 'external' | 'none'>('none');
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
      // Load saved network first (default to testnet)
      const savedNetwork = localStorage.getItem('iota_network') as NetworkType;
      if (savedNetwork && (savedNetwork === 'testnet' || savedNetwork === 'mainnet')) {
        if (!isStale) setNetwork(savedNetwork);
      } else {
        // Default to testnet
        if (!isStale) setNetwork('testnet');
      }

      const savedWalletType = localStorage.getItem('iota_wallet_type');
      const hasInitialized = localStorage.getItem('iota_wallet_initialized');
      const wasDisconnected = localStorage.getItem('iota_wallet_disconnected');

      // If external wallet is connected, use it
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
        setWalletType('external');
        localStorage.setItem('iota_wallet_type', 'external');
        localStorage.removeItem('iota_wallet_disconnected');
      } 
      // If saved wallet type is playground and not explicitly disconnected
      else if (savedWalletType === 'playground' && !wasDisconnected && !isStale) {
        const playgroundWallet = createPlaygroundWallet();
        if (playgroundWallet) {
          setCurrentWallet(playgroundWallet);
          setWalletType('playground');
        }
      } 
      // Auto-initialize playground wallet on first app load (testnet only)
      // Only if no external wallet is expected to connect
      else if (!hasInitialized && !wasDisconnected && !currentAccount && !savedWalletType && network === 'testnet' && !isStale) {
        // Wait a bit to see if external wallet auto-connects
        setTimeout(() => {
          if (!currentAccount && !isStale) {
            const playgroundWallet = createPlaygroundWallet();
            if (playgroundWallet) {
              setCurrentWallet(playgroundWallet);
              setWalletType('playground');
              localStorage.setItem('iota_wallet_type', 'playground');
              localStorage.setItem('iota_wallet_initialized', 'true');
              console.log('Auto-initialized playground wallet for first-time user');
            }
          }
        }, 1000); // Give external wallet auto-connect 1 second to kick in
      }
      // No wallet connected
      else if (!isStale) {
        setCurrentWallet(null);
        setWalletType('none');
        // Don't immediately remove external wallet type - let auto-connect handle it
        if (savedWalletType === 'external' && !currentAccount) {
          // Wait for auto-connect to complete before clearing
          setTimeout(() => {
            if (!currentAccount && !isStale) {
              localStorage.removeItem('iota_wallet_type');
            }
          }, 2000);
        }
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

    // Save current wallet state before network switch
    const previousWalletType = walletType;
    const previousWallet = currentWallet;
    
    setNetwork(newNetwork);
    localStorage.setItem('iota_network', newNetwork);
    
    // Restore wallet connection after network switch
    if (previousWalletType === 'playground' && newNetwork === 'testnet') {
      // Keep playground wallet connected when switching within testnet
      if (!previousWallet) {
        const playgroundWallet = createPlaygroundWallet();
        if (playgroundWallet) {
          setCurrentWallet(playgroundWallet);
          setWalletType('playground');
        }
      }
    } else if (previousWalletType === 'external') {
      // External wallets remain connected across network switches
      // The dapp-kit handles the network change internally
      setWalletType('external');
    }
    
    // Only show toast if this is a user-initiated network switch (not on app initialization)
    // Removed automatic toast to prevent annoying notifications on app load
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

    // Disconnect external wallet if connected
    if (currentAccount) {
      disconnect();
    }

    try {
      const playgroundWallet = createPlaygroundWallet();
      if (!playgroundWallet) {
        throw new Error('Failed to create playground wallet');
      }

      setCurrentWallet(playgroundWallet);
      setWalletType('playground');
      localStorage.setItem('iota_wallet_type', 'playground');
      localStorage.removeItem('iota_wallet_disconnected');
      
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
      // Clear playground wallet if connected
      if (walletType === 'playground') {
        setCurrentWallet(null);
        localStorage.removeItem('iota_wallet_type');
      }

      // Clear the disconnected flag
      localStorage.removeItem('iota_wallet_disconnected');

      if (walletName) {
        const wallet = wallets.find(w => w.name === walletName);
        if (wallet) {
          connectWallet({ wallet });
          setWalletType('external');
          localStorage.setItem('iota_wallet_type', 'external');
        }
      } else {
        // Connect to first available wallet
        const firstWallet = wallets[0];
        if (firstWallet) {
          connectWallet({ wallet: firstWallet });
          setWalletType('external');
          localStorage.setItem('iota_wallet_type', 'external');
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
    setWalletType('none');
    localStorage.removeItem('iota_wallet_type');
    // Mark that user has explicitly disconnected
    localStorage.setItem('iota_wallet_disconnected', 'true');
    
    // Clear dapp-kit auto-connect storage to prevent auto-reconnect
    localStorage.removeItem('iota-dapp-kit:wallet-connection-info');
    
    toast({
      title: "Wallet Disconnected",
      description: "Wallet has been disconnected",
    });
  };
  
  // Add function to switch wallet types
  const switchWalletType = async (newType: 'playground' | 'external') => {
    if (newType === walletType) return true; // Already using this wallet type
    
    if (newType === 'playground') {
      // Switch to playground wallet
      if (network !== 'testnet') {
        await switchNetwork('testnet');
      }
      
      // Disconnect external wallet if connected
      if (currentAccount) {
        disconnect();
      }
      
      const playgroundWallet = createPlaygroundWallet();
      if (playgroundWallet) {
        setCurrentWallet(playgroundWallet);
        setWalletType('playground');
        localStorage.setItem('iota_wallet_type', 'playground');
        localStorage.removeItem('iota_wallet_disconnected');
        
        toast({
          title: "Switched to Playground Wallet",
          description: `Using testnet wallet: ${playgroundWallet.address.slice(0, 10)}...`,
        });
        return true;
      }
    } else {
      // Switch to external wallet
      // First disconnect playground if connected
      if (walletType === 'playground') {
        setCurrentWallet(null);
        setWalletType('none');
      }
      
      localStorage.setItem('iota_wallet_type', 'external');
      localStorage.removeItem('iota_wallet_disconnected');
      
      // Open wallet connection if no external wallet connected
      if (!currentAccount) {
        toast({
          title: "Connect External Wallet",
          description: "Please connect your external wallet to continue",
        });
        
        // Return false to indicate wallet needs to be connected
        return false;
      } else {
        // External wallet already connected
        return true;
      }
    }
    
    return false;
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
  const isPlaygroundConnected = walletType === 'playground' && !!currentWallet;
  const isExternalConnected = walletType === 'external' && !!currentAccount;

  // Helper functions
  const getCurrentWalletType = (): 'playground' | 'external' | 'none' => {
    return walletType;
  };

  const canUseWalletForNetwork = (wallet: 'playground' | 'external', targetNetwork: NetworkType): boolean => {
    if (wallet === 'playground' && targetNetwork === 'mainnet') {
      return false; // Playground only supports testnet
    }
    return true; // External wallets support both networks
  };

  const value: WalletContextType = {
    currentWallet,
    isConnected: !!currentWallet,
    network,
    walletType,
    isPlaygroundWallet,
    playgroundAddress,
    isPlaygroundConnected,
    isExternalConnected,
    switchNetwork,
    isNetworkCompatible,
    canUseWalletForNetwork,
    connectPlaygroundWallet,
    connectExternalWallet,
    disconnectWallet,
    getCurrentWalletType,
    signAndExecuteTransaction: executeTransaction,
    availableWallets: wallets,
    currentAccount,
    switchWalletType,
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

    // Don't use interval polling as it causes re-renders
    // The network will update via the storage event or direct state changes

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [currentNetwork]);

  return (
    <IotaClientProvider networks={networkConfig} defaultNetwork={currentNetwork}>
      <IotaWalletProvider
        autoConnect={true}
        preferredWallets={['IOTA Wallet', 'Sui Wallet']}
        enableUnsafeBurner={false}
      >
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