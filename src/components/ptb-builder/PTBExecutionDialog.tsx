import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play,
  Eye,
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  AlertCircle,
  Zap,
  Code2,
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';
import { Transaction } from '@iota/iota-sdk/transactions';
import { useSignAndExecuteTransaction } from '@iota/dapp-kit';
import { PTBCommand } from '@/components/views/PTBBuilderV3';
import { cn } from '@/lib/utils';

interface PTBExecutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PTBCommand[];
  mode: 'dry-run' | 'execute';
  network: 'testnet' | 'mainnet';
  projectId: string;
  selectedPackage?: string;
  onExecutionComplete?: () => void;
}

interface ExecutionResult {
  success: boolean;
  transactionDigest?: string;
  gasUsed?: string;
  error?: string;
  objectChanges?: any[];
  events?: any[];
  effects?: any;
}

export function PTBExecutionDialog({
  open,
  onOpenChange,
  commands,
  mode,
  network,
  projectId,
  selectedPackage,
  onExecutionComplete,
}: PTBExecutionDialogProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'result'>('preview');
  
  const { user } = useAuth();
  const { 
    currentAccount, 
    isConnected,
    connectPlaygroundWallet,
    connectExternalWallet,
    walletType,
  } = useWallet();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setActiveTab('preview');
      setResult(null);
    }
  }, [open, commands]);

  const buildTransaction = () => {
    const tx = new Transaction();
    
    const commandResults: any[] = [];
    
    // Validate addresses before building
    commands.forEach((command) => {
      if (command.type === 'TransferObjects' && command.recipient) {
        if (!command.recipient.value || command.recipient.value === '') {
          throw new Error('Recipient address is required for TransferObjects command');
        }
        // Basic IOTA address validation (starts with 0x and is 66 chars)
        if (!command.recipient.value.match(/^0x[a-fA-F0-9]{64}$/)) {
          throw new Error(`Invalid IOTA address format: ${command.recipient.value}`);
        }
      }
    });
    
    commands.forEach((command, index) => {
      switch (command.type) {
        case 'MoveCall':
          if (command.target && command.arguments) {
            const args = command.arguments.map(arg => {
              if (arg.type === 'result' && arg.resultFrom !== undefined) {
                return commandResults[arg.resultFrom];
              } else if (arg.type === 'gas') {
                return tx.gas;
              } else if (arg.type === 'object') {
                return tx.object(arg.value);
              } else {
                // Handle different input types based on parameter type
                if (arg.paramType?.includes('u8') || arg.paramType?.includes('u16') || 
                    arg.paramType?.includes('u32') || arg.paramType?.includes('u64')) {
                  return tx.pure.u64(arg.value);
                } else if (arg.paramType?.includes('bool')) {
                  return tx.pure.bool(arg.value === 'true');
                } else if (arg.paramType?.includes('address')) {
                  return tx.pure.address(arg.value);
                } else {
                  return tx.pure.string(arg.value);
                }
              }
            });
            
            const result = tx.moveCall({
              target: command.target,
              arguments: args,
              typeArguments: command.typeArguments || [],
            });
            commandResults.push(result);
          }
          break;
          
        case 'TransferObjects':
          if (command.objects && command.recipient) {
            const objects = command.objects.map(obj => {
              if (obj.type === 'result' && obj.resultFrom !== undefined) {
                return commandResults[obj.resultFrom];
              } else {
                return tx.object(obj.value);
              }
            });
            
            tx.transferObjects(objects, tx.pure.address(command.recipient.value));
          }
          break;
          
        case 'SplitCoins':
          if (command.coin && command.amounts) {
            const coin = command.coin.type === 'gas' ? tx.gas : 
                        command.coin.type === 'result' ? commandResults[command.coin.resultFrom] :
                        tx.object(command.coin.value);
            
            const amounts = command.amounts.map(amt => tx.pure.u64(amt.value));
            const results = tx.splitCoins(coin, amounts);
            commandResults.push(results);
          }
          break;
          
        case 'MergeCoins':
          if (command.destination && command.sources) {
            const dest = command.destination.type === 'gas' ? tx.gas :
                        command.destination.type === 'result' ? commandResults[command.destination.resultFrom] :
                        tx.object(command.destination.value);
            
            const sources = command.sources.map(src => {
              if (src.type === 'result' && src.resultFrom !== undefined) {
                return commandResults[src.resultFrom];
              } else {
                return tx.object(src.value);
              }
            });
            
            tx.mergeCoins(dest, sources);
          }
          break;
      }
    });
    
    return tx;
  };

  const handleDryRun = async () => {
    try {
      setIsExecuting(true);
      setActiveTab('result');
      
      const client = new IotaClient({ url: getFullnodeUrl(network) });
      const tx = buildTransaction();
      
      // Use a dummy address for dry run if not connected
      const sender = currentAccount?.address || '0x0000000000000000000000000000000000000000000000000000000000000000';
      tx.setSender(sender);
      
      const transactionBlock = await tx.build({ client });
      
      const dryRunResult = await client.dryRunTransactionBlock({
        transactionBlock,
      });
      
      setResult({
        success: dryRunResult.effects?.status?.status === 'success',
        gasUsed: dryRunResult.effects?.gasUsed?.computationCost || '0',
        objectChanges: dryRunResult.objectChanges,
        events: dryRunResult.events,
        effects: dryRunResult.effects,
        error: dryRunResult.effects?.status?.error,
      });
      
      toast({
        title: "Dry Run Complete",
        description: dryRunResult.effects?.status?.status === 'success' 
          ? "Transaction simulation successful"
          : "Transaction simulation failed",
      });
    } catch (error) {
      console.error('Dry run failed:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Dry run failed',
      });
      toast({
        title: "Dry Run Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecute = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to execute transactions",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsExecuting(true);
      setActiveTab('result');
      
      if (walletType === 'external') {
        // External wallet execution
        const tx = buildTransaction();
        
        signAndExecute(
          {
            transaction: tx,
          },
          {
            onSuccess: async (result) => {
              setResult({
                success: true,
                transactionDigest: result.digest,
                gasUsed: result.effects?.gasUsed?.computationCost || '0',
                objectChanges: result.objectChanges,
                events: result.events,
                effects: result.effects,
              });
              
              // Save to history
              await savePTBHistory(true, result.digest, result.effects?.gasUsed?.computationCost);
              
              toast({
                title: "Transaction Successful",
                description: `Transaction: ${result.digest.slice(0, 10)}...`,
              });
              
              if (onExecutionComplete) {
                onExecutionComplete();
              }
            },
            onError: (error) => {
              setResult({
                success: false,
                error: error.message,
              });
              
              savePTBHistory(false);
              
              toast({
                title: "Transaction Failed",
                description: error.message,
                variant: "destructive",
              });
            },
          }
        );
      } else {
        // Playground wallet execution
        const response = await fetch('/api/ptb/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            commands,
            network,
          }),
        });
        
        const data = await response.json();
        
        if (data.success) {
          setResult({
            success: true,
            transactionDigest: data.transactionDigest,
            gasUsed: data.gasUsed,
            objectChanges: data.objectChanges,
          });
          
          await savePTBHistory(true, data.transactionDigest, data.gasUsed);
          
          toast({
            title: "Transaction Successful",
            description: `Transaction: ${data.transactionDigest.slice(0, 10)}...`,
          });
          
          if (onExecutionComplete) {
            onExecutionComplete();
          }
        } else {
          throw new Error(data.error || 'Transaction failed');
        }
      }
    } catch (error) {
      console.error('Execution failed:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      });
      
      await savePTBHistory(false);
      
      toast({
        title: "Execution Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const savePTBHistory = async (success: boolean, txHash?: string, gasUsed?: string) => {
    if (!user?.id) return;
    
    try {
      // Extract package ID from commands if available
      let packageId = selectedPackage;
      if (!packageId) {
        // Try to extract from MoveCall commands
        const moveCall = commands.find(cmd => cmd.type === 'MoveCall');
        if (moveCall?.target) {
          // Target format: packageId::module::function
          packageId = moveCall.target.split('::')[0];
        }
      }
      
      // Build comprehensive PTB config
      const ptbConfig = {
        commands,
        packageId,
        network,
        timestamp: new Date().toISOString(),
        mode: mode, // 'dry-run' or 'execute'
        walletAddress: currentAccount?.address,
        walletType: walletType,
      };
      
      // Build comprehensive execution result
      const executionResult = {
        ...result,
        transactionDigest: txHash,
        gasUsed: gasUsed,
        network,
        timestamp: new Date().toISOString(),
      };
      
      await supabase
        .from('ptb_history')
        .insert({
          user_id: user.id,
          project_id: projectId,
          ptb_config: ptbConfig,
          execution_result: executionResult,
          network,
          transaction_hash: txHash,
          gas_used: gasUsed ? parseInt(gasUsed) : null,
          status: success ? 'success' : 'failed',
        });
    } catch (error) {
      console.error('Failed to save PTB history:', error);
    }
  };


  const openExplorer = () => {
    if (result?.transactionDigest) {
      window.open(
        `https://explorer.iota.org/transaction/${result.transactionDigest}?network=${network}`,
        '_blank'
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'dry-run' ? (
              <>
                <Eye className="h-5 w-5" />
                PTB Dry Run
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                Execute PTB
              </>
            )}
            <Badge variant="outline">{network}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="result" disabled={!result}>
              Result
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-4">
            <ScrollArea className="h-[400px] border rounded-md p-4">
              <div className="space-y-3">
                {commands.map((command, index) => (
                  <div key={index} className="p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{index + 1}</Badge>
                      <Badge>{command.type}</Badge>
                      {command.description && (
                        <span className="text-sm text-muted-foreground">
                          {command.description}
                        </span>
                      )}
                    </div>
                    <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(command, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {!isConnected && mode === 'execute' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Connect your wallet to execute this transaction
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="result" className="space-y-4">
            {result && (
              <ScrollArea className="h-[400px] border rounded-md p-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-semibold">
                      {result.success ? 'Success' : 'Failed'}
                    </span>
                  </div>

                  {result.transactionDigest && (
                    <div>
                      <Label className="text-sm">Transaction Digest</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs bg-muted p-2 rounded flex-1">
                          {result.transactionDigest}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={openExplorer}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {result.gasUsed && (
                    <div>
                      <Label className="text-sm">Gas Used</Label>
                      <Badge variant="outline" className="mt-1">
                        {result.gasUsed} MIST
                      </Badge>
                    </div>
                  )}

                  {result.error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{result.error}</AlertDescription>
                    </Alert>
                  )}

                  {result.objectChanges && result.objectChanges.length > 0 && (
                    <div>
                      <Label className="text-sm">Object Changes</Label>
                      <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                        {JSON.stringify(result.objectChanges, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {mode === 'dry-run' ? (
            <Button
              onClick={handleDryRun}
              disabled={isExecuting || commands.length === 0}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Simulating...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Run Simulation
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleExecute}
              disabled={isExecuting || !isConnected || commands.length === 0}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Execute Transaction
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add missing Label import at the top
import { Label } from '@/components/ui/label';