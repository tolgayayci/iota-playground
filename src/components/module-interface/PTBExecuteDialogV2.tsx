import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Zap,
  Wallet,
} from 'lucide-react';
import { ModuleFunction } from '@/lib/types';
import { ParameterInput } from './inputs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Transaction } from '@iota/iota-sdk/transactions';
import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';
import { useSignAndExecuteTransaction } from '@iota/dapp-kit';
import { useWallet } from '@/contexts/WalletContext';

interface PTBExecuteDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: ModuleFunction;
  packageId: string;
  projectId: string;
  onExecute: (result: any) => void;
  network?: 'testnet' | 'mainnet';
}

interface ExecutionResult {
  status: 'success' | 'error' | 'pending';
  outputs?: any[];
  error?: string;
  txHash?: string;
  gasUsed?: string;
  explorerUrl?: string;
}

enum ExecutionState {
  IDLE = "idle",
  VALIDATING = "validating",
  READY = "ready",
  EXECUTING = "executing",
  SUCCESS = "success",
  ERROR = "error"
}

interface WalletSelection {
  type: 'playground' | 'external' | 'none';
  canExecute: boolean;
  message?: string;
}

export function PTBExecuteDialogV2({
  open,
  onOpenChange,
  method,
  packageId,
  projectId,
  onExecute,
  network = 'testnet'
}: PTBExecuteDialogV2Props) {
  // Core state
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [executionState, setExecutionState] = useState<ExecutionState>(ExecutionState.IDLE);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [walletSelection, setWalletSelection] = useState<WalletSelection>({ 
    type: 'none', 
    canExecute: false 
  });
  
  // Hooks
  const { toast } = useToast();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { currentAccount } = useWallet();
  
  // Derived state
  const isEntryFunction = method.is_entry === true;
  const parameters = (method.parameters || []).filter(
    param => !param.type.toLowerCase().includes('txcontext')
  );
  const hasParameters = parameters.length > 0;
  const allParametersFilled = parameters.every(param => inputs[param.name]?.trim());
  
  // Determine wallet selection based on function type and network
  useEffect(() => {
    if (!open) return;
    
    let selection: WalletSelection;
    
    if (isEntryFunction) {
      // Entry functions need a wallet
      if (network === 'testnet') {
        // Can use either playground or external wallet on testnet
        if (currentAccount) {
          selection = { 
            type: 'external', 
            canExecute: true,
            message: 'Using connected wallet'
          };
        } else {
          selection = { 
            type: 'playground', 
            canExecute: true,
            message: 'Using playground wallet (testnet only)'
          };
        }
      } else {
        // Mainnet requires external wallet
        if (currentAccount) {
          selection = { 
            type: 'external', 
            canExecute: true,
            message: 'Using connected wallet'
          };
        } else {
          selection = { 
            type: 'none', 
            canExecute: false,
            message: 'Please connect wallet for mainnet'
          };
        }
      }
    } else {
      // View functions don't need a wallet
      selection = { 
        type: 'none', 
        canExecute: true,
        message: 'View function - no wallet needed'
      };
    }
    
    setWalletSelection(selection);
  }, [isEntryFunction, network, currentAccount, open]);
  
  // Update execution state based on inputs
  useEffect(() => {
    if (!hasParameters) {
      setExecutionState(ExecutionState.READY);
    } else if (allParametersFilled) {
      setExecutionState(ExecutionState.READY);
    } else {
      setExecutionState(ExecutionState.IDLE);
    }
  }, [hasParameters, allParametersFilled]);
  
  // Handle input changes
  const handleInputChange = (name: string, value: string) => {
    setInputs(prev => ({ ...prev, [name]: value }));
  };
  
  // Normalize object IDs from explorer format
  const normalizeObjectId = (objectId: string): string => {
    const cleanId = objectId.trim();
    if (!cleanId.startsWith('0x')) {
      return `0x${cleanId}`;
    }
    
    const hexPart = cleanId.slice(2);
    if (hexPart.length < 64) {
      return `0x${hexPart.padStart(64, '0')}`;
    }
    
    return cleanId.toLowerCase();
  };
  
  // Create transaction argument with proper IOTA SDK methods
  const createTransactionArgument = (value: string, type: string, tx: Transaction): any => {
    if (!value.trim()) {
      throw new Error(`Value is required for type ${type}`);
    }
    
    const normalizedType = type.toLowerCase().replace(/\s+/g, '');
    
    // Handle references - always need object IDs
    if (normalizedType.startsWith('&') || normalizedType.startsWith('0x')) {
      // For object references, ensure we have a valid object ID
      const objectId = normalizeObjectId(value);
      return tx.object(objectId);
    }
    
    // Handle struct types (custom objects)
    if (normalizedType.includes('::')) {
      const objectId = normalizeObjectId(value);
      return tx.object(objectId);
    }
    
    // Handle vector types
    if (normalizedType.startsWith('vector<')) {
      const elementTypeMatch = normalizedType.match(/vector<(.+)>/);
      const elementType = elementTypeMatch ? elementTypeMatch[1].trim() : 'string';
      
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          throw new Error('Vector must be an array');
        }
        
        // Handle different element types
        if (['u8', 'u16', 'u32'].includes(elementType)) {
          const values = parsed.map(v => Number(v));
          return tx.pure.vector(elementType, values);
        } else if (['u64', 'u128', 'u256'].includes(elementType)) {
          // Use strings for large numbers to prevent precision loss
          const values = parsed.map(v => String(v));
          return tx.pure.vector(elementType, values);
        } else if (elementType === 'bool') {
          const values = parsed.map(v => Boolean(v));
          return tx.pure.vector("bool", values);
        } else if (elementType === 'address') {
          const values = parsed.map(v => String(v));
          return tx.pure.vector("address", values);
        } else {
          return tx.pure.vector("string", parsed.map(v => String(v)));
        }
      } catch (error) {
        throw new Error(`Invalid vector format: ${value}`);
      }
    }
    
    // Handle primitive types
    if (normalizedType === 'u8') {
      const num = parseInt(value);
      if (isNaN(num) || num < 0 || num > 255) {
        throw new Error('u8 must be 0-255');
      }
      return tx.pure.u8(num);
    }
    
    if (normalizedType === 'u16') {
      const num = parseInt(value);
      if (isNaN(num) || num < 0 || num > 65535) {
        throw new Error('u16 must be 0-65535');
      }
      return tx.pure.u16(num);
    }
    
    if (normalizedType === 'u32') {
      const num = parseInt(value);
      if (isNaN(num) || num < 0 || num > 4294967295) {
        throw new Error('u32 must be 0-4294967295');
      }
      return tx.pure.u32(num);
    }
    
    if (normalizedType === 'u64') {
      try {
        const bigintValue = BigInt(value);
        if (bigintValue < 0n || bigintValue > 18446744073709551615n) {
          throw new Error('u64 out of range');
        }
        // Use string to prevent precision loss
        return tx.pure.u64(value);
      } catch {
        throw new Error('Invalid u64 value');
      }
    }
    
    if (normalizedType === 'u128' || normalizedType === 'u256') {
      try {
        const bigintValue = BigInt(value);
        if (bigintValue < 0n) {
          throw new Error(`${normalizedType} must be positive`);
        }
        return tx.pure[normalizedType](value);
      } catch {
        throw new Error(`Invalid ${normalizedType} value`);
      }
    }
    
    if (normalizedType === 'bool') {
      const boolValue = value.toLowerCase() === 'true';
      return tx.pure.bool(boolValue);
    }
    
    if (normalizedType === 'address' || normalizedType === 'signer') {
      const address = value.startsWith('0x') ? value : `0x${value}`;
      if (address.length !== 66) {
        throw new Error('Address must be 64 hex characters');
      }
      return tx.pure.address(address);
    }
    
    // Default to string
    return tx.pure.string(value);
  };
  
  // Execute with playground wallet (testnet only)
  const executeWithPlaygroundWallet = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      
      const moduleName = method.module;
      if (!moduleName) {
        throw new Error('Module name is required');
      }
      
      const functionArgs = parameters.map(param => ({
        value: inputs[param.name] || '',
        type: param.type
      }));
      
      const response = await fetch(`${API_URL}/v2/ptb/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          functionTarget: `${packageId}::${moduleName}::${method.name}`,
          functionArgs,
          network,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Execution failed');
      }
      
      const result = await response.json();
      return {
        status: 'success' as const,
        txHash: result.data.transactionDigest,
        gasUsed: result.data.gasUsed || '0',
        outputs: result.data.objectChanges || [],
        explorerUrl: `https://explorer.iota.org/txblock/${result.data.transactionDigest}?network=${network}`,
      };
    } catch (error) {
      throw error;
    }
  };
  
  // Main execution handler
  const handleExecute = async () => {
    if (executionState !== ExecutionState.READY || !walletSelection.canExecute) {
      return;
    }
    
    setExecutionState(ExecutionState.EXECUTING);
    setResult({ status: 'pending' });
    
    try {
      const moduleName = method.module;
      if (!moduleName) {
        throw new Error('Module name is required');
      }
      
      const functionTarget = `${packageId}::${moduleName}::${method.name}`;
      
      if (isEntryFunction) {
        // Entry function - execute on chain
        if (walletSelection.type === 'playground') {
          const result = await executeWithPlaygroundWallet();
          setResult(result);
          setExecutionState(ExecutionState.SUCCESS);
          onExecute(result);
          
          toast({
            title: "Success",
            description: "Transaction executed successfully",
          });
        } else {
          // External wallet execution - build transaction here
          const client = new IotaClient({ url: getFullnodeUrl(network) });
          const tx = new Transaction();
          
          // DO NOT set sender - dapp-kit handles this automatically
          // The signAndExecuteTransaction hook will:
          // 1. Get the current account from wallet
          // 2. Set the sender
          // 3. Sign and execute
          
          // Build transaction arguments
          const transactionArgs = parameters.map(param => {
            const value = inputs[param.name] || '';
            return createTransactionArgument(value, param.type, tx);
          });
          
          // Add the move call
          tx.moveCall({
            target: functionTarget,
            arguments: transactionArgs,
          });
          
          // Execute with external wallet
          signAndExecute({
            transaction: tx,
            options: {
              showEffects: true,
              showObjectChanges: true,
              showEvents: true,
              showBalanceChanges: true,
            }
          }, {
            onSuccess: (result) => {
              console.log('Transaction successful:', result);
              
              // Extract ALL relevant data from the transaction
              const outputs = [];
              
              // Add object changes (created, modified, deleted objects)
              if (result.objectChanges && result.objectChanges.length > 0) {
                outputs.push({
                  type: 'objectChanges',
                  label: 'Object Changes',
                  data: result.objectChanges
                });
              }
              
              // Add events emitted
              if (result.events && result.events.length > 0) {
                outputs.push({
                  type: 'events',
                  label: 'Events',
                  data: result.events
                });
              }
              
              // Add balance changes
              if (result.balanceChanges && result.balanceChanges.length > 0) {
                outputs.push({
                  type: 'balanceChanges',
                  label: 'Balance Changes',
                  data: result.balanceChanges
                });
              }
              
              // Add effects summary
              if (result.effects) {
                outputs.push({
                  type: 'effects',
                  label: 'Transaction Effects',
                  data: {
                    status: result.effects.status,
                    gasUsed: result.effects.gasUsed,
                    dependencies: result.effects.dependencies,
                  }
                });
              }
              
              const successResult: ExecutionResult = {
                status: 'success',
                outputs,
                txHash: result.digest,
                gasUsed: result.effects?.gasUsed?.computationCost || '0',
                explorerUrl: `https://explorer.iota.org/txblock/${result.digest}?network=${network}`,
              };
              
              setResult(successResult);
              setExecutionState(ExecutionState.SUCCESS);
              onExecute(successResult);
              
              toast({
                title: "Success",
                description: `Transaction ${result.digest.slice(0, 8)}... executed successfully`,
              });
            },
            onError: (error) => {
              console.error('Transaction execution failed:', error);
              
              // Extract detailed error information
              const errorMessage = error?.message || error?.toString() || 'Transaction failed';
              const errorDetails = error?.cause || error?.stack || '';
              
              const errorResult: ExecutionResult = {
                status: 'error',
                error: errorMessage,
                outputs: errorDetails ? [{ 
                  type: 'errorDetails', 
                  label: 'Error Details',
                  data: errorDetails 
                }] : []
              };
              
              setResult(errorResult);
              setExecutionState(ExecutionState.ERROR);
              
              toast({
                title: "Transaction Failed",
                description: errorMessage,
                variant: "destructive",
              });
            }
          });
        }
      } else {
        // View function - use devInspect
        const client = new IotaClient({ url: getFullnodeUrl(network) });
        
        // For view functions, we need to determine the appropriate sender
        // If the function accesses owned objects, we need to use the owner's address
        let inspectSender = '0x0000000000000000000000000000000000000000000000000000000000000000';
        
        // Check if any parameters are object references that might be owned
        const hasOwnedObjects = parameters.some(param => {
          const type = param.type.toLowerCase();
          return type.startsWith('&') && inputs[param.name];
        });
        
        if (hasOwnedObjects) {
          // Try to get the owner of the first object reference
          for (const param of parameters) {
            if (param.type.toLowerCase().startsWith('&') && inputs[param.name]) {
              try {
                const objectId = normalizeObjectId(inputs[param.name]);
                const objectInfo = await client.getObject({
                  id: objectId,
                  options: { showOwner: true }
                });
                
                if (objectInfo.data?.owner) {
                  if (typeof objectInfo.data.owner === 'object' && 'AddressOwner' in objectInfo.data.owner) {
                    inspectSender = objectInfo.data.owner.AddressOwner;
                    console.log('Using object owner as sender for devInspect:', inspectSender);
                    break;
                  } else if (typeof objectInfo.data.owner === 'object' && 'ObjectOwner' in objectInfo.data.owner) {
                    // For ObjectOwner, we need to find the ultimate owner
                    // For now, use current account if available
                    if (currentAccount?.address) {
                      inspectSender = currentAccount.address;
                      console.log('Object owned by another object, using current account:', inspectSender);
                    }
                    break;
                  } else if (typeof objectInfo.data.owner === 'string') {
                    inspectSender = objectInfo.data.owner;
                    console.log('Using object owner as sender for devInspect:', inspectSender);
                    break;
                  }
                }
              } catch (error) {
                console.warn('Could not fetch object owner:', error);
                // If we can't fetch the owner but have a current account, use it
                if (currentAccount?.address) {
                  inspectSender = currentAccount.address;
                  console.log('Using current account as fallback:', inspectSender);
                }
              }
            }
          }
        }
        
        // If still using zero address and we have a current account, use it
        if (inspectSender === '0x0000000000000000000000000000000000000000000000000000000000000000' && currentAccount?.address) {
          inspectSender = currentAccount.address;
          console.log('Using current account as default sender:', inspectSender);
        }
        
        // Build transaction with proper ordering
        const tx = new Transaction();
        
        // Build transaction arguments first
        const transactionArgs: any[] = [];
        for (const param of parameters) {
          const value = inputs[param.name] || '';
          try {
            const arg = createTransactionArgument(value, param.type, tx);
            transactionArgs.push(arg);
          } catch (error) {
            console.error(`Error creating argument for ${param.name}:`, error);
            throw new Error(`Invalid value for parameter ${param.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        
        // Now add the move call with the arguments
        const moveCallResult = tx.moveCall({
          target: functionTarget,
          arguments: transactionArgs,
        });
        
        // Set the sender after building the transaction structure
        tx.setSender(inspectSender);
        
        // Execute devInspect
        let devInspectResult;
        try {
          devInspectResult = await client.devInspectTransactionBlock({
            transactionBlock: await tx.build({ client }),
            sender: inspectSender,
          });
        } catch (error) {
          console.error('devInspect failed:', error);
          
          // If it fails with current approach, try with zero address as last resort
          if (inspectSender !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            console.log('Retrying with zero address');
            
            const tx2 = new Transaction();
            const zeroAddress = '0x0000000000000000000000000000000000000000000000000000000000000000';
            
            // Build arguments first
            const transactionArgs2: any[] = [];
            for (const param of parameters) {
              const value = inputs[param.name] || '';
              const arg = createTransactionArgument(value, param.type, tx2);
              transactionArgs2.push(arg);
            }
            
            // Add move call
            tx2.moveCall({
              target: functionTarget,
              arguments: transactionArgs2,
            });
            
            // Set sender after building
            tx2.setSender(zeroAddress);
            
            try {
              devInspectResult = await client.devInspectTransactionBlock({
                transactionBlock: await tx2.build({ client }),
                sender: zeroAddress,
              });
            } catch (secondError) {
              // Both attempts failed, throw the original error
              throw error;
            }
          } else {
            throw error;
          }
        }
        
        if (devInspectResult.effects?.status?.status === 'success') {
          const rawOutputs = devInspectResult.results?.[0]?.returnValues || [];
          
          // Process and format the return values
          const outputs = [];
          if (rawOutputs.length > 0) {
            const formattedValues = rawOutputs.map((value: any, index: number) => {
              if (Array.isArray(value) && value.length === 2) {
                const [data, type] = value;
                
                // Try to decode based on type
                if (type && data) {
                  try {
                    // For number types, decode the bytes
                    if (['u8', 'u16', 'u32', 'u64', 'u128', 'u256'].includes(type)) {
                      const bytes = new Uint8Array(data);
                      let num = BigInt(0);
                      for (let i = 0; i < bytes.length; i++) {
                        num = num | (BigInt(bytes[i]) << BigInt(i * 8));
                      }
                      return `${num.toString()} (${type})`;
                    }
                    
                    // For bool
                    if (type === 'bool') {
                      return `${data[0] === 1} (bool)`;
                    }
                    
                    // For address
                    if (type === 'address') {
                      const hex = '0x' + Array.from(data, (byte: any) => 
                        byte.toString(16).padStart(2, '0')
                      ).join('');
                      return `${hex} (address)`;
                    }
                    
                    // Default: show raw data
                    return `[${data.join(', ')}] (${type})`;
                  } catch (e) {
                    console.error('Error decoding value:', e);
                    return `[${data.join(', ')}] (${type})`;
                  }
                }
              }
              return JSON.stringify(value);
            });
            
            outputs.push({
              type: 'returnValues',
              label: 'Return Values',
              data: formattedValues
            });
          }
          
          const successResult: ExecutionResult = {
            status: 'success',
            outputs: outputs.length > 0 ? outputs : [{
              type: 'info',
              label: 'Result',
              data: 'Function executed successfully (no return values)'
            }],
          };
          
          setResult(successResult);
          setExecutionState(ExecutionState.SUCCESS);
          onExecute(successResult);
          
          toast({
            title: "Success",
            description: "View function executed successfully",
          });
        } else {
          throw new Error(devInspectResult.effects?.status?.error || 'Execution failed');
        }
      }
    } catch (error) {
      console.error('Execution error:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error) || 'Execution failed';
      const errorDetails = error instanceof Error ? error.stack : undefined;
      
      setResult({
        status: 'error',
        error: errorMessage,
        outputs: errorDetails ? [{
          type: 'errorDetails',
          label: 'Stack Trace',
          data: errorDetails
        }] : []
      });
      setExecutionState(ExecutionState.ERROR);
      
      toast({
        title: "Execution Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };
  
  // Get button text based on state
  const getButtonText = () => {
    switch (executionState) {
      case ExecutionState.IDLE:
        return 'Enter Parameters';
      case ExecutionState.VALIDATING:
        return 'Validating...';
      case ExecutionState.READY:
        return isEntryFunction ? 'Execute Function' : 'Call Function';
      case ExecutionState.EXECUTING:
        return 'Processing...';
      case ExecutionState.SUCCESS:
        return 'Executed';
      case ExecutionState.ERROR:
        return 'Retry';
      default:
        return 'Execute';
    }
  };
  
  // Get button disabled state
  const isButtonDisabled = () => {
    return executionState === ExecutionState.IDLE || 
           executionState === ExecutionState.VALIDATING ||
           executionState === ExecutionState.EXECUTING ||
           !walletSelection.canExecute;
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "flex flex-col",
        "max-h-[90vh]",
        "w-[95vw] sm:w-[700px] lg:w-[800px]",
        "p-0"
      )}>
        {/* Fixed Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-background">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-lg">{method.name}</span>
              <Badge 
                variant={isEntryFunction ? "default" : "secondary"}
                className="text-xs"
              >
                {isEntryFunction ? 'Entry' : 'View'}
              </Badge>
            </div>
            
            {/* Wallet Indicator */}
            {isEntryFunction && (
              <div className="flex items-center gap-2">
                {walletSelection.type === 'playground' && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Zap className="h-3 w-3" />
                    Playground
                  </Badge>
                )}
                {walletSelection.type === 'external' && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Wallet className="h-3 w-3" />
                    Connected
                  </Badge>
                )}
              </div>
            )}
          </DialogTitle>
          
          {/* Wallet Message */}
          {walletSelection.message && (
            <p className="text-sm text-muted-foreground mt-2">
              {walletSelection.message}
            </p>
          )}
        </DialogHeader>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Parameters Section */}
          {hasParameters ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Parameters
              </h3>
              <div className="space-y-3">
                {parameters.map((param, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <label className="text-sm font-medium">
                        {param.name}
                      </label>
                      <span className="text-xs text-muted-foreground font-mono">
                        {param.type}
                      </span>
                    </div>
                    <ParameterInput
                      parameter={param}
                      value={inputs[param.name] || ''}
                      onChange={(value) => handleInputChange(param.name, value)}
                      network={network}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              This function has no parameters
            </div>
          )}
          
          {/* Result Section */}
          {result && result.status !== 'pending' && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Result
              </h3>
              
              {result.status === 'success' ? (
                <div className="space-y-3">
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-900 dark:text-green-200">
                      Transaction executed successfully
                    </AlertDescription>
                  </Alert>
                  
                  {/* Transaction Link */}
                  {result.txHash && (
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <span className="text-sm font-medium">Transaction Hash</span>
                        {result.gasUsed && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Gas Used: {result.gasUsed}
                          </p>
                        )}
                      </div>
                      <a
                        href={result.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {result.txHash.slice(0, 8)}...{result.txHash.slice(-6)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  
                  {/* Transaction Outputs - Show each type of output separately */}
                  {result.outputs && result.outputs.length > 0 && (
                    <div className="space-y-3">
                      {result.outputs.map((output: any, index: number) => (
                        <div key={index} className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            {output.label || output.type || 'Output'}
                            {output.data && Array.isArray(output.data) && (
                              <Badge variant="secondary" className="text-xs">
                                {output.data.length} items
                              </Badge>
                            )}
                          </h4>
                          <div className="p-3 bg-muted/50 rounded-lg max-h-[200px] overflow-y-auto">
                            <pre className="text-xs font-mono overflow-x-auto">
                              {typeof output.data === 'string' 
                                ? output.data 
                                : JSON.stringify(output.data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="font-medium">
                      {result.error || 'Transaction failed'}
                    </AlertDescription>
                  </Alert>
                  
                  {/* Error Details if available */}
                  {result.outputs && result.outputs.length > 0 && (
                    <div className="space-y-2">
                      {result.outputs.map((output: any, index: number) => (
                        <div key={index}>
                          <h4 className="text-sm font-medium mb-2">
                            {output.label || 'Error Details'}
                          </h4>
                          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg max-h-[200px] overflow-y-auto">
                            <pre className="text-xs font-mono text-red-900 dark:text-red-200 overflow-x-auto">
                              {typeof output.data === 'string' 
                                ? output.data 
                                : JSON.stringify(output.data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Fixed Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-background">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            onClick={handleExecute}
            disabled={isButtonDisabled()}
            className="min-w-[140px]"
          >
            {executionState === ExecutionState.EXECUTING ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {getButtonText()}
              </>
            ) : (
              getButtonText()
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}