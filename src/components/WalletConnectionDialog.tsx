import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Wallet, 
  TestTube, 
  AlertCircle, 
  ExternalLink, 
  Check,
  Loader2,
  Copy,
  ChevronRight,
  Globe,
  Shield,
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useToast } from '@/hooks/use-toast';

interface WalletConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletConnectionDialog({ open, onOpenChange }: WalletConnectionDialogProps) {
  const { 
    availableWallets, 
    connectPlaygroundWallet,
    connectExternalWallet,
    network, 
    currentWallet,
  } = useWallet();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'playground' | 'external' | null>(null);

  const handlePlaygroundWallet = async () => {
    setIsConnecting(true);
    try {
      await connectPlaygroundWallet();
      onOpenChange(false);
      toast({
        title: "Wallet Connected",
        description: "IOTA Playground wallet connected successfully",
      });
    } catch (error) {
      console.error('Failed to connect playground wallet:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect playground wallet",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleExternalWallet = async (walletName?: string) => {
    setIsConnecting(true);
    try {
      await connectExternalWallet(walletName);
      onOpenChange(false);
      toast({
        title: "Wallet Connected",
        description: `Connected to ${walletName || 'external wallet'}`,
      });
    } catch (error) {
      console.error('Failed to connect external wallet:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to wallet",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Wallet className="h-6 w-6" />
            Connect Wallet
          </DialogTitle>
          <DialogDescription className="text-base">
            Choose how you want to connect to the IOTA network. Your connection is secure and encrypted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Network indicator */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-background rounded-lg">
                <Globe className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="font-medium">Current Network</span>
            </div>
            <Badge variant={network === 'testnet' ? 'secondary' : 'default'} className="px-3 py-1">
              {network === 'testnet' ? 'IOTA Testnet' : 'IOTA Mainnet'}
            </Badge>
          </div>

          {/* Wallet Options */}
          <div className="space-y-4">
            {/* Playground Wallet Option */}
            <div 
              className={`group p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                selectedOption === 'playground' 
                  ? 'border-primary bg-primary/5 shadow-md' 
                  : 'border-border hover:border-primary/50 hover:shadow-sm'
              } ${network !== 'testnet' ? 'opacity-60 cursor-not-allowed' : ''}`}
              onClick={() => network === 'testnet' && setSelectedOption('playground')}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-3 rounded-xl transition-colors ${
                    selectedOption === 'playground' 
                      ? 'bg-blue-100 dark:bg-blue-900' 
                      : 'bg-muted group-hover:bg-blue-50 dark:group-hover:bg-blue-950'
                  }`}>
                    <TestTube className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">Playground Wallet</h3>
                      <Badge variant="outline" className="text-xs font-medium">
                        Testnet Only
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mb-3 leading-relaxed">
                      Quick start with a pre-configured testnet wallet. Perfect for development and testing.
                    </p>
                    <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                      <TestTube className="h-4 w-4" />
                      <span>Free testnet tokens included</span>
                    </div>
                    {network !== 'testnet' && (
                      <Alert className="mt-3 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
                          Switch to testnet to use playground wallet
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
                {selectedOption === 'playground' && (
                  <Check className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                )}
              </div>
            </div>

            {/* External Wallet Option */}
            <div 
              className={`group p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                selectedOption === 'external' 
                  ? 'border-primary bg-primary/5 shadow-md' 
                  : 'border-border hover:border-primary/50 hover:shadow-sm'
              }`}
              onClick={() => setSelectedOption('external')}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-3 rounded-xl transition-colors ${
                    selectedOption === 'external' 
                      ? 'bg-green-100 dark:bg-green-900' 
                      : 'bg-muted group-hover:bg-green-50 dark:group-hover:bg-green-950'
                  }`}>
                    <Wallet className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">External Wallet</h3>
                      <Badge variant="outline" className="text-xs font-medium bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                        Recommended
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mb-3 leading-relaxed">
                      Connect with IOTA Wallet or other compatible wallets. Full control of your private keys.
                    </p>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <Shield className="h-4 w-4" />
                        <span>Secure & Private</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <Globe className="h-4 w-4" />
                        <span>Mainnet & Testnet</span>
                      </div>
                    </div>
                  </div>
                </div>
                {selectedOption === 'external' && (
                  <Check className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                )}
              </div>
            </div>
          </div>

          {/* Available Wallets */}
          {selectedOption === 'external' && availableWallets.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-lg">Available Wallets</h4>
              <div className="space-y-3">
                {availableWallets.map((wallet) => (
                  <div 
                    key={wallet.name}
                    className="group flex items-center justify-between p-4 border-2 border-border rounded-xl hover:border-primary/50 hover:bg-muted/50 cursor-pointer transition-all duration-200"
                    onClick={() => handleExternalWallet(wallet.name)}
                  >
                    <div className="flex items-center gap-4">
                      {wallet.icon && (
                        <img src={wallet.icon} alt={wallet.name} className="w-8 h-8 rounded-lg" />
                      )}
                      <div>
                        <span className="font-semibold text-base">{wallet.name}</span>
                        <div className="text-sm text-muted-foreground">Connect to {wallet.name}</div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No External Wallets Found */}
          {selectedOption === 'external' && availableWallets.length === 0 && (
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                <div className="space-y-3">
                  <p className="font-medium">No compatible wallets detected</p>
                  <p className="text-sm">Install IOTA Wallet to connect with your own wallet and private keys.</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <a 
                      href="https://chrome.google.com/webstore/detail/iota-wallet/kncchdiglobfhccbiagbcgdlicipbbil" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900 rounded-lg text-sm font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Install IOTA Wallet
                    </a>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Separator className="my-6" />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              className="flex-1 h-12"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 h-12 font-medium"
              disabled={!selectedOption || isConnecting || (selectedOption === 'playground' && network !== 'testnet')}
              onClick={() => {
                if (selectedOption === 'playground') {
                  handlePlaygroundWallet();
                } else if (selectedOption === 'external') {
                  handleExternalWallet();
                }
              }}
            >
              {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {!isConnecting && selectedOption === 'playground' && <TestTube className="mr-2 h-4 w-4" />}
              {!isConnecting && selectedOption === 'external' && <Wallet className="mr-2 h-4 w-4" />}
              {selectedOption === 'playground' ? 'Connect Playground Wallet' : 'Connect External Wallet'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}