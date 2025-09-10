import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, Copy, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { ModuleFunction } from '@/lib/types';
import { IotaClient } from '@iota/iota-sdk/client';
import { Transaction } from '@iota/iota-sdk/transactions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useWallet } from '@/contexts/WalletContext';
import { ParameterValidator } from './ParameterValidator';

interface ViewFunctionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  method: ModuleFunction | null;
  packageId: string;
  network: string;
}

interface ParameterValidation {
  isValid: boolean;
  error?: string;
}

export function ViewFunctionDialog({
  isOpen,
  onClose,
  method,
  packageId,
  network,
}: ViewFunctionDialogProps) {
  const { toast } = useToast();
  const { currentWallet, playgroundAddress, currentAccount } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [paramValidations, setParamValidations] = useState<Record<string, ParameterValidation>>({});
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!method) return null;

  const handleParameterChange = (paramName: string, value: string) => {
    setParamValues(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const handleValidationChange = (paramName: string, isValid: boolean, error?: string) => {
    setParamValidations(prev => ({
      ...prev,
      [paramName]: { isValid, error }
    }));
  };

  // Check if all parameters are valid
  const allParametersValid = () => {
    const requiredParams = method?.parameters?.filter(p => !p.type?.toLowerCase().includes('txcontext')) || [];
    
    for (const param of requiredParams) {
      const paramName = param.name || `param${requiredParams.indexOf(param)}`;
      const validation = paramValidations[paramName];
      const value = paramValues[paramName];
      
      if (!value || !validation?.isValid) {
        return false;
      }
    }
    
    return true;
  };

  const formatType = (type: string) => {
    return type
      .replace(/0x[a-fA-F0-9]+::/g, '')
      .replace(/std::/g, '')
      .replace(/iota::/g, '')
      .replace(/string::String/g, 'String')
      .replace(/vector<u8>/g, 'Bytes');
  };

  const createTransactionArgument = async (value: string, type: string, tx: Transaction, client: IotaClient, network: string): Promise<any> => {
    if (!value.trim()) {
      throw new Error(`Parameter value is required for type ${type}`);
    }
    
    try {
      const normalizedType = type.toLowerCase().trim();
      
      // Handle reference types (& or &mut) and object types
      // For public view functions, we need to query the object and use proper Inputs
      if (normalizedType.startsWith('&') || normalizedType.includes('::')) {
        const cleanValue = value.trim().startsWith('0x') ? value.trim() : `0x${value.trim()}`;
        // Ensure the object ID is properly formatted (64 hex chars after 0x)
        const hexPart = cleanValue.slice(2);
        const paddedHex = hexPart.padStart(64, '0');
        const objectId = '0x' + paddedHex;
        
        // For view functions with immutable references, we can use simple object reference
        // The SDK will handle the reference internally
        return tx.object(objectId);
      }
      
      // Handle primitive types
      if (normalizedType === 'address') {
        const cleanValue = value.trim().startsWith('0x') ? value.trim() : `0x${value.trim()}`;
        return tx.pure.address(cleanValue);
      }
      
      // Handle number types with proper methods
      if (normalizedType === 'u8') {
        return tx.pure.u8(parseInt(value));
      }
      if (normalizedType === 'u16') {
        return tx.pure.u16(parseInt(value));
      }
      if (normalizedType === 'u32') {
        return tx.pure.u32(parseInt(value));
      }
      if (normalizedType === 'u64') {
        return tx.pure.u64(value); // u64 can be string or bigint
      }
      if (normalizedType === 'u128') {
        return tx.pure.u128(value); // u128 should be string for large numbers
      }
      if (normalizedType === 'u256') {
        return tx.pure.u256(value); // u256 should be string for large numbers
      }
      
      if (normalizedType === 'bool') {
        const boolValue = value.toLowerCase() === 'true';
        return tx.pure.bool(boolValue);
      }
      
      if (normalizedType.startsWith('vector<')) {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          throw new Error('Vector value must be a JSON array');
        }
        const elementType = normalizedType.match(/vector<(.+)>/)?.[1]?.trim() || 'u8';
        
        // Convert array elements based on type
        if (elementType === 'u8') {
          const values = parsed.map(v => parseInt(v));
          return tx.pure.vector('u8', values);
        } else if (elementType === 'u16') {
          const values = parsed.map(v => parseInt(v));
          return tx.pure.vector('u16', values);
        } else if (elementType === 'u32') {
          const values = parsed.map(v => parseInt(v));
          return tx.pure.vector('u32', values);
        } else if (elementType === 'u64') {
          const values = parsed.map(v => String(v));
          return tx.pure.vector('u64', values);
        } else if (elementType === 'bool') {
          const values = parsed.map(v => Boolean(v));
          return tx.pure.vector('bool', values);
        } else if (elementType === 'address') {
          const values = parsed.map(v => String(v));
          return tx.pure.vector('address', values);
        } else {
          // Default to string
          const values = parsed.map(v => String(v));
          return tx.pure.vector('string', values);
        }
      }
      
      // Default to string
      return tx.pure.string(value);
      
    } catch (err) {
      throw new Error(`Invalid value for type ${type}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Check if this is a simple getter function (returns primitive, takes only object reference)
  const isSimpleGetter = (method: ModuleFunction): boolean => {
    const params = method.parameters?.filter(p => !p.type?.toLowerCase().includes('txcontext')) || [];
    const hasOnlyObjectParam = params.length === 1 && 
      (params[0].type?.startsWith('&') || params[0].type?.includes('::'));
    const returnsPrimitive = method.returnType && 
      ['u8', 'u16', 'u32', 'u64', 'u128', 'u256', 'bool', 'address', 'string'].some(
        type => method.returnType?.toLowerCase().includes(type)
      );
    return hasOnlyObjectParam && returnsPrimitive;
  };

  // Check if this is an ownership check function
  const isOwnershipCheck = (method: ModuleFunction): boolean => {
    return method.name === 'is_owner' || method.name === 'check_owner';
  };

  // Try to get value directly from object for simple getters
  const tryDirectValueExtraction = async (objectId: string, methodName: string, client: IotaClient): Promise<any> => {
    try {
      const objectResponse = await client.getObject({
        id: objectId,
        options: {
          showContent: true,
          showType: true,
        }
      });
      
      if (!objectResponse.data?.content) {
        return null;
      }
      
      const content = objectResponse.data.content;
      if (content.dataType === 'moveObject' && content.fields) {
        // Try to find a field that matches the getter name (e.g., get_value -> value)
        const fieldName = methodName.replace(/^get_/, '');
        if (fieldName in content.fields) {
          return content.fields[fieldName];
        }
        // Also try exact method name
        if (methodName in content.fields) {
          return content.fields[methodName];
        }
      }
      
      return null;
    } catch (error) {
      console.log('Failed to extract value directly:', error);
      return null;
    }
  };

  // Check ownership directly for is_owner functions
  const tryDirectOwnershipCheck = async (objectId: string, addressToCheck: string, client: IotaClient): Promise<boolean | null> => {
    try {
      const objectResponse = await client.getObject({
        id: objectId,
        options: {
          showOwner: true,
          showContent: true,
        }
      });
      
      if (!objectResponse.data) {
        return null;
      }
      
      // First check the Move object fields for an owner field
      if (objectResponse.data.content?.dataType === 'moveObject' && objectResponse.data.content.fields) {
        const ownerField = objectResponse.data.content.fields.owner;
        if (ownerField) {
          // Normalize addresses for comparison
          const normalizedOwner = ownerField.toLowerCase();
          const normalizedCheck = addressToCheck.toLowerCase();
          return normalizedOwner === normalizedCheck;
        }
      }
      
      // Fallback to object-level owner
      const owner = objectResponse.data.owner;
      if (typeof owner === 'object' && 'AddressOwner' in owner) {
        const normalizedOwner = owner.AddressOwner.toLowerCase();
        const normalizedCheck = addressToCheck.toLowerCase();
        return normalizedOwner === normalizedCheck;
      }
      
      return null;
    } catch (error) {
      console.log('Direct ownership check failed:', error);
      return null;
    }
  };

  const handleViewFunction = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const client = new IotaClient({
        url: network === 'mainnet' 
          ? 'https://api.mainnet.iota.cafe'
          : 'https://api.testnet.iota.cafe'
      });
      
      // Special handling for ownership check functions
      if (isOwnershipCheck(method)) {
        const params = method.parameters?.filter(p => !p.type?.toLowerCase().includes('txcontext')) || [];
        if (params.length === 2) {
          const objectParam = params.find(p => p.type?.toLowerCase().includes('::'));
          const addressParam = params.find(p => p.type?.toLowerCase() === 'address');
          
          if (objectParam && addressParam) {
            const objectId = paramValues[objectParam.name || 'param0'];
            const addressToCheck = paramValues[addressParam.name || 'param1'];
            
            if (objectId && addressToCheck) {
              // Clean and format the object ID
              const cleanId = objectId.trim().startsWith('0x') ? objectId.trim() : `0x${objectId.trim()}`;
              const hexPart = cleanId.slice(2);
              const paddedId = '0x' + hexPart.padStart(64, '0');
              
              // Clean and format the address
              const cleanAddress = addressToCheck.trim().startsWith('0x') ? addressToCheck.trim() : `0x${addressToCheck.trim()}`;
              const addrHexPart = cleanAddress.slice(2);
              const paddedAddress = '0x' + addrHexPart.padStart(64, '0');
              
              const isOwner = await tryDirectOwnershipCheck(paddedId, paddedAddress, client);
              if (isOwner !== null) {
                setResult({
                  success: true,
                  returnValues: [{ type: 'bool', value: isOwner }],
                  raw: { directOwnershipCheck: true, value: isOwner }
                });
                
                toast({
                  title: "✅ View Function Success",
                  description: `Ownership check: ${isOwner}`,
                });
                setIsLoading(false);
                return;
              }
            }
          }
        }
      }

      // For simple getters, try direct value extraction first
      if (isSimpleGetter(method)) {
        const params = method.parameters?.filter(p => !p.type?.toLowerCase().includes('txcontext')) || [];
        if (params.length === 1) {
          const paramName = params[0].name || 'param0';
          const objectId = paramValues[paramName];
          
          if (objectId) {
            // Clean and format the object ID
            const cleanId = objectId.trim().startsWith('0x') ? objectId.trim() : `0x${objectId.trim()}`;
            const hexPart = cleanId.slice(2);
            const paddedId = '0x' + hexPart.padStart(64, '0');
            
            const directValue = await tryDirectValueExtraction(paddedId, method.name, client);
            if (directValue !== null) {
              setResult({
                success: true,
                returnValues: [{ type: method.returnType, value: directValue }],
                raw: { directExtraction: true, value: directValue }
              });
              
              toast({
                title: "✅ View Function Success",
                description: `Retrieved value: ${directValue}`,
              });
              setIsLoading(false);
              return;
            }
          }
        }
      }
      
      // Fallback to devInspectTransactionBlock for complex functions or if direct extraction failed
      const tx = new Transaction();
      
      // Build function arguments with improved type handling
      const transactionArgs: any[] = [];
      if (method.parameters && method.parameters.length > 0) {
        for (const param of method.parameters) {
          const paramName = param.name || `param${method.parameters.indexOf(param)}`;
          const value = paramValues[paramName];
          if (!value && !param.type?.toLowerCase().includes('txcontext')) {
            throw new Error(`Value required for parameter: ${paramName}`);
          }
          if (value) {
            const normalizedType = param.type.toLowerCase().trim();
            let arg;
            
            // Check if it's an object reference (starts with & or contains ::)
            if (normalizedType.startsWith('&') && normalizedType.includes('::')) {
              // For object references, just pass the object ID
              const cleanValue = value.trim().startsWith('0x') ? value.trim() : `0x${value.trim()}`;
              const hexPart = cleanValue.slice(2);
              const paddedHex = hexPart.padStart(64, '0');
              const objectId = '0x' + paddedHex;
              arg = tx.object(objectId);
            } else if (normalizedType === 'address') {
              // For address type, use pure.address
              const cleanAddress = value.trim().startsWith('0x') ? value.trim() : `0x${value.trim()}`;
              const hexPart = cleanAddress.slice(2);
              const paddedAddress = '0x' + hexPart.padStart(64, '0');
              arg = tx.pure.address(paddedAddress);
            } else {
              // Use the regular argument creation for other types
              arg = await createTransactionArgument(value, param.type, tx, client, network);
            }
            transactionArgs.push(arg);
          }
        }
      }
      
      // Create the move call
      const functionTarget = `${packageId}::${method.module}::${method.name}`;
      tx.moveCall({
        target: functionTarget,
        arguments: transactionArgs,
      });
      
      // For view functions, determine the best sender address
      let senderAddress = currentAccount?.address || playgroundAddress;
      
      // Try to use object owner as sender for better compatibility
      const params = method.parameters?.filter(p => !p.type?.toLowerCase().includes('txcontext')) || [];
      const objectParam = params.find(p => p.type?.toLowerCase().startsWith('&') && p.type?.includes('::'));
      
      if (objectParam) {
        const paramName = objectParam.name || `param${params.indexOf(objectParam)}`;
        const objectId = paramValues[paramName];
        
        if (objectId) {
          try {
            const cleanId = objectId.trim().startsWith('0x') ? objectId.trim() : `0x${objectId.trim()}`;
            const hexPart = cleanId.slice(2);
            const paddedId = '0x' + hexPart.padStart(64, '0');
            
            const objResponse = await client.getObject({
              id: paddedId,
              options: { showOwner: true }
            });
            
            if (objResponse.data?.owner) {
              const owner = objResponse.data.owner;
              if (typeof owner === 'object' && 'AddressOwner' in owner) {
                // Use object owner as sender for better compatibility
                senderAddress = owner.AddressOwner;
                console.log('Using object owner as sender for view function:', senderAddress);
              } else if (owner === 'Immutable' || (typeof owner === 'object' && 'Shared' in owner)) {
                // For immutable or shared objects, use any valid address
                if (!senderAddress) {
                  // Use a system address as fallback
                  senderAddress = '0x0000000000000000000000000000000000000000000000000000000000000006';
                }
              }
            }
          } catch (error) {
            console.log('Failed to get object owner:', error);
          }
        }
      }
      
      // Final fallback to a system address if still no sender
      if (!senderAddress) {
        senderAddress = '0x0000000000000000000000000000000000000000000000000000000000000006';
        console.log('Using system address as fallback sender');
      }
      
      // IMPORTANT: Set the sender on the transaction before building
      // This is required for public (non-entry) functions
      tx.setSender(senderAddress);
      
      let devInspectResult;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          devInspectResult = await client.devInspectTransactionBlock({
            transactionBlock: await tx.build({ client }),
            sender: senderAddress,
          });
          break; // Success, exit the retry loop
        } catch (err: any) {
          console.error(`Attempt ${retryCount + 1} failed:`, err);
          
          // Check for specific deserialization error
          if (err.message?.includes('Deserialization error') || err.message?.includes('invalid value')) {
            if (retryCount < maxRetries) {
              console.log('Retrying with refreshed object references...');
              retryCount++;
              // Small delay before retry
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            }
          }
          
          // If it's not a deserialization error or we've exhausted retries, throw
          throw err;
        }
      }
      
      if (!devInspectResult) {
        throw new Error('Failed to execute view function after retries');
      }
      
      if (devInspectResult.effects?.status?.status === 'success') {
        // Extract return values
        let returnValues = null;
        
        if (devInspectResult.results && devInspectResult.results.length > 0) {
          const result = devInspectResult.results[0];
          if (result.returnValues && result.returnValues.length > 0) {
            returnValues = result.returnValues.map((value: any) => {
              if (value && value[0] && value[1]) {
                const [data, type] = value;
                
                // Decode based on type
                if (type === 'u64' || type === 'u32' || type === 'u8' || type === 'u16') {
                  try {
                    const bytes = new Uint8Array(data);
                    let num = 0;
                    for (let i = 0; i < bytes.length; i++) {
                      num = num * 256 + bytes[bytes.length - 1 - i];
                    }
                    return { type, value: num };
                  } catch (e) {
                    return { type, value: data };
                  }
                } else if (type === 'bool') {
                  return { type, value: data[0] === 1 };
                } else if (type.includes('String') || type === 'string') {
                  try {
                    const decoder = new TextDecoder();
                    return { type, value: decoder.decode(new Uint8Array(data)) };
                  } catch {
                    return { type, value: data };
                  }
                } else {
                  return { type, value: data };
                }
              }
              return value;
            });
          }
        }
        
        setResult({
          success: true,
          returnValues,
          raw: devInspectResult
        });
        
        toast({
          title: "✅ View Function Success",
          description: "Successfully retrieved function return value",
        });
      } else {
        const errorMessage = devInspectResult.effects?.status?.error || 'Function execution failed';
        throw new Error(errorMessage);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to execute view function';
      setError(errorMsg);
      toast({
        title: "❌ View Function Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result.returnValues || result, null, 2));
      toast({ description: "Result copied to clipboard" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base">{method.name}</span>
              {method.returnType && (
                <>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary" className="text-sm font-mono">
                    {formatType(method.returnType)}
                  </Badge>
                </>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">

          {/* Parameters */}
          {method.parameters && method.parameters.filter(p => !p.type?.toLowerCase().includes('txcontext')).length > 0 && (
            <div className="space-y-4">
              <div className="text-sm font-medium text-muted-foreground">Function Parameters</div>
              <div className="space-y-4">
                {method.parameters
                  .filter(p => !p.type?.toLowerCase().includes('txcontext'))
                  .map((param, index) => {
                    const paramName = param.name || `param${index}`;
                    return (
                      <ParameterValidator
                        key={index}
                        name={paramName}
                        type={param.type}
                        value={paramValues[paramName] || ''}
                        onChange={(value) => handleParameterChange(paramName, value)}
                        onValidationChange={(isValid, error) => handleValidationChange(paramName, isValid, error)}
                        index={index}
                        packageId={packageId}
                      />
                    );
                  })}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Result Display */}
          {result && result.success && (
            <div className="p-4 rounded-lg border bg-gradient-to-r from-green-50/50 to-blue-50/50 dark:from-green-950/20 dark:to-blue-950/20 border-green-200/50 dark:border-green-800/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Result{result.returnValues?.length > 1 ? 's' : ''}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyResult}
                  className="h-7 px-2"
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy
                </Button>
              </div>
              
              {result.returnValues && result.returnValues.length > 0 ? (
                <div className="space-y-3">
                  {result.returnValues.map((val: any, idx: number) => (
                    <div key={idx} className="bg-white/70 dark:bg-black/20 rounded-lg p-3 border border-green-200/30 dark:border-green-800/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs h-5">
                          {val.type || 'unknown'}
                        </Badge>
                      </div>
                      <div className="bg-muted/30 rounded p-2">
                        <code className="text-sm font-mono text-primary break-all">
                          {typeof val.value === 'object' 
                            ? JSON.stringify(val.value, null, 2)
                            : String(val.value)}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Function executed successfully but returned no values
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleViewFunction}
              disabled={isLoading || !allParametersValid()}
              className="min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calling...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  View Output
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}