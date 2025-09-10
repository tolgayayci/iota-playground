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
  PlayCircle,
  Eye,
} from 'lucide-react';
import { ModuleFunction } from '@/lib/types';
import { ParameterInput } from './inputs';
import { ParameterValidator } from './ParameterValidator';
import { ExecutionResultDisplay, ExecutionResult as ResultDisplayType } from './ExecutionResultDisplay';
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

// Use ResultDisplayType from ExecutionResultDisplay component
type ExecutionResult = ResultDisplayType;

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
  const [inputValidations, setInputValidations] = useState<Record<string, boolean>>({});
  const [executionState, setExecutionState] = useState<ExecutionState>(ExecutionState.IDLE);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [walletSelection, setWalletSelection] = useState<WalletSelection>({ 
    type: 'none', 
    canExecute: false 
  });
  const [showResultTab, setShowResultTab] = useState(false);
  
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
  const allParametersFilled = parameters.every(param => {
    const value = inputs[param.name]?.trim();
    const isValid = inputValidations[param.name] !== false;
    return value && isValid;
  });
  
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
  
  // Handle validation changes
  const handleValidationChange = (name: string, isValid: boolean) => {
    setInputValidations(prev => ({ ...prev, [name]: isValid }));
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
          const playgroundResult = await executeWithPlaygroundWallet();
          
          // Convert playground result to ExecutionResult format
          const executionResult: ExecutionResult = {
            status: 'success',
            txHash: playgroundResult.txHash,
            digest: playgroundResult.txHash,
            network,
            timestamp: new Date().toISOString(),
            gasUsed: playgroundResult.gasUsed,
            objectChanges: playgroundResult.outputs,
            functionName: method.name,
            moduleName,
            packageId,
            parameters: Object.values(inputs),
          };
          
          setResult(executionResult);
          setExecutionState(ExecutionState.SUCCESS);
          onExecute(executionResult);
          
          // Save execution history for playground wallet
          await saveExecutionHistory(
            'success',
            method.name,
            moduleName,
            Object.values(inputs),
            playgroundResult,
            playgroundResult.transactionDigest,
            playgroundResult.gasUsed
          );
          
          toast({
            title: "Success",
            description: "Transaction executed successfully",
          });
        } else {
          // External wallet execution - build transaction here
          const startTime = Date.now();
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
              
              // Debug log the gas structure
              console.log('🔍 Gas Debug - Full effects:', result.effects);
              console.log('🔍 Gas Debug - effects.gasUsed:', result.effects?.gasUsed);
              console.log('🔍 Gas Debug - typeof gasUsed:', typeof result.effects?.gasUsed);
              if (result.effects?.gasUsed && typeof result.effects.gasUsed === 'object') {
                console.log('🔍 Gas Debug - gasUsed.computationCost:', result.effects.gasUsed.computationCost);
                console.log('🔍 Gas Debug - gasUsed.storageCost:', result.effects.gasUsed.storageCost);
                console.log('🔍 Gas Debug - gasUsed.storageRebate:', result.effects.gasUsed.storageRebate);
              }
              
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
              
              // Calculate total gas used from all components
              const computationCost = parseInt(result.effects?.gasUsed?.computationCost || '0');
              const storageCost = parseInt(result.effects?.gasUsed?.storageCost || '0');
              const storageRebate = parseInt(result.effects?.gasUsed?.storageRebate || '0');
              
              console.log('🔍 Gas Calculation Debug:');
              console.log('  computationCost:', result.effects?.gasUsed?.computationCost, '→', computationCost);
              console.log('  storageCost:', result.effects?.gasUsed?.storageCost, '→', storageCost);
              console.log('  storageRebate:', result.effects?.gasUsed?.storageRebate, '→', storageRebate);
              
              const totalGasUsed = (computationCost + storageCost - storageRebate).toString();
              console.log('  totalGasUsed:', totalGasUsed);
              
              const successResult: ExecutionResult = {
                status: 'success',
                txHash: result.digest,
                digest: result.digest,
                network,
                timestamp: new Date().toISOString(),
                gasUsed: totalGasUsed,
                computationCost: result.effects?.gasUsed?.computationCost,
                storageCost: result.effects?.gasUsed?.storageCost,
                storageRebate: result.effects?.gasUsed?.storageRebate,
                objectChanges: result.objectChanges,
                events: result.events,
                balanceChanges: result.balanceChanges,
                effects: result.effects,
                functionName: capturedMethodName,
                moduleName: capturedModuleName,
                packageId,
                parameters: inputValues,
                executionTime: Date.now() - startTime,
              };
              
              setResult(successResult);
              setExecutionState(ExecutionState.SUCCESS);
              setShowResultTab(true);
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
                  gasUsed: totalGasUsed,
                  returnValues: outputs
                },
                result.digest,
                parseInt(totalGasUsed)
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
                errorDetails: errorDetails,
                network,
                timestamp: new Date().toISOString(),
                functionName: capturedMethodName,
                moduleName: capturedModuleName,
                packageId,
                parameters: inputValues,
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
            returnValues: returnValues,
            gasUsed: gasUsed || '0',
            network,
            timestamp: new Date().toISOString(),
            functionName: method.name,
            moduleName: moduleNameForView,
            packageId,
            parameters: Object.values(inputs),
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
        errorDetails: errorDetails,
        network,
        timestamp: new Date().toISOString(),
        functionName: method.name,
        moduleName: moduleNameForGeneralError,
        packageId,
        parameters: Object.values(inputs),
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
        "w-[95vw] sm:w-[600px]",
        "p-0"
      )}>
        {/* Simplified Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-lg font-semibold">
            {method.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {isEntryFunction ? 'Execute entry function' : 'Call view function'}
          </p>
        </DialogHeader>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Wallet Status Section - Only for Entry Functions */}
          {isEntryFunction && (
            <div className="p-4 rounded-lg border bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200/50 dark:border-blue-800/50 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    walletSelection.type === 'playground' ? "bg-yellow-100 dark:bg-yellow-900/30" : 
                    walletSelection.type === 'external' ? "bg-blue-100 dark:bg-blue-900/30" :
                    "bg-gray-100 dark:bg-gray-800"
                  )}>
                    {walletSelection.type === 'playground' ? (
                      <Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                    ) : walletSelection.type === 'external' ? (
                      <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Wallet className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {walletSelection.type === 'playground' && 'Playground Wallet'}
                        {walletSelection.type === 'external' && (currentAccount?.label || 'External Wallet')}
                        {walletSelection.type === 'none' && 'No Wallet Connected'}
                      </p>
                      {walletSelection.canExecute && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs px-2 py-0",
                            network === 'testnet' 
                              ? "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-400"
                              : "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-400"
                          )}
                        >
                          {network === 'testnet' ? 'Testnet' : 'Mainnet'}
                        </Badge>
                      )}
                    </div>
                    {walletSelection.canExecute && currentAccount?.address && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-mono leading-none">
                          {currentAccount.address.slice(0, 10)}...{currentAccount.address.slice(-8)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-4 w-4 p-0 flex-shrink-0"
                          onClick={() => {
                            const explorerUrl = `https://explorer.iota.org/address/${currentAccount.address}?network=${network}`;
                            window.open(explorerUrl, '_blank');
                          }}
                          title="View address on IOTA Explorer"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Connection Status Indicator */}
                <div className="flex items-center gap-2">
                  {walletSelection.canExecute ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs font-medium text-green-700 dark:text-green-400">Connected</span>
                    </div>
                  ) : (
                    <>  
                      {network === 'testnet' && !isPlaygroundConnected && !isExternalConnected && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => await connectPlaygroundWallet()}
                          className="border-yellow-200 hover:bg-yellow-50 dark:border-yellow-800 dark:hover:bg-yellow-950/50"
                        >
                          <Zap className="h-3.5 w-3.5 mr-1.5 text-yellow-600" />
                          Use Playground
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => await connectExternalWallet()}
                        className="border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950/50"
                      >
                        <Wallet className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                        Connect Wallet
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Parameters Section */}
          {hasParameters ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <span>Function Parameters</span>
                {hasParameters && (
                  <Badge variant="outline" className="text-xs">
                    {parameters.length} {parameters.length === 1 ? 'param' : 'params'}
                  </Badge>
                )}
              </h3>
              <div className="space-y-3">
                {parameters.map((param, index) => (
                  <ParameterValidator
                    key={index}
                    name={param.name}
                    type={param.type}
                    value={inputs[param.name] || ''}
                    onChange={(value) => handleInputChange(param.name, value)}
                    onValidationChange={(isValid) => handleValidationChange(param.name, isValid)}
                    required={true}
                    index={index}
                    packageId={packageId}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <PlayCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>This function has no parameters</p>
              <p className="text-xs mt-1">Click execute to run it directly</p>
            </div>
          )}
          
          {/* Result Section - Using Enhanced Display Component */}
          {result && result.status !== 'pending' && (
            <div className="mt-6 pt-6 border-t">
              <ExecutionResultDisplay 
                result={result}
                showCodeGeneration={true}
              />
            </div>
          )}
        </div>
        
        {/* Simplified Footer */}
        <DialogFooter className="px-6 py-4 border-t flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          
          <Button
            onClick={handleExecute}
            disabled={isButtonDisabled()}
            className="min-w-[120px]"
          >
            {executionState === ExecutionState.EXECUTING ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Execute
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}