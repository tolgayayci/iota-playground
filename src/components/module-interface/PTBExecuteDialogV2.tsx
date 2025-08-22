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
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface PTBExecuteDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: ModuleFunction;
  packageId: string;
  projectId: string;
  onExecute: (result: any) => void;
  network?: 'testnet' | 'mainnet';
  onExecutionSaved?: () => void; // Callback when execution is saved to history
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
  network = 'testnet',
  onExecutionSaved
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
  const { 
    currentAccount, 
    walletType, 
    isPlaygroundConnected, 
    isExternalConnected,
    connectPlaygroundWallet,
    connectExternalWallet,
    network: currentNetwork 
  } = useWallet();
  const { user } = useAuth();
  
  // Save execution history to database
  const saveExecutionHistory = async (
    status: 'success' | 'failed',
    functionName: string,
    moduleName: string | undefined,
    params: any[],
    executionResult: any,
    txHash?: string,
    gasUsed?: number
  ) => {
    if (!user?.id) return;
    
    // Use fallback module name if not provided
    const finalModuleName = moduleName || 'unknown_module';
    
    try {
      const { error } = await supabase
        .from('ptb_history')
        .insert({
          user_id: user.id,
          project_id: projectId,
          ptb_config: {
            functionName,
            moduleName: finalModuleName,
            packageId,
            parameters: params,
            deploymentId: packageId
          },
          execution_result: executionResult,
          network,
          transaction_hash: txHash,
          gas_used: gasUsed,
          status,
          created_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('Failed to save execution history:', error);
        console.error('Details:', { functionName, moduleName: finalModuleName, packageId, params });
      } else {
        console.log('Execution history saved successfully for', functionName, 'in module', finalModuleName);
        // Trigger callback to refresh history
        if (onExecutionSaved) {
          onExecutionSaved();
        }
      }
    } catch (err) {
      console.error('Error saving execution history:', err);
    }
  };
  
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
      // Entry functions need a wallet - use the currently connected wallet
      if (network === 'testnet') {
        // Testnet: Check what wallet is actually connected
        if (isPlaygroundConnected) {
          selection = { 
            type: 'playground', 
            canExecute: true,
            message: 'Using Playground Wallet (testnet only)'
          };
        } else if (isExternalConnected) {
          selection = { 
            type: 'external', 
            canExecute: true,
            message: `Using ${currentAccount?.label || 'External Wallet'}`
          };
        } else {
          // No wallet connected - suggest connection
          selection = { 
            type: 'none', 
            canExecute: false,
            message: 'Connect a wallet to execute this function (Playground or External)'
          };
        }
      } else {
        // Mainnet requires external wallet
        if (isExternalConnected) {
          selection = { 
            type: 'external', 
            canExecute: true,
            message: `Using ${currentAccount?.label || 'External Wallet'} (mainnet)`
          };
        } else if (isPlaygroundConnected) {
          // Playground wallet connected but on mainnet
          selection = { 
            type: 'none', 
            canExecute: false,
            message: 'Playground wallet not supported on mainnet. Please connect an external wallet.'
          };
        } else {
          selection = { 
            type: 'none', 
            canExecute: false,
            message: 'Connect an external wallet for mainnet execution'
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
  }, [isEntryFunction, network, currentAccount, isPlaygroundConnected, isExternalConnected, open]);
  
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
    
    // Normalize type - only trim edges, don't remove all whitespace
    const normalizedType = type.trim().toLowerCase();
    
    console.log(`🔧 Creating argument for type: ${type} (normalized: ${normalizedType}) with value: ${value}`);
    
    // Handle references - types with & or &mut are references to objects
    // This is the ONLY case where we use tx.object() for non-primitive types
    if (normalizedType.includes('&')) {
      console.log('📦 Detected reference type, creating object reference');
      // Remove reference markers to get base type
      const baseType = normalizedType.replace(/^&(mut\s+)?/, '');
      console.log(`📦 Reference type: ${type} -> base type: ${baseType}`);
      
      // Validate object ID format (must be 66 chars: 0x + 64 hex)
      const objectId = normalizeObjectId(value);
      if (!objectId.match(/^0x[0-9a-fA-F]{64}$/)) {
        throw new Error(`Invalid object ID format for ${type}: ${value}. Expected 64-character hex string starting with 0x.`);
      }
      console.log(`📦 Using object ID: ${objectId}`);
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
    
    // Handle primitive types with proper validation
    if (normalizedType === 'u8') {
      const num = parseInt(value);
      if (isNaN(num) || num < 0 || num > 255) {
        throw new Error(`Invalid u8 value: ${value}. Must be 0-255.`);
      }
      return tx.pure.u8(num);
    }
    
    if (normalizedType === 'u16') {
      const num = parseInt(value);
      if (isNaN(num) || num < 0 || num > 65535) {
        throw new Error(`Invalid u16 value: ${value}. Must be 0-65535.`);
      }
      return tx.pure.u16(num);
    }
    
    if (normalizedType === 'u32') {
      const num = parseInt(value);
      if (isNaN(num) || num < 0 || num > 4294967295) {
        throw new Error(`Invalid u32 value: ${value}. Must be 0-4294967295.`);
      }
      return tx.pure.u32(num);
    }
    
    if (normalizedType === 'u64') {
      try {
        const bigintValue = BigInt(value);
        if (bigintValue < 0n || bigintValue > 18446744073709551615n) {
          throw new Error(`Invalid u64 value: ${value}. Must be 0-18446744073709551615.`);
        }
        // Pass as string to prevent precision loss - IOTA SDK requirement
        return tx.pure.u64(value);
      } catch (e) {
        throw new Error(`Invalid u64 value: ${value}. Must be a valid integer.`);
      }
    }
    
    if (normalizedType === 'u128') {
      try {
        const bigintValue = BigInt(value);
        if (bigintValue < 0n) {
          throw new Error(`Invalid u128 value: ${value}. Must be non-negative.`);
        }
        // Pass as string for large numbers - IOTA SDK requirement
        return tx.pure.u128(value);
      } catch (e) {
        throw new Error(`Invalid u128 value: ${value}. Must be a valid integer.`);
      }
    }
    
    if (normalizedType === 'u256') {
      try {
        const bigintValue = BigInt(value);
        if (bigintValue < 0n) {
          throw new Error(`Invalid u256 value: ${value}. Must be non-negative.`);
        }
        // Pass as string for large numbers - IOTA SDK requirement
        return tx.pure.u256(value);
      } catch (e) {
        throw new Error(`Invalid u256 value: ${value}. Must be a valid integer.`);
      }
    }
    
    if (normalizedType === 'bool') {
      const boolValue = value.toLowerCase() === 'true';
      return tx.pure.bool(boolValue);
    }
    
    if (normalizedType === 'address' || normalizedType === 'signer') {
      // Validate address format - must be hex string with 0x prefix
      if (!value.match(/^0x[0-9a-fA-F]+$/)) {
        throw new Error(`Invalid address format: ${value}. Must be hex string starting with 0x.`);
      }
      return tx.pure.address(value);
    }
    
    // Default to string
    return tx.pure.string(value);
  };
  
  // Execute with playground wallet (testnet only)
  const executeWithPlaygroundWallet = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      
      const moduleName = method.module || 'unknown_module';
      console.log('Using module name:', moduleName, 'for function:', method.name);
      
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
      const moduleName = method.module || 'unknown_module';
      console.log('Using module name:', moduleName, 'for function:', method.name);
      
      const functionTarget = `${packageId}::${moduleName}::${method.name}`;
      
      if (isEntryFunction) {
        // Entry function - execute on chain
        if (walletSelection.type === 'playground') {
          const result = await executeWithPlaygroundWallet();
          setResult(result);
          setExecutionState(ExecutionState.SUCCESS);
          onExecute(result);
          
          // Save execution history for playground wallet
          await saveExecutionHistory(
            'success',
            method.name,
            moduleName,
            Object.values(inputs),
            result,
            result.transactionDigest,
            result.gasUsed
          );
          
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
          
          // Capture inputs for the callback closure
          const inputValues = Object.values(inputs);
          const capturedModuleName = moduleName;
          const capturedMethodName = method.name;
          
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
            onSuccess: async (result) => {
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
              
              // Save to execution history
              console.log('Saving execution history for:', capturedMethodName, 'in module:', capturedModuleName, 'with params:', inputValues);
              await saveExecutionHistory(
                'success',
                capturedMethodName,
                capturedModuleName,
                inputValues,
                {
                  success: true,
                  transactionDigest: result.digest,
                  gasUsed: result.effects?.gasUsed?.computationCost,
                  returnValues: outputs
                },
                result.digest,
                parseInt(result.effects?.gasUsed?.computationCost || '0')
              );
              
              toast({
                title: "Success",
                description: `Transaction ${result.digest.slice(0, 8)}... executed successfully`,
              });
            },
            onError: async (error) => {
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
              
              // Save failed execution to history
              await saveExecutionHistory(
                'failed',
                capturedMethodName,
                capturedModuleName,
                inputValues,
                { error: errorMessage }
              );
              
              toast({
                title: "Transaction Failed",
                description: errorMessage,
                variant: "destructive",
              });
            }
          });
        }
      } else {
        // View function - use backend endpoint
        console.log('🔄 Executing view function through backend');
        
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        
        // Prepare function arguments with type information
        const functionArgs = parameters.map(param => ({
          value: inputs[param.name] || '',
          type: param.type
        }));
        
        // Optional: get current account address as sender if available
        const sender = currentAccount?.address;
        
        console.log('📞 Calling backend view function:', {
          functionTarget,
          functionArgs,
          network,
          sender
        });
        
        const response = await fetch(`${API_URL}/v2/ptb/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            functionTarget,
            functionArgs,
            network,
            sender,
          }),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'View function execution failed');
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          const { returnValues, gasUsed } = result.data;
          
          // Format return values for display
          const outputs = [];
          if (returnValues && returnValues.length > 0) {
            const formattedValues = returnValues.map((value: any) => {
              if (value.type && value.value !== undefined) {
                return `${value.value} (${value.type})`;
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
            gasUsed: gasUsed || '0',
          };
          
          setResult(successResult);
          setExecutionState(ExecutionState.SUCCESS);
          onExecute(successResult);
          
          // Save view function execution to history
          const moduleNameForView = method.module || 'unknown_module';
          await saveExecutionHistory(
            'success',
            method.name,
            moduleNameForView,
            Object.values(inputs),
            { returnValues: returnValues },
            undefined, // No transaction hash for view functions
            parseInt(gasUsed || '0')
          );
          
          toast({
            title: "Success",
            description: "View function executed successfully",
          });
        } else {
          throw new Error(result.message || 'View function execution failed');
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
      
      // Save failed execution to history  
      const moduleNameForGeneralError = method.module || 'unknown_module';
      await saveExecutionHistory(
        'failed',
        method.name,
        moduleNameForGeneralError,
        Object.values(inputs),
        { error: errorMessage }
      );
      
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
          
          {/* Show wallet connection button if needed */}
          {isEntryFunction && !walletSelection.canExecute && (
            <>
              {network === 'testnet' && !isPlaygroundConnected && !isExternalConnected && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await connectPlaygroundWallet();
                  }}
                  className="gap-2"
                >
                  <Wallet className="h-4 w-4" />
                  Connect Playground
                </Button>
              )}
              {(!isExternalConnected && (network === 'mainnet' || (network === 'testnet' && !isPlaygroundConnected))) && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await connectExternalWallet();
                  }}
                  className="gap-2"
                >
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                </Button>
              )}
            </>
          )}
          
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