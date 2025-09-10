import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Terminal, 
  PlayCircle, 
  ExternalLink,
  Loader2,
  Info,
  Copy,
  Package,
  FileText as Template,
  Sparkles,
} from 'lucide-react';
import { ModuleFunction } from '@/lib/types';
import { ModuleFunctionSignature } from './ModuleFunctionSignature';
import { ParameterInput, ObjectBrowser, ParameterTemplates, type ParameterSet } from './inputs';
import { useToast } from '@/hooks/use-toast';
import { cn, truncateAddress, shortenTypeString } from '@/lib/utils';
import { Transaction } from '@iota/iota-sdk/transactions';
import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';
import { useSignAndExecuteTransaction } from '@iota/dapp-kit';
import { useWallet } from '@/contexts/WalletContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PTBExecuteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: ModuleFunction;
  packageId: string;
  projectId: string;
  onExecute: (result: any) => void;
}

interface ExecutionResult {
  status: 'success' | 'error' | 'pending';
  outputs?: any[];
  error?: string;
  txHash?: string;
  gasUsed?: string;
  explorerUrl?: string;
}

export function PTBExecuteDialog({
  open,
  onOpenChange,
  method,
  packageId,
  projectId,
  onExecute,
}: PTBExecuteDialogProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [showObjectBrowser, setShowObjectBrowser] = useState(false);
  const [showParameterTemplates, setShowParameterTemplates] = useState(false);
  const [currentParameterForObject, setCurrentParameterForObject] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Wallet hooks for actual execution
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { currentAccount } = useWallet();

  const handleInputChange = (name: string, value: string) => {
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  const handleObjectSelect = (objectId: string, objectInfo?: any) => {
    if (currentParameterForObject) {
      handleInputChange(currentParameterForObject, objectId);
      setCurrentParameterForObject(null);
    }
  };

  const handleTemplateApply = (template: ParameterSet) => {
    const updates: Record<string, string> = {};
    const parameterNames = parameters.map(p => p.name.toLowerCase());
    
    Object.entries(template.values).forEach(([key, value]) => {
      // Find matching parameter by name similarity
      const matchingParam = parameters.find(p => 
        p.name.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(p.name.toLowerCase())
      );
      
      if (matchingParam) {
        updates[matchingParam.name] = value;
      }
    });
    
    setInputs(prev => ({ ...prev, ...updates }));
  };

  const handleCopy = async (content: any) => {
    await navigator.clipboard.writeText(JSON.stringify(content, null, 2));
    toast({
      title: "Copied",
      description: "Content copied to clipboard",
    });
  };

  const executeWithPlaygroundWallet = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      
      const moduleName = method.module;
      if (!moduleName) {
        throw new Error('Module name is required for function execution');
      }

      const parameters = method.parameters || [];
      const userParameters = parameters.filter(param => {
        const normalizedType = param.type.toLowerCase();
        // Filter out TxContext and other system parameters
        return !normalizedType.includes('txcontext') && 
               !normalizedType.includes('tx_context') &&
               !normalizedType.includes('&txcontext') &&
               !normalizedType.includes('&mut txcontext');
      });
      const functionArgs = userParameters.map(param => {
        const value = inputs[param.name] || '';
        if (!value.trim()) {
          throw new Error(`Parameter ${param.name} is required`);
        }
        return {
          value: value,
          type: param.type // Include the Move type for backend parsing
        };
      });

      const functionTarget = `${packageId}::${moduleName}::${method.name}`;
      console.log('🎮 Executing with playground wallet:', functionTarget);

      const response = await fetch(`${API_URL}/v2/ptb/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          functionTarget,
          functionArgs,
          network: 'testnet',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Execution failed');
      }

      const result = await response.json();
      console.log('✅ Playground wallet execution successful:', result);

      // Extract created objects from the result
      const createdObjects = result.data.objectChanges?.filter((change: any) => change.type === 'created') || [];
      const outputs = [];
      
      if (result.data.transactionDigest) {
        outputs.push(`🎮 Transaction Hash: ${result.data.transactionDigest}`);
      }
      
      if (createdObjects.length > 0) {
        outputs.push(`✨ Created ${createdObjects.length} object(s):`);
        createdObjects.forEach((obj: any, index: number) => {
          const objectType = obj.objectType?.split('::').pop() || 'Object';
          outputs.push(`  ${index + 1}. ${objectType}: ${obj.objectId}`);
        });
      }
      
      if (!outputs.length) {
        outputs.push('🎮 Executed with playground wallet! Transaction successful.');
      }

      const successResult: ExecutionResult = {
        status: 'success',
        outputs,
        txHash: result.data.transactionDigest,
        gasUsed: result.data.gasUsed || '0',
        explorerUrl: `https://explorer.iota.org/txblock/${result.data.transactionDigest}?network=testnet`,
      };

      setResult(successResult);
      onExecute(successResult);

      toast({
        title: "🎉 Execution Successful!",
        description: `Function executed with playground wallet! TX: ${result.data.transactionDigest?.slice(0, 8)}...`,
      });

    } catch (error) {
      console.error('❌ Playground wallet execution failed:', error);
      throw error;
    }
  };

  // Create proper IOTA SDK transaction arguments using tx.pure.* and tx.object methods
  const createTransactionArgument = (value: string, type: string, tx: Transaction): any => {
    if (!value.trim()) {
      throw new Error(`Parameter value is required for type ${type}`);
    }
    
    try {
      const normalizedType = type.toLowerCase().trim();
      
      // Normalize object ID input (handle different formats from explorer)
      const normalizeObjectId = (objectId: string): string => {
        const cleanId = objectId.trim();
        if (!cleanId.startsWith('0x')) {
          return `0x${cleanId}`;
        }
        
        // Pad short object IDs to 64 hex characters (32 bytes)
        const hexPart = cleanId.slice(2);
        if (hexPart.length < 64) {
          return `0x${hexPart.padStart(64, '0')}`;
        }
        
        return cleanId.toLowerCase();
      };

      // Check for reference types (& and &mut) - these ALWAYS use tx.object()
      const isReference = normalizedType.startsWith('&');
      if (isReference) {
        const normalizedObjectId = normalizeObjectId(value);
        if (!/^0x[0-9a-f]{64}$/.test(normalizedObjectId)) {
          throw new Error(`Invalid object ID format: ${value}. Must be a valid hex string.`);
        }
        return tx.object(normalizedObjectId);
      }

      // Check for custom struct types (contain ::) - these might be owned objects
      if (normalizedType.includes('::')) {
        // For struct types in parameters, they usually expect object instances
        const normalizedObjectId = normalizeObjectId(value);
        if (!/^0x[0-9a-f]{64}$/.test(normalizedObjectId)) {
          throw new Error(`Invalid object ID for struct type ${type}: ${value}`);
        }
        return tx.object(normalizedObjectId);
      }
      
      // Handle vector types
      if (normalizedType.startsWith('vector<')) {
        const elementTypeMatch = normalizedType.match(/vector<(.+)>/);
        const elementType = elementTypeMatch ? elementTypeMatch[1].trim() : 'string';
        
        if (elementType === 'u8' && value.startsWith('b"') && value.endsWith('"')) {
          // Byte string format b"text" -> convert to u8 array
          const text = value.slice(2, -1);
          const bytes = Array.from(Buffer.from(text, 'utf8'));
          return tx.pure.vector("u8", bytes);
        }
        
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) {
            throw new Error('Vector value must be a JSON array');
          }
          
          // Create typed vector based on element type with proper type handling
          if (['u8', 'u16', 'u32'].includes(elementType)) {
            // Small integers - safe to use numbers
            const numValues = parsed.map((item, index) => {
              const num = Number(item);
              if (isNaN(num) || num < 0) {
                throw new Error(`Invalid ${elementType} value at index ${index}: ${item}`);
              }
              return num;
            });
            return tx.pure.vector(elementType, numValues);
          } else if (['u64', 'u128', 'u256'].includes(elementType)) {
            // Large integers - validate with BigInt but pass appropriate type
            const processedValues = parsed.map((item, index) => {
              try {
                const bigintValue = BigInt(item);
                if (bigintValue < 0n) {
                  throw new Error(`${elementType} must be positive`);
                }
                
                // For u64, use number if safe, otherwise string
                if (elementType === 'u64' && bigintValue <= BigInt(Number.MAX_SAFE_INTEGER)) {
                  return Number(item);
                }
                
                // For u128 and u256, always use string
                return String(item);
              } catch {
                throw new Error(`Invalid ${elementType} value at index ${index}: ${item}`);
              }
            });
            return tx.pure.vector(elementType, processedValues);
          } else if (elementType === 'bool') {
            const boolValues = parsed.map((item, index) => {
              if (typeof item === 'boolean') return item;
              if (typeof item === 'string') {
                const lower = item.toLowerCase();
                if (lower === 'true') return true;
                if (lower === 'false') return false;
              }
              throw new Error(`Invalid boolean value at index ${index}: ${item}`);
            });
            return tx.pure.vector("bool", boolValues);
          } else if (elementType === 'address') {
            const addresses = parsed.map((item, index) => {
              const addr = String(item);
              if (!addr.startsWith('0x') || !/^0x[0-9a-fA-F]{64}$/.test(addr)) {
                throw new Error(`Invalid address at index ${index}: ${item}`);
              }
              return addr.toLowerCase();
            });
            return tx.pure.vector("address", addresses);
          } else {
            // Generic vector - treat as strings
            return tx.pure.vector("string", parsed.map(item => String(item)));
          }
        } catch (parseError) {
          throw new Error(`Invalid vector format for ${type}: ${value}. Use JSON array syntax.`);
        }
      }
      
      // Handle primitive types using proper tx.pure.* methods
      if (normalizedType === 'u8') {
        const num = parseInt(value);
        if (isNaN(num) || num < 0 || num > 255) {
          throw new Error(`u8 value must be between 0 and 255, got: ${value}`);
        }
        return tx.pure.u8(num);
      }
      
      if (normalizedType === 'u16') {
        const num = parseInt(value);
        if (isNaN(num) || num < 0 || num > 65535) {
          throw new Error(`u16 value must be between 0 and 65535, got: ${value}`);
        }
        return tx.pure.u16(num);
      }
      
      if (normalizedType === 'u32') {
        const num = parseInt(value);
        if (isNaN(num) || num < 0 || num > 4294967295) {
          throw new Error(`u32 value must be between 0 and 4294967295, got: ${value}`);
        }
        return tx.pure.u32(num);
      }
      
      if (normalizedType === 'u64') {
        // Use proper number or string handling for u64
        try {
          const bigintValue = BigInt(value);
          if (bigintValue < 0n || bigintValue > 18446744073709551615n) {
            throw new Error(`u64 value must be between 0 and 18446744073709551615, got: ${value}`);
          }
          // Use number for values that fit in safe integer range, string for larger values
          if (bigintValue <= BigInt(Number.MAX_SAFE_INTEGER)) {
            return tx.pure.u64(Number(value));
          } else {
            return tx.pure.u64(value); // Keep as string for large values
          }
        } catch {
          throw new Error(`Invalid u64 value: ${value}`);
        }
      }
      
      if (normalizedType === 'u128') {
        // Always use string for u128 to prevent precision loss
        try {
          const bigintValue = BigInt(value);
          if (bigintValue < 0n || bigintValue > 340282366920938463463374607431768211455n) {
            throw new Error(`u128 value must be between 0 and 340282366920938463463374607431768211455, got: ${value}`);
          }
          return tx.pure.u128(value); // Always as string
        } catch {
          throw new Error(`Invalid u128 value: ${value}`);
        }
      }
      
      if (normalizedType === 'u256') {
        // Always use string for u256 to prevent precision loss
        try {
          const bigintValue = BigInt(value);
          if (bigintValue < 0n) {
            throw new Error(`u256 value must be positive, got: ${value}`);
          }
          return tx.pure.u256(value); // Always as string
        } catch {
          throw new Error(`Invalid u256 value: ${value}`);
        }
      }
      
      if (normalizedType === 'bool') {
        const boolValue = value.toLowerCase() === 'true';
        return tx.pure.bool(boolValue);
      }
      
      if (normalizedType === 'address') {
        const normalizedAddress = normalizeObjectId(value); // Reuse normalization logic
        if (!/^0x[0-9a-f]{64}$/.test(normalizedAddress)) {
          throw new Error(`Invalid address format: ${value}. Must be a valid IOTA address.`);
        }
        return tx.pure.address(normalizedAddress);
      }
      
      if (normalizedType === 'signer') {
        const normalizedAddress = normalizeObjectId(value); // Reuse normalization logic
        if (!/^0x[0-9a-f]{64}$/.test(normalizedAddress)) {
          throw new Error(`Invalid signer address format: ${value}. Must be a valid IOTA address.`);
        }
        return tx.pure.address(normalizedAddress);
      }
      
      // Default to string for unknown types
      return tx.pure.string(value);
      
    } catch (error) {
      console.error(`Error parsing value "${value}" for type "${type}":`, error);
      throw new Error(`Invalid value for type ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleExecute = async () => {
    if (!method || !packageId) return;

    setIsExecuting(true);
    setResult({ status: 'pending' });

    try {
      const client = new IotaClient({ url: getFullnodeUrl('testnet') });
      const tx = new Transaction();

      // Create proper transaction arguments using IOTA SDK patterns (exclude TxContext)
      const parameters = method.parameters || [];
      const userParameters = parameters.filter(param => {
        const normalizedType = param.type.toLowerCase();
        // Filter out TxContext and other system parameters
        return !normalizedType.includes('txcontext') && 
               !normalizedType.includes('tx_context') &&
               !normalizedType.includes('&txcontext') &&
               !normalizedType.includes('&mut txcontext');
      });
      
      const transactionArgs = userParameters.map(param => {
        const value = inputs[param.name] || '';
        if (!value.trim()) {
          throw new Error(`Parameter ${param.name} is required`);
        }
        return createTransactionArgument(value, param.type, tx);
      });

      // Check if this is an entry function (modifies state)
      const isEntryFunction = method.is_entry === true;
      
      if (isEntryFunction) {
        // Entry/State-modifying functions - Check wallet availability
        if (!currentAccount) {
          // No external wallet connected - use playground wallet via backend
          console.log('🎮 No external wallet connected, using playground wallet via backend');
          await executeWithPlaygroundWallet();
          return;
        }
        
        const moduleName = method.module;
        if (!moduleName) {
          throw new Error('Module name is required for function execution');
        }
        
        const functionTarget = `${packageId}::${moduleName}::${method.name}`;
        console.log(`🚀 EXECUTING ENTRY FUNCTION: ${functionTarget}`);
        
        // Create move call for actual execution with proper SDK arguments
        tx.moveCall({
          target: functionTarget,
          arguments: transactionArgs,
        });

        // Execute with wallet - this actually modifies blockchain state!
        signAndExecute({
          transaction: tx,
          options: {
            showEffects: true,
            showObjectChanges: true,
            showEvents: true,
          }
        }, {
          onSuccess: (result) => {
            console.log('✅ ENTRY FUNCTION EXECUTED SUCCESSFULLY!');
            console.log('📊 Transaction result:', result);
            
            const successResult: ExecutionResult = {
              status: 'success',
              outputs: ['Transaction executed successfully! State has been modified on-chain.'],
              txHash: result.digest,
              gasUsed: result.effects?.gasUsed?.computationCost || '0',
              explorerUrl: `https://explorer.iota.org/txblock/${result.digest}?network=testnet`,
            };

            setResult(successResult);
            onExecute(successResult);

            toast({
              title: "🎉 Transaction Successful!",
              description: `Entry function executed! View on explorer: ${result.digest.slice(0, 8)}...`,
            });
          },
          onError: (error) => {
            console.error('❌ Entry function execution failed:', error);
            throw error;
          }
        });
        
        // Don't continue - wallet execution is async
        return;
      } else {
        // View functions - use devInspectTransactionBlock to get actual return values
        const moduleName = method.module;
        if (!moduleName) {
          throw new Error('Module name is required for function execution');
        }
        
        const functionTarget = `${packageId}::${moduleName}::${method.name}`;
        console.log(`Executing view function: ${functionTarget}`);
        
        // Create move call for inspection with proper SDK arguments
        tx.moveCall({
          target: functionTarget,
          arguments: transactionArgs,
        });

        // Use devInspectTransactionBlock to get return values
        // Use a proper dummy address for dev inspect
        const dummySender = '0x0000000000000000000000000000000000000000000000000000000000000000';
        const devInspectResult = await client.devInspectTransactionBlock({
          transactionBlock: await tx.build({ client }),
          sender: dummySender,
        });

        console.log('📊 Dev inspect result:', devInspectResult);

        if (devInspectResult.effects?.status?.status === 'success') {
          // Extract return values from the result
          let returnValues = [];
          
          if (devInspectResult.results && devInspectResult.results.length > 0) {
            returnValues = devInspectResult.results.map(result => {
              if (result.returnValues && result.returnValues.length > 0) {
                return result.returnValues.map((value: any) => {
                  // Parse the return value based on type
                  if (value && value[0] && value[1]) {
                    const [data, type] = value;
                    // For simple types like u64, try to decode
                    if (type === 'u64' || type === 'u32' || type === 'u8') {
                      try {
                        // Convert byte array to number for small integers
                        const bytes = new Uint8Array(data);
                        let num = 0;
                        for (let i = 0; i < Math.min(bytes.length, 8); i++) {
                          num += bytes[i] * Math.pow(256, i);
                        }
                        return num.toString();
                      } catch (e) {
                        return `Raw: [${data.join(', ')}]`;
                      }
                    }
                    return `${type}: [${data.join(', ')}]`;
                  }
                  return JSON.stringify(value);
                });
              }
              return ['No return value'];
            }).flat();
          }

          if (returnValues.length === 0) {
            returnValues = ['Function executed successfully (no return value)'];
          }

          const successResult: ExecutionResult = {
            status: 'success',
            outputs: returnValues,
            explorerUrl: `https://explorer.iota.org/object/${packageId}?network=testnet`,
          };

          setResult(successResult);
          onExecute(successResult);

          toast({
            title: "View Function Success",
            description: "Function executed and returned value(s)",
          });
        } else {
          // Handle execution error
          const errorMessage = devInspectResult.effects?.status?.error || 'Function execution failed';
          throw new Error(errorMessage);
        }
      }
    } catch (error) {
      console.error('Execution error:', error);
      const errorResult: ExecutionResult = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Function call failed',
      };
      setResult(errorResult);

      toast({
        title: "Error",
        description: "Failed to execute function",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const parameters = method.parameters || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {(() => {
              const isEntryFunction = method.is_entry === true;
              
              return (
                <>
                  <span>{isEntryFunction ? 'Execute' : 'Call'} {method.name}</span>
                  <Badge variant="outline" className={cn(
                    "text-xs",
                    isEntryFunction && "bg-orange-500/10 text-orange-500",
                    !isEntryFunction && "bg-green-500/10 text-green-500"
                  )}>
                    {isEntryFunction ? 'entry' : 'view'}
                  </Badge>
                  {isEntryFunction && (
                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500">
                      🔥 Modifies State
                    </Badge>
                  )}
                </>
              );
            })()}
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <div className="flex items-center gap-2">
              <span>Package:</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <code className="font-mono text-xs cursor-help">
                      {truncateAddress(packageId)}
                    </code>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-mono text-xs">{packageId}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <a
                href={`https://explorer.iota.org/object/${packageId}?network=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="text-xs">View on Explorer</span>
              </a>
            </div>
            <div className="text-xs text-muted-foreground">
              {(() => {
                const isEntryFunction = method.is_entry === true;
                
                if (isEntryFunction) {
                  return "🔥 Will execute on-chain, modify state, and cost gas";
                } else {
                  return "👁️ View function: Read-only, no state changes, no gas cost";
                }
              })()}
            </div>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-4">
            {/* Method Signature */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Method Signature
              </h4>
              <pre className="p-3 bg-muted rounded-lg font-mono text-xs overflow-auto">
                <ModuleFunctionSignature method={method} />
              </pre>
            </div>

            {/* Input Parameters */}
            {parameters.filter(param => {
              const normalizedType = param.type.toLowerCase();
              return !normalizedType.includes('txcontext') && 
                     !normalizedType.includes('tx_context') &&
                     !normalizedType.includes('&txcontext') &&
                     !normalizedType.includes('&mut txcontext');
            }).length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Input Parameters
                  </h4>
                  
                  {/* Helper utilities buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setShowParameterTemplates(true)}
                      title="Use parameter templates"
                    >
                      <Template className="h-3 w-3 mr-1" />
                      Templates
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setCurrentParameterForObject(null);
                        setShowObjectBrowser(true);
                      }}
                      title="Browse packages"
                    >
                      <Package className="h-3 w-3 mr-1" />
                      Packages
                    </Button>
                  </div>
                </div>
                {parameters.filter(param => {
                  const normalizedType = param.type.toLowerCase();
                  return !normalizedType.includes('txcontext') && 
                         !normalizedType.includes('tx_context') &&
                         !normalizedType.includes('&txcontext') &&
                         !normalizedType.includes('&mut txcontext');
                }).map((param, index) => (
                  <div key={index} className="space-y-3 p-4 border rounded-lg bg-muted/20">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <span className="text-foreground">{param.name}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs font-mono cursor-help">
                                {shortenTypeString(param.type)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-mono text-xs max-w-xs break-all">{param.type}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </label>
                      <div className="flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1 max-w-xs">
                                <div className="font-semibold">{param.name}</div>
                                <div className="text-xs">Type: {param.type}</div>
                                <div className="text-xs text-muted-foreground">
                                  Enhanced input with validation and smart suggestions
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    
                    <ParameterInput
                      parameter={param}
                      value={inputs[param.name] || ''}
                      onChange={(value) => handleInputChange(param.name, value)}
                      network="testnet"
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Execution Result */}
            {result && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Execution Result
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      result.status === 'success' && "bg-green-500/10 text-green-500",
                      result.status === 'error' && "bg-red-500/10 text-red-500",
                      result.status === 'pending' && "bg-yellow-500/10 text-yellow-500"
                    )}>
                      {result.status}
                    </Badge>
                    {result.status === 'pending' && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {result.status === 'success' && (
                    <>
                      {result.outputs && result.outputs.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Return Values</span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 gap-1.5"
                              onClick={() => handleCopy(result.outputs)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              <span className="text-xs">Copy</span>
                            </Button>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto rounded-lg">
                            <pre className="p-3 bg-muted rounded-lg font-mono text-xs whitespace-pre-wrap break-all">
                              {JSON.stringify(
                                Array.isArray(result.outputs) && result.outputs.length === 1 
                                  ? result.outputs[0] 
                                  : result.outputs, 
                                null, 
                                2
                              )}
                            </pre>
                          </div>
                        </div>
                      )}

                      {result.txHash && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Transaction Hash:</span>
                          <a
                            href={`https://explorer.iota.org/txblock/${result.txHash}?network=testnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono hover:underline flex items-center gap-1"
                          >
                            {result.txHash.slice(0, 10)}...{result.txHash.slice(-8)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}

                      {result.gasUsed && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Gas Used:</span>
                          <span className="font-mono">{result.gasUsed}</span>
                        </div>
                      )}
                    </>
                  )}

                  {result.status === 'error' && (
                    <div className="max-h-[200px] overflow-y-auto rounded-lg">
                      <div className="p-3 bg-red-500/10 text-red-500 rounded-lg text-sm whitespace-pre-wrap break-all">
                        {result.error}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button 
            disabled={isExecuting} 
            onClick={handleExecute}
            className="gap-2"
          >
            {(() => {
              const isEntryFunction = method.is_entry === true;
              
              if (isExecuting) {
                return (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isEntryFunction ? 'Executing...' : 'Calling...'}
                  </>
                );
              } else {
                return (
                  <>
                    <PlayCircle className="h-4 w-4" />
                    {isEntryFunction ? '🚀 Execute (Costs Gas)' : '👁️ View (Free)'}
                  </>
                );
              }
            })()}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Helper utility dialogs */}
      <ObjectBrowser
        open={showObjectBrowser}
        onOpenChange={setShowObjectBrowser}
        onSelectObject={handleObjectSelect}
        network="testnet"
      />

      <ParameterTemplates
        open={showParameterTemplates}
        onOpenChange={setShowParameterTemplates}
        parameters={parameters.filter(param => {
          const normalizedType = param.type.toLowerCase();
          return !normalizedType.includes('txcontext') && 
                 !normalizedType.includes('tx_context') &&
                 !normalizedType.includes('&txcontext') &&
                 !normalizedType.includes('&mut txcontext');
        })}
        onApplyTemplate={handleTemplateApply}
      />
    </Dialog>
  );
}