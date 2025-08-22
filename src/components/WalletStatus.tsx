import { useState } from 'react';
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

export function WalletStatus() {
  const { 
    currentWallet,
    isConnected,
    network,
    switchNetwork,
    disconnectWallet,
    isPlaygroundWallet,
  } = useWallet();
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

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
              <span className="font-mono text-sm hidden md:inline">
                {formatAddress(currentWallet?.address || '')}
              </span>
              <span className="font-mono text-sm md:hidden">
                {currentWallet?.address.slice(0, 4)}...
              </span>
              <Badge 
                variant={network === 'testnet' ? 'secondary' : 'default'} 
                className="text-xs hidden sm:inline-flex"
              >
                {network}
              </Badge>
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
            
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-background rounded-lg">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-medium text-sm">Network</div>
                  <div className="text-xs text-muted-foreground">
                    {network === 'testnet' ? 'IOTA Testnet' : 'IOTA Mainnet'}
                  </div>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs font-medium px-3">
                    <Network className="h-3 w-3 mr-2" />
                    Switch Network
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => handleNetworkSwitch('testnet')}
                    disabled={network === 'testnet'}
                    className="cursor-pointer"
                  >
                    <TestTube className="h-4 w-4 mr-3 text-blue-500" />
                    <div className="flex-1">
                      <div className="font-medium">Testnet</div>
                      <div className="text-xs text-muted-foreground">Development network</div>
                    </div>
                    {network === 'testnet' && <Check className="h-4 w-4 ml-2 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleNetworkSwitch('mainnet')}
                    disabled={network === 'mainnet' || isPlaygroundWallet}
                    className={`cursor-pointer ${isPlaygroundWallet ? 'opacity-50' : ''}`}
                  >
                    <Globe className="h-4 w-4 mr-3 text-green-500" />
                    <div className="flex-1">
                      <div className="font-medium">Mainnet</div>
                      <div className="text-xs text-muted-foreground">Production network</div>
                    </div>
                    {network === 'mainnet' && <Check className="h-4 w-4 ml-2 text-primary" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={handleDisconnect}
            className="text-red-600 focus:text-red-600 cursor-pointer"
          >
            <Power className="mr-3 h-4 w-4" />
            <span className="font-medium">Disconnect Wallet</span>
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