import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet,
  ChevronDown,
  Power,
  TestTube,
  Globe,
  Copy,
  Check,
  ExternalLink,
  Network,
  RefreshCw,
  SwitchCamera,
  Coins,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWallet } from '@/contexts/WalletContext';
import { WalletConnectionDialog } from '@/components/WalletConnectionDialog';
import { useToast } from '@/hooks/use-toast';
import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';

export function WalletStatus() {
  const { 
    currentWallet,
    isConnected,
    network,
    switchNetwork,
    disconnectWallet,
    isPlaygroundWallet,
    switchWalletType,
    walletType,
  } = useWallet();
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const { toast } = useToast();

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const fetchBalance = useCallback(async () => {
    const address = isPlaygroundWallet ? currentWallet?.address : currentWallet?.address;
    if (!address) {
      setBalance(null);
      return;
    }
    
    setIsLoadingBalance(true);
    try {
      const client = new IotaClient({ url: getFullnodeUrl(network) });
      const balanceResult = await client.getBalance({ owner: address });
      const totalBalance = BigInt(balanceResult.totalBalance || '0');
      const balanceInIota = (Number(totalBalance) / 1000000000).toFixed(4);
      setBalance(balanceInIota);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      setBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [currentWallet?.address, network, isPlaygroundWallet]);

  // Fetch balance when wallet or network changes
  useEffect(() => {
    if (isConnected && currentWallet?.address) {
      fetchBalance();
    }
  }, [currentWallet?.address, network, isConnected, fetchBalance]);
  
  // Show network reminder for external wallets when network changes
  useEffect(() => {
    if (walletType === 'external' && isConnected) {
      // Show a brief reminder when network changes
      const timer = setTimeout(() => {
        toast({
          title: "🔍 Network Check",
          description: `App is now on ${network}. Please ensure your wallet is on the same network.`,
          duration: 5000,
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [network, walletType, isConnected, toast]);

  const copyAddress = () => {
    if (currentWallet?.address) {
      navigator.clipboard.writeText(currentWallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
      });
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  const handleNetworkSwitch = (newNetwork: 'testnet' | 'mainnet') => {
    if (isPlaygroundWallet && newNetwork === 'mainnet') {
      toast({
        title: "Network Not Supported",
        description: "Playground wallet only supports testnet",
        variant: "destructive",
      });
      return;
    }
    switchNetwork(newNetwork);
  };
  
  const handleWalletSwitch = async (type: 'playground' | 'external') => {
    const success = await switchWalletType(type);
    if (!success && type === 'external') {
      // Open connection dialog for external wallet
      setShowConnectionDialog(true);
    }
  };

  if (!isConnected) {
    return (
      <>
        <Button
          variant="outline"
          className="h-10 px-4 flex items-center gap-2 font-medium"
          onClick={() => setShowConnectionDialog(true)}
        >
          <Wallet className="h-4 w-4" />
          <span className="hidden sm:inline">Connect Wallet</span>
          <span className="sm:hidden">Connect</span>
        </Button>
        
        <WalletConnectionDialog
          open={showConnectionDialog}
          onOpenChange={setShowConnectionDialog}
        />
      </>
    );
  }

  return (
    <>
      {/* Network Selector - Always visible */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-10 px-3 flex items-center gap-2"
          >
            <Network className="h-4 w-4" />
            <span className="font-medium text-sm">
              {network === 'testnet' ? 'Testnet' : 'Mainnet'}
            </span>
            {isPlaygroundWallet && (
              <Badge variant="secondary" className="text-xs ml-1">
                Only
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={() => handleNetworkSwitch('testnet')}
            disabled={network === 'testnet'}
            className="cursor-pointer"
          >
            <TestTube className="h-4 w-4 mr-2 text-blue-500" />
            Testnet
            {network === 'testnet' && <Check className="h-4 w-4 ml-auto text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleNetworkSwitch('mainnet')}
            disabled={network === 'mainnet' || isPlaygroundWallet}
            className={`cursor-pointer ${isPlaygroundWallet ? 'opacity-50' : ''}`}
          >
            <Globe className="h-4 w-4 mr-2 text-green-500" />
            Mainnet
            {network === 'mainnet' && <Check className="h-4 w-4 ml-auto text-primary" />}
            {isPlaygroundWallet && (
              <Badge variant="outline" className="text-xs ml-auto mr-2">
                External only
              </Badge>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Wallet Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-10 px-4 flex items-center gap-2"
          >
            <div className="flex items-center gap-2">
              {isPlaygroundWallet ? (
                <TestTube className="h-4 w-4 text-blue-500" />
              ) : (
                <Wallet className="h-4 w-4 text-green-500" />
              )}
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm hidden md:inline">
                  {formatAddress(currentWallet?.address || '')}
                </span>
                <span className="font-mono text-sm md:hidden">
                  {currentWallet?.address.slice(0, 4)}...
                </span>
                {balance && (
                  <Badge variant="secondary" className="gap-1">
                    <Coins className="h-3 w-3" />
                    {balance} IOTA
                  </Badge>
                )}
              </div>
            </div>
            <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-[320px] sm:w-[380px]">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {isPlaygroundWallet ? (
                  <TestTube className="h-4 w-4 text-blue-500" />
                ) : (
                  <Wallet className="h-4 w-4 text-green-500" />
                )}
                <span className="font-semibold">
                  {isPlaygroundWallet ? 'Playground Wallet' : 'External Wallet'}
                </span>
              </div>
              {isPlaygroundWallet && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                  Testnet Only
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
              <span className="font-mono text-sm flex-1 truncate select-all">
                {currentWallet?.address}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-background"
                  onClick={() => window.open(
                    `https://explorer.iota.org/address/${currentWallet?.address}?network=${network}`, 
                    '_blank'
                  )}
                  title="View in Explorer"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-background"
                  onClick={copyAddress}
                  title="Copy Address"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {/* Balance and Network Display */}
            <div className="space-y-3 mt-4">
              {/* Balance */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Balance</span>
                </div>
                <div className="flex items-center gap-2">
                  {isLoadingBalance ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Badge variant="outline" className="font-mono">
                      {balance || '0.0000'} IOTA
                    </Badge>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={fetchBalance}
                    title="Refresh balance"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              {/* Network */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Network</span>
                </div>
                <Badge variant={network === 'testnet' ? 'secondary' : 'default'}>
                  {network === 'testnet' ? 'IOTA Testnet' : 'IOTA Mainnet'}
                </Badge>
              </div>
            </div>
          </div>
          
          <DropdownMenuSeparator />
          
          {/* Wallet Switching */}
          <div className="px-2 py-1.5">
            <p className="text-xs font-medium text-muted-foreground mb-2">Switch Wallet Type</p>
            <div className="space-y-1">
              <DropdownMenuItem
                onClick={() => handleWalletSwitch('playground')}
                disabled={walletType === 'playground'}
                className="cursor-pointer"
              >
                <TestTube className="mr-2 h-4 w-4 text-blue-500" />
                <span className="flex-1">Playground Wallet</span>
                {walletType === 'playground' && <Check className="h-4 w-4 ml-2 text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleWalletSwitch('external')}
                disabled={walletType === 'external'}
                className="cursor-pointer"
              >
                <Wallet className="mr-2 h-4 w-4 text-green-500" />
                <span className="flex-1">External Wallet</span>
                {walletType === 'external' && <Check className="h-4 w-4 ml-2 text-primary" />}
              </DropdownMenuItem>
            </div>
          </div>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={handleDisconnect}
            className="text-red-600 focus:text-red-600 cursor-pointer"
          >
            <Power className="mr-2 h-4 w-4" />
            <span className="font-medium">Disconnect All</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <WalletConnectionDialog
        open={showConnectionDialog}
        onOpenChange={setShowConnectionDialog}
      />
    </>
  );
}