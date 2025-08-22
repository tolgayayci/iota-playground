import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  RocketIcon, 
  CheckCircle, 
  Loader2,
  ExternalLink,
  Copy,
  Wallet,
  Settings,
  Zap,
  Coins,
} from 'lucide-react';
import { CompilationResult } from '@/lib/types';
import { 
  deployWithPlaygroundWallet, 
  preparePublishTransaction,
  PublishData
} from '@/lib/deployV2';
import { useSignAndExecuteTransaction, useConnectWallet } from '@iota/dapp-kit';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { useToast } from '@/hooks/use-toast';
import { Transaction } from '@iota/iota-sdk/transactions';
import { fromB64 } from '@iota/iota-sdk/utils';
import { supabase } from '@/lib/supabase';

interface DeploymentResult {
  success: boolean;
  packageId?: string;
  transactionDigest?: string;
  explorerUrl?: string;
  gasUsed?: string;
  gasCost?: string;
  error?: string;
}

interface EnhancedDeployDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  lastCompilation: CompilationResult | null;
  onDeploySuccess?: () => void;
}

export function EnhancedDeployDialog({
  open,
  onOpenChange,
  projectId,
  lastCompilation,
  onDeploySuccess,
}: EnhancedDeployDialogProps) {
  const { user } = useAuth();
  const { 
    currentAccount, 
    network, 
    playgroundAddress,
    switchNetwork,
    connectPlaygroundWallet,
    availableWallets,
  } = useWallet();
  
  // State management
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);
  const [selectedWalletType, setSelectedWalletType] = useState<'playground' | 'external'>('playground');
  const [selectedNetwork, setSelectedNetwork] = useState<'testnet' | 'mainnet'>(network);
  const [publishData, setPublishData] = useState<PublishData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  const { toast } = useToast();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { mutate: connectWallet } = useConnectWallet();

  // Load publish data when dialog opens
  useEffect(() => {
    if (open && lastCompilation?.success) {
      loadPublishData();
    }
  }, [open, lastCompilation, selectedNetwork]);

  const loadPublishData = async () => {
    if (!lastCompilation?.success) return;
    
    setIsLoadingData(true);
    try {
      const data = await preparePublishTransaction(projectId, selectedNetwork);
      setPublishData(data);
    } catch (error) {
      console.error('Failed to load publish data:', error);
      toast({
        title: "Failed to Load",
        description: "Could not prepare deployment data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  // Reset on dialog open/close
  useEffect(() => {
    if (open) {
      setDeploymentResult(null);
      setIsDeploying(false);
    }
  }, [open]);

  // Wallet and network handlers
  const handleWalletTypeChange = async (type: string) => {
    const walletType = type as 'playground' | 'external';
    setSelectedWalletType(walletType);
    
    if (walletType === 'playground') {
      try {
        await connectPlaygroundWallet();
      } catch (error) {
        toast({
          title: "Connection Failed",
          description: "Failed to connect playground wallet",
          variant: "destructive",
        });
      }
    }
  };

  const handleConnectExternalWallet = () => {
    const firstWallet = availableWallets[0];
    if (firstWallet) {
      connectWallet(
        { wallet: firstWallet },
        {
          onSuccess: () => {
            toast({
              title: "Wallet Connected",
              description: `Successfully connected to ${firstWallet.name}`,
            });
          },
          onError: (error) => {
            toast({
              title: "Connection Failed",
              description: error.message,
              variant: "destructive",
            });
          }
        }
      );
    }
  };

  const handleNetworkChange = (newNetwork: string) => {
    const network = newNetwork as 'testnet' | 'mainnet';
    setSelectedNetwork(network);
    switchNetwork(network);
    if (lastCompilation?.success) {
      loadPublishData();
    }
  };

  // Deployment functions
  const handlePlaygroundDeploy = async () => {
    if (!lastCompilation?.success) {
      toast({
        title: "Compilation Required",
        description: "Please compile your contract successfully before deploying.",
        variant: "destructive",
      });
      return;
    }

    setIsDeploying(true);
    try {
      const result = await deployWithPlaygroundWallet(projectId, selectedNetwork);
      
      if (result.success) {
        setDeploymentResult({
          success: true,
          packageId: result.packageId,
          transactionDigest: result.transactionDigest,
          explorerUrl: selectedNetwork === 'testnet'
            ? `https://explorer.iota.cafe/txblock/${result.transactionDigest}`
            : `https://explorer.iota.org/txblock/${result.transactionDigest}`,
          gasUsed: result.gasUsed,
          gasCost: result.gasCost,
        });

        toast({
          title: "Deployment Successful",
          description: `Package deployed with ID: ${result.packageId}`,
        });
        onDeploySuccess?.();
      } else {
        throw new Error(result.error || 'Deployment failed');
      }
    } catch (error) {
      console.error('Deployment error:', error);
      toast({
        title: "Deployment Failed",
        description: error instanceof Error ? error.message : "Failed to deploy contract",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleExternalWalletDeploy = async () => {
    if (!lastCompilation?.success || !publishData) {
      toast({
        title: "Compilation Required",
        description: "Please compile your contract successfully before deploying.",
        variant: "destructive",
      });
      return;
    }

    if (!currentAccount?.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to deploy.",
        variant: "destructive",
      });
      return;
    }

    setIsDeploying(true);
    try {
      // Build transaction on client-side
      const tx = new Transaction();
      
      // Add publish command
      const modules = publishData.modules.map(module => fromB64(module));
      tx.publish({
        modules,
        dependencies: publishData.dependencies,
      });
      
      tx.setGasBudget(publishData.gasEstimate);

      // Sign and execute with wallet
      signAndExecute({
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        }
      }, {
        onSuccess: (result) => {
          // Extract package ID from object changes
          const publishedPackage = result.objectChanges?.find((change: any) => 
            change.type === 'published'
          );

          const deployResult: DeploymentResult = {
            success: true,
            packageId: publishedPackage?.packageId,
            transactionDigest: result.digest,
            explorerUrl: selectedNetwork === 'testnet'
              ? `https://explorer.iota.cafe/txblock/${result.digest}`
              : `https://explorer.iota.org/txblock/${result.digest}`,
            gasUsed: result.effects?.gasUsed?.computationCost,
            gasCost: result.effects?.gasUsed?.storageCost,
          };

          setDeploymentResult(deployResult);
          toast({
            title: "Deployment Successful",
            description: `Package deployed with ID: ${publishedPackage?.packageId}`,
          });
          
          // Save deployment to database
          saveDeploymentToDatabase(deployResult);
          onDeploySuccess?.();
        },
        onError: (error) => {
          console.error('Deployment error:', error);
          toast({
            title: "Deployment Failed",
            description: error.message || "Failed to deploy contract",
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      console.error('Deployment error:', error);
      toast({
        title: "Deployment Failed",
        description: error instanceof Error ? error.message : "Failed to deploy contract",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const saveDeploymentToDatabase = async (result: DeploymentResult) => {
    try {
      await supabase
        .from('deployed_contracts')
        .insert({
          project_id: projectId,
          user_id: user?.id,
          package_id: result.packageId,
          module_address: result.packageId,
          module_name: 'user_deployment',
          network: selectedNetwork,
          abi: {},
          transaction_hash: result.transactionDigest || '',
          gas_used: parseInt(result.gasUsed || '0'),
        });
    } catch (error) {
      console.error('Failed to save deployment to database:', error);
    }
  };

  const handleDeploy = () => {
    if (selectedWalletType === 'playground') {
      handlePlaygroundDeploy();
    } else {
      handleExternalWalletDeploy();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
  };

  // Check wallet connection status
  const isWalletConnected = selectedWalletType === 'playground' 
    ? !!playgroundAddress 
    : !!currentAccount?.address;
    
  const walletAddress = selectedWalletType === 'playground' 
    ? playgroundAddress 
    : currentAccount?.address;

  if (!lastCompilation?.success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RocketIcon className="h-5 w-5" />
              Deploy Contract
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <div className="text-muted-foreground">
              Please compile your contract successfully before deploying.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RocketIcon className="h-5 w-5" />
            Deploy Contract
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Wallet Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <span className="font-medium">Wallet & Network</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Wallet Type</label>
                <Select value={selectedWalletType} onValueChange={handleWalletTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="playground">Playground Wallet</SelectItem>
                    <SelectItem value="external">External Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Network</label>
                <Select value={selectedNetwork} onValueChange={handleNetworkChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="testnet">Testnet</SelectItem>
                    <SelectItem value="mainnet">Mainnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Wallet Connection Status */}
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Connection Status</span>
                {isWalletConnected ? (
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-200">
                    ✓ Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-200">
                    Not Connected
                  </Badge>
                )}
              </div>
              
              {isWalletConnected ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Address:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">
                        {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-6)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(walletAddress || '')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Network:</span>
                    <Badge variant="default" className="capitalize">{selectedNetwork}</Badge>
                  </div>
                </div>
              ) : (
                <div className="pt-2">
                  {selectedWalletType === 'external' ? (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={handleConnectExternalWallet}
                    >
                      <Wallet className="mr-2 h-4 w-4" />
                      Connect External Wallet
                    </Button>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Playground wallet will connect automatically
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Gas Estimation */}
          {publishData && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-primary" />
                <span className="font-medium">Deployment Cost</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                  <span className="text-muted-foreground font-medium">Estimated Gas</span>
                  <div className="flex items-center gap-1">
                    <Coins className="h-3 w-3" />
                    <span className="font-mono text-xs">{publishData.estimatedCost}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                  <span className="text-muted-foreground font-medium">Modules</span>
                  <span className="font-mono text-xs">{publishData.modules.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* Deployment Result */}
          {deploymentResult && deploymentResult.success && (
            <div className="rounded-lg border bg-card border-green-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-medium text-green-700">Deployment Successful!</span>
              </div>
              
              <div className="space-y-3 text-sm">
                {deploymentResult.packageId && (
                  <div className="flex items-center justify-between py-2 px-3 rounded-md bg-green-50 border border-green-100">
                    <span className="text-green-700 font-medium">Package ID</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-green-600">
                        {deploymentResult.packageId.slice(0, 12)}...{deploymentResult.packageId.slice(-8)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(deploymentResult.packageId || '')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {deploymentResult.explorerUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(deploymentResult.explorerUrl, '_blank')}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View in Explorer
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Deploy Button */}
          <Button 
            onClick={handleDeploy}
            disabled={isDeploying || !isWalletConnected || isLoadingData}
            className="w-full"
            size="lg"
          >
            {isDeploying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <RocketIcon className="mr-2 h-4 w-4" />
                Deploy Contract
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}