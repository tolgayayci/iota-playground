import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wallet,
  TestTube,
  Globe,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface WalletSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletSwitcher({ open, onOpenChange }: WalletSwitcherProps) {
  const { 
    walletType,
    network,
    switchWalletType,
    isPlaygroundWallet,
    currentWallet,
    availableWallets,
  } = useWallet();
  const [isSwitching, setIsSwitching] = useState(false);
  const { toast } = useToast();

  const handleSwitch = async (type: 'playground' | 'external') => {
    if (type === walletType) {
      onOpenChange(false);
      return;
    }

    setIsSwitching(true);
    
    try {
      const success = await switchWalletType(type);
      
      if (success) {
        onOpenChange(false);
      } else if (type === 'external') {
        // Need to connect external wallet
        toast({
          title: "Connect External Wallet",
          description: "Please install and connect an IOTA wallet to continue",
        });
        
        if (availableWallets.length === 0) {
          window.open('https://www.iota.org/products/wallet', '_blank');
        }
      }
    } catch (error) {
      toast({
        title: "Switch Failed",
        description: "Failed to switch wallet type",
        variant: "destructive",
      });
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Switch Wallet Type</DialogTitle>
          <DialogDescription>
            Choose between playground wallet for testing or external wallet for full control
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Current Wallet Status */}
          {currentWallet && (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>
                Currently using {isPlaygroundWallet ? 'Playground' : 'External'} wallet on {network}
              </AlertDescription>
            </Alert>
          )}

          {/* Wallet Options */}
          <div className="space-y-3">
            {/* Playground Wallet Option */}
            <button
              onClick={() => handleSwitch('playground')}
              disabled={isSwitching || (network === 'mainnet')}
              className={cn(
                "w-full p-4 rounded-lg border-2 text-left transition-all",
                walletType === 'playground'
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:shadow-sm",
                network === 'mainnet' && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                    <TestTube className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Playground Wallet</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Built-in testnet wallet with free gas
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        Testnet Only
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Zap className="h-3 w-3 mr-1" />
                        Zero Gas Fees
                      </Badge>
                    </div>
                  </div>
                </div>
                {walletType === 'playground' && (
                  <CheckCircle className="h-5 w-5 text-primary" />
                )}
              </div>
              {network === 'mainnet' && (
                <Alert className="mt-3 border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs">
                    Switch to testnet to use playground wallet
                  </AlertDescription>
                </Alert>
              )}
            </button>

            {/* External Wallet Option */}
            <button
              onClick={() => handleSwitch('external')}
              disabled={isSwitching}
              className={cn(
                "w-full p-4 rounded-lg border-2 text-left transition-all",
                walletType === 'external'
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:shadow-sm"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                    <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">External Wallet</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Use your own wallet with full control
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        <Globe className="h-3 w-3 mr-1" />
                        Mainnet Ready
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Your Keys
                      </Badge>
                    </div>
                  </div>
                </div>
                {walletType === 'external' && (
                  <CheckCircle className="h-5 w-5 text-primary" />
                )}
              </div>
              {availableWallets.length === 0 && (
                <Alert className="mt-3 border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs">
                    No wallet extension detected. Install IOTA Wallet to continue.
                  </AlertDescription>
                </Alert>
              )}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSwitching}
            >
              Cancel
            </Button>
            {walletType !== 'playground' && network === 'testnet' && (
              <Button
                onClick={() => handleSwitch('playground')}
                disabled={isSwitching}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Switch to Playground
              </Button>
            )}
            {walletType !== 'external' && (
              <Button
                onClick={() => handleSwitch('external')}
                disabled={isSwitching}
                variant={walletType === 'playground' ? 'outline' : 'default'}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Switch to External
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}