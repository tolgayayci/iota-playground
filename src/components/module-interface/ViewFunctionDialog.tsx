import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, Copy, AlertCircle, CheckCircle } from 'lucide-react';
import { ModuleFunction } from '@/lib/types';
import { IotaClient } from '@iota/iota-sdk/client';
import { Transaction, Inputs } from '@iota/iota-sdk/transactions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useWallet } from '@/contexts/WalletContext';
import { ObjectIdInput } from './inputs/ObjectIdInput';

interface ViewFunctionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  method: ModuleFunction | null;
  packageId: string;
  network: string;
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
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!method) return null;

  const handleParameterChange = (paramName: string, value: string) => {
    setParamValues(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const formatType = (type: string) => {
    return type
      .replace(/0x[a-fA-F0-9]+::/g, '')
      .replace(/std::/g, '')
      .replace(/iota::/g, '')
      .replace(/string::String/g, 'String')
      .replace(/vector<u8>/g, 'Bytes');
  };

  const createTransactionArgument = (value: string, type: string, tx: Transaction): any => {
    if (!value.trim()) {
      throw new Error(`Parameter value is required for type ${type}`);
    }
    
    try {
      const normalizedType = type.toLowerCase().trim();
      
      // Handle reference types (& or &mut)
      // For references, we use tx.object() which handles both immutable and mutable references
      if (normalizedType.startsWith('&')) {
        const cleanValue = value.trim().startsWith('0x') ? value.trim() : `0x${value.trim()}`;
        // Ensure the object ID is properly formatted (64 hex chars after 0x)
        const hexPart = cleanValue.slice(2);
        const paddedHex = hexPart.padStart(64, '0');
        const objectId = '0x' + paddedHex;
        return tx.object(objectId);
      }

      // Handle object types (non-reference)
      if (normalizedType.includes('::')) {
        const cleanValue = value.trim().startsWith('0x') ? value.trim() : `0x${value.trim()}`;
        const hexPart = cleanValue.slice(2);
        const paddedHex = hexPart.padStart(64, '0');
        const objectId = '0x' + paddedHex;
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
      
      const tx = new Transaction();
      
      // Build function arguments
      const transactionArgs: any[] = [];
      if (method.parameters && method.parameters.length > 0) {
        for (const param of method.parameters) {
          const paramName = param.name || `param${method.parameters.indexOf(param)}`;
          const value = paramValues[paramName];
          if (!value && !param.type?.toLowerCase().includes('txcontext')) {
            throw new Error(`Value required for parameter: ${paramName}`);
          }
          if (value) {
            const arg = createTransactionArgument(value, param.type, tx);
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
      
      // Use devInspectTransactionBlock to get return values
      // For view functions, we can use any valid address as sender
      // Try to use connected wallet first, then playground, then fallback
      let senderAddress = currentAccount?.address || playgroundAddress;
      
      // If no address available, use a default address for view functions
      // View functions are read-only so the sender doesn't affect the result
      if (!senderAddress) {
        // Use a default valid IOTA address for view functions
        // This is safe because view functions don't modify state
        senderAddress = '0x0000000000000000000000000000000000000000000000000000000000000000';
      }
      
      // IMPORTANT: Set the sender on the transaction before building
      // This is required for public (non-entry) functions
      tx.setSender(senderAddress);
      
      const devInspectResult = await client.devInspectTransactionBlock({
        transactionBlock: await tx.build({ client }),
        sender: senderAddress,
      });
      
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
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-500" />
            View Function Output
          </DialogTitle>
          <DialogDescription>
            Call this public function to view its return value without gas costs
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Function Info */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Function:</span>
              <code className="text-xs font-mono text-primary">
                {method.module}::{method.name}
              </code>
            </div>
            {method.returnType && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Returns:</span>
                <Badge variant="outline" className="text-xs">
                  {formatType(method.returnType)}
                </Badge>
              </div>
            )}
          </div>

          {/* Parameters */}
          {method.parameters && method.parameters.filter(p => !p.type?.toLowerCase().includes('txcontext')).length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Parameters</Label>
              {method.parameters
                .filter(p => !p.type?.toLowerCase().includes('txcontext'))
                .map((param, index) => {
                  const paramName = param.name || `param${index}`;
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={paramName} className="text-xs">
                          {paramName}
                        </Label>
                        <Badge variant="outline" className="text-xs">
                          {formatType(param.type)}
                        </Badge>
                      </div>
                      {/* Use ObjectIdInput for object/reference types */}
                      {(param.type?.includes('&') || param.type?.includes('::') || param.type?.toLowerCase().includes('object')) ? (
                        <ObjectIdInput
                          value={paramValues[paramName] || ''}
                          onChange={(value) => handleParameterChange(paramName, value)}
                          expectedType={formatType(param.type)}
                          network={network}
                          placeholder={`Enter ${formatType(param.type)} ID`}
                        />
                      ) : (
                        <Input
                          id={paramName}
                          placeholder={`Enter ${formatType(param.type)} value`}
                          value={paramValues[paramName] || ''}
                          onChange={(e) => handleParameterChange(paramName, e.target.value)}
                          className="font-mono text-sm"
                        />
                      )}
                    </div>
                  );
                })}
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Result</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyResult}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy
                </Button>
              </div>
              
              {result.returnValues && result.returnValues.length > 0 ? (
                <div className="border rounded-lg bg-green-500/5 border-green-500/20 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">
                        Return Value{result.returnValues.length > 1 ? 's' : ''}
                      </p>
                      {result.returnValues.map((val: any, idx: number) => (
                        <div key={idx} className="bg-background/50 rounded p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">Type:</span>
                            <Badge variant="outline" className="text-xs">
                              {val.type || 'unknown'}
                            </Badge>
                          </div>
                          <code className="text-sm font-mono text-primary">
                            {typeof val.value === 'object' 
                              ? JSON.stringify(val.value, null, 2)
                              : String(val.value)}
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertDescription>Function executed successfully but returned no values</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleViewFunction}
              disabled={isLoading}
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