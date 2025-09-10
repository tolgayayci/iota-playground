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
  FunctionSquare,
  Send,
  Split,
  Merge,
  ArrowRight,
  Hash,
  Box,
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';
import { Transaction } from '@iota/iota-sdk/transactions';
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
import { useSignAndExecuteTransaction } from '@iota/dapp-kit';
import { PTBCommand } from '@/components/views/PTBBuilderV3';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

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
  // For view functions (non-entry), we can return decoded values
  returnValues?: Array<string | number | any>;
  // Track the sender used for the transaction
  senderAddress?: string;
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

  // Helper function to normalize object IDs to proper format
  const normalizeObjectId = (id: string): string => {
    if (!id) return '';
    
    // Remove any whitespace
    let cleanId = id.trim();
    
    // Add 0x prefix if missing
    if (!cleanId.startsWith('0x')) {
      cleanId = '0x' + cleanId;
    }
    
    // Extract hex part and pad to 64 characters if needed
    const hexPart = cleanId.slice(2);
    
    // Only pad if the hex part is shorter than 64 chars
    // Don't pad if it's already the right length
    if (hexPart.length < 64) {
      const paddedHex = hexPart.padStart(64, '0');
      return '0x' + paddedHex.toLowerCase();
    }
    
    return '0x' + hexPart.toLowerCase();
  };

  const buildTransaction = async (client: IotaClient) => {
    const tx = new Transaction();
    
    const commandResults: any[] = [];
    
    console.log('🔨 Building PTB transaction with commands:', commands);
    
    // Pre-validate all object references before building
    for (const command of commands) {
      if (command.type === 'MoveCall' && command.arguments) {
        for (const arg of command.arguments) {
          if (arg.type === 'object' || (arg.type === 'input' && arg.paramType?.startsWith('&'))) {
            const objectId = normalizeObjectId(arg.value);
            console.log(`🔍 Pre-validating object: ${objectId}`);
            
            try {
              const objResponse = await client.getObject({
                id: objectId,
                options: { showOwner: true, showType: true }
              });
              
              if (!objResponse.data) {
                throw new Error(`Object not found on network: ${objectId}`);
              }
              // If paramType specifies a struct type, validate the object's base type matches
              if (arg.paramType && typeof objResponse.data.type === 'string') {
                try {
                  const expected = String(arg.paramType)
                    .replace(/^&mut\s*/i, '')
                    .replace(/^&\s*/i, '')
                    .trim();
                  const actual = String(objResponse.data.type).trim();
                  if (expected.includes('::') && actual.includes('::')) {
                    const base = (s: string) => s.split('<')[0].toLowerCase();
                    const expectedBase = base(expected);
                    const actualBase = base(actual);
                    if (expectedBase !== actualBase) {
                      // If module and struct name match but package differs, try switching target package automatically
                      const extractPkg = (t: string) => (t.split('::')[0] || '').toLowerCase();
                      const extractMod = (t: string) => (t.split('::')[1] || '').toLowerCase();
                      const extractName = (t: string) => (t.split('::')[2] || '').split('<')[0].toLowerCase();

                      const eMod = extractMod(expected);
                      const eName = extractName(expected);
                      const aPkg = extractPkg(actual);
                      const aMod = extractMod(actual);
                      const aName = extractName(actual);

                      if (eMod === aMod && eName === aName && typeof command.target === 'string') {
                        const [pkg, mod, func] = command.target.split('::');
                        try {
                          const normalized = await client.getNormalizedMoveModulesByPackage({ package: aPkg });
                          if (normalized && normalized[mod] && normalized[mod].exposedFunctions && normalized[mod].exposedFunctions[func]) {
                            const oldTarget = command.target;
                            command.target = `${aPkg}::${mod}::${func}`;
                            console.log(`🔁 Auto-switched target due to package mismatch: ${oldTarget} -> ${command.target}`);
                            // align paramType address with actual package
                            const refPrefixMatch = String(arg.paramType).match(/^(&mut\s*|&\s*)/);
                            const refPrefix = refPrefixMatch ? refPrefixMatch[0] : '';
                            const actualBaseFull = actual.split('<')[0];
                            arg.paramType = `${refPrefix}${actualBaseFull}`;
                          } else {
                            throw new Error(`Type mismatch for ${objectId}. Expected ${expectedBase} but got ${actualBase}`);
                          }
                        } catch (e) {
                          throw new Error(`Type mismatch for ${objectId}. Expected ${expectedBase} but got ${actualBase}`);
                        }
                      } else {
                        throw new Error(`Type mismatch for ${objectId}. Expected ${expectedBase} but got ${actualBase}`);
                      }
                    }
                  }
                } catch (typeErr) {
                  throw typeErr;
                }
              }
              
              console.log(`✅ Object validated: ${objectId}`, objResponse.data);
            } catch (error) {
              console.error(`❌ Object validation failed for ${objectId}:`, error);
              throw new Error(`Cannot access object ${objectId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        }
      }
    }
    
    // Validate addresses before building
    commands.forEach((command) => {
      if (command.type === 'TransferObjects' && command.recipient) {
        if (!command.recipient.value || command.recipient.value === '') {
          throw new Error('Recipient address is required for TransferObjects command');
        }
        // Basic IOTA address validation (starts with 0x and is 66 chars) - case insensitive
        if (!command.recipient.value.match(/^0x[a-fA-F0-9]{64}$/i)) {
          throw new Error(`Invalid IOTA address format: ${command.recipient.value}`);
        }
      }
    });
    
    commands.forEach((command, index) => {
      console.log(`📦 Processing command ${index}:`, command);
      
      switch (command.type) {
        case 'MoveCall':
          if (command.target && command.arguments) {
            const args = command.arguments.map((arg, argIndex) => {
              console.log(`  📍 Processing arg ${argIndex}:`, arg);
              
              if (arg.type === 'result' && arg.resultFrom !== undefined) {
                console.log(`    → Using result from command ${arg.resultFrom}`);
                return commandResults[arg.resultFrom];
              } else if (arg.type === 'gas') {
                console.log(`    → Using gas coin`);
                return tx.gas;
              } else if (arg.type === 'object') {
                // Normalize and validate object ID
                const objectId = normalizeObjectId(arg.value);
                console.log(`    → Object ID normalized: ${arg.value} -> ${objectId}`);
                
                // Use lowercase-only regex since we normalize to lowercase
                if (!objectId.match(/^0x[a-f0-9]{64}$/)) {
                  throw new Error(`Invalid object ID format: ${arg.value} (normalized: ${objectId})`);
                }
                return tx.object(objectId);
              } else if (arg.type === 'input') {
                // Check if the parameter type is a reference type (ONLY check for & prefix)
                if (arg.paramType?.startsWith('&')) {
                  // This is a reference to an object, treat it as an object
                  const objectId = normalizeObjectId(arg.value);
                  console.log(`    → Reference type ${arg.paramType}, normalized object ID: ${arg.value} -> ${objectId}`);
                  
                  // Use lowercase-only regex since we normalize to lowercase
                  if (!objectId.match(/^0x[a-f0-9]{64}$/)) {
                    throw new Error(`Invalid object ID format for reference type: ${arg.value} (normalized: ${objectId})`);
                  }
                  return tx.object(objectId);
                }
                
                // Handle primitive input types with proper type-specific methods
                const paramType = arg.paramType?.toLowerCase() || '';
                console.log(`    → Input type: ${paramType}, value: ${arg.value}`);
                
                if (paramType === 'u8') {
                  console.log(`    → Creating u8 pure value`);
                  return tx.pure.u8(parseInt(arg.value));
                } else if (paramType === 'u16') {
                  console.log(`    → Creating u16 pure value`);
                  return tx.pure.u16(parseInt(arg.value));
                } else if (paramType === 'u32') {
                  console.log(`    → Creating u32 pure value`);
                  return tx.pure.u32(parseInt(arg.value));
                } else if (paramType === 'u64') {
                  console.log(`    → Creating u64 pure value`);
                  return tx.pure.u64(arg.value);
                } else if (paramType === 'u128') {
                  console.log(`    → Creating u128 pure value`);
                  return tx.pure.u128(arg.value);
                } else if (paramType === 'u256') {
                  console.log(`    → Creating u256 pure value`);
                  return tx.pure.u256(arg.value);
                } else if (paramType === 'bool') {
                  console.log(`    → Creating bool pure value: ${arg.value === 'true'}`);
                  return tx.pure.bool(arg.value === 'true');
                } else if (paramType === 'address') {
                  const address = normalizeObjectId(arg.value);
                  console.log(`    → Creating address pure value: ${arg.value} -> ${address}`);
                  // Use lowercase-only regex since we normalize to lowercase
                  if (!address.match(/^0x[a-f0-9]{64}$/)) {
                    throw new Error(`Invalid address format: ${arg.value} (normalized: ${address})`);
                  }
                  return tx.pure.address(address);
                } else if (paramType.startsWith('vector<')) {
                  // Handle vector types
                  try {
                    const parsed = JSON.parse(arg.value);
                    const elementType = paramType.match(/vector<(.+)>/)?.[1]?.trim() || 'u8';
                    return tx.pure.vector(elementType, parsed);
                  } catch {
                    return tx.pure.string(arg.value);
                  }
                } else {
                  // Default to string for unknown types
                  return tx.pure.string(arg.value);
                }
              } else {
                // Fallback for any unhandled cases
                return tx.pure.string(arg.value || '');
              }
            });
            
            console.log(`  ✅ Built arguments for MoveCall:`, args);
            
            const result = tx.moveCall({
              target: command.target,
              arguments: args,
              typeArguments: command.typeArguments || [],
            });
            
            console.log(`  ✅ MoveCall added to transaction`);
            commandResults.push(result);
          }
          break;
          
        case 'TransferObjects':
          if (command.objects && command.recipient) {
            const objects = command.objects.map(obj => {
              if (obj.type === 'result' && obj.resultFrom !== undefined) {
                return commandResults[obj.resultFrom];
              } else {
                const objectId = normalizeObjectId(obj.value);
                // Use lowercase-only regex since we normalize to lowercase
                if (!objectId.match(/^0x[a-f0-9]{64}$/)) {
                  throw new Error(`Invalid object ID format in TransferObjects: ${obj.value} (normalized: ${objectId})`);
                }
                return tx.object(objectId);
              }
            });
            
            tx.transferObjects(objects, tx.pure.address(command.recipient.value));
          }
          break;
          
        case 'SplitCoins':
          if (command.coin && command.amounts) {
            const coin = command.coin.type === 'gas' ? tx.gas : 
                        command.coin.type === 'result' ? commandResults[command.coin.resultFrom] :
                        tx.object(normalizeObjectId(command.coin.value));
            
            const amounts = command.amounts.map(amt => tx.pure.u64(amt.value));
            const results = tx.splitCoins(coin, amounts);
            commandResults.push(results);
          }
          break;
          
        case 'MergeCoins':
          if (command.destination && command.sources) {
            const dest = command.destination.type === 'gas' ? tx.gas :
                        command.destination.type === 'result' ? commandResults[command.destination.resultFrom] :
                        tx.object(normalizeObjectId(command.destination.value));
            
            const sources = command.sources.map(src => {
              if (src.type === 'result' && src.resultFrom !== undefined) {
                return commandResults[src.resultFrom];
              } else {
                return tx.object(normalizeObjectId(src.value));
              }
            });
            
            tx.mergeCoins(dest, sources);
          }
          break;
      }
    });
    
    console.log('✅ PTB transaction built successfully');
    return tx;
  };

  const handleDryRun = async () => {
    try {
      setIsExecuting(true);
      setActiveTab('result');
      
      console.log('🚀 Starting PTB dry run...');
      console.log('Network:', network);
      console.log('Wallet Type:', walletType);
      
      const client = new IotaClient({ url: getFullnodeUrl(network) });
      
      // Build transaction with client for object validation
      const tx = await buildTransaction(client);
      
      // Determine the sender address based on wallet type
      let sender: string;
      
      if (walletType === 'playground') {
        // Use playground wallet address
        const playgroundPrivateKey = import.meta.env.VITE_PLAYGROUND_WALLET_PRIVATE_KEY;
        if (!playgroundPrivateKey) {
          throw new Error('Playground wallet private key not configured');
        }
        const keypair = Ed25519Keypair.fromSecretKey(playgroundPrivateKey);
        sender = keypair.toIotaAddress();
        console.log('Using playground wallet for dry run:', sender);
      } else if (currentAccount?.address) {
        // Use external wallet address
        sender = currentAccount.address;
        console.log('Using external wallet for dry run:', sender);
      } else {
        // Fallback: try to determine from object owner or use system address
        const firstObjArg = commands
          .flatMap((c) => (c.type === 'MoveCall' ? (c.arguments || []) : []))
          .find((a: any) => a?.type === 'object' || (a?.type === 'input' && a?.paramType?.startsWith('&')));
        if (firstObjArg?.value) {
          try {
            const objectId = normalizeObjectId(firstObjArg.value);
            const objInfo = await client.getObject({ id: objectId, options: { showOwner: true } });
            const owner = objInfo.data?.owner;
            if (owner && typeof owner === 'object' && 'AddressOwner' in owner) {
              sender = owner.AddressOwner as string;
              console.log('Using object owner for dry run:', sender);
            } else {
              sender = '0x0000000000000000000000000000000000000000000000000000000000000006';
              console.log('Using fallback system address for dry run');
            }
          } catch (e) {
            console.log('Could not determine object owner for sender:', e);
            sender = '0x0000000000000000000000000000000000000000000000000000000000000006';
          }
        } else {
          sender = '0x0000000000000000000000000000000000000000000000000000000000000006';
          console.log('Using fallback system address for dry run');
        }
      }
      
      tx.setSender(sender);
      
      // Always use dry run for simulation (both view and entry functions)
      console.log('Setting gas budget...');
      tx.setGasBudget(1000000000); // 1 IOTA
      console.log('Building transaction block...');
      const transactionBlock = await tx.build({ client });
      console.log('Transaction block built successfully');

      console.log('Running dry run...');
      const dryRunResult = await client.dryRunTransactionBlock({
        transactionBlock,
      });
      console.log('Dry run result:', dryRunResult);

      setResult({
        success: dryRunResult.effects?.status?.status === 'success',
        gasUsed: dryRunResult.effects?.gasUsed?.computationCost || '0',
        objectChanges: dryRunResult.objectChanges,
        events: dryRunResult.events,
        effects: dryRunResult.effects,
        error: dryRunResult.effects?.status?.error,
        senderAddress: sender,
      });

      toast({
        title: 'Dry Run Complete',
        description: dryRunResult.effects?.status?.status === 'success'
          ? 'Transaction simulation successful'
          : 'Transaction simulation failed',
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
      
      const client = new IotaClient({ url: getFullnodeUrl(network) });
      
      if (walletType === 'external') {
        // External wallet execution
        const tx = await buildTransaction(client);
        
        // For external wallets, set gas budget but NOT sender (dapp-kit handles it)
        tx.setGasBudget(1000000000); // 1 IOTA
        
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
        // Playground wallet execution - handle on frontend
        const playgroundPrivateKey = import.meta.env.VITE_PLAYGROUND_WALLET_PRIVATE_KEY;
        if (!playgroundPrivateKey) {
          throw new Error('Playground wallet private key not configured');
        }
        
        // Create keypair from private key
        const keypair = Ed25519Keypair.fromSecretKey(playgroundPrivateKey);
        const playgroundAddress = keypair.toIotaAddress();
        
        console.log('🔑 Using playground wallet:', playgroundAddress);
        
        // Build transaction
        const tx = await buildTransaction(client);
        
        // Set gas budget and sender for playground wallet
        tx.setGasBudget(1000000000); // 1 IOTA
        tx.setSender(playgroundAddress);
        
        // First, try to execute as a view function using devInspect
        let isViewFunction = false;
        let viewResult = null;
        
        try {
          console.log('🔍 Attempting devInspectTransactionBlock...');
          const transactionBlock = await tx.build({ client });
          
          const inspectResult = await client.devInspectTransactionBlock({
            transactionBlock,
            sender: playgroundAddress,
          });
          
          console.log('📊 DevInspect result:', inspectResult);
          
          // Check if this is a successful view function
          if (inspectResult.effects?.status?.status === 'success' && inspectResult.results?.[0]?.returnValues) {
            isViewFunction = true;
            viewResult = inspectResult;
            console.log('✅ Function executed as view function');
          }
        } catch (devInspectError: any) {
          console.log('ℹ️ DevInspect failed or no return values, will execute as transaction:', devInspectError);
          
          // Check for ownership errors
          if (devInspectError.message?.includes('is owned by') || devInspectError.message?.includes('owner/signer')) {
            // Extract owner address from error message if possible
            const ownerMatch = devInspectError.message.match(/owned by account address (0x[a-f0-9]+)/i);
            const ownerAddress = ownerMatch ? ownerMatch[1] : 'another wallet';
            
            throw new Error(
              `This object is owned by ${ownerAddress}. Only the owner can execute functions that require owned objects. ` +
              `The playground wallet (${playgroundAddress}) cannot access objects owned by other wallets.`
            );
          }
        }
        
        if (isViewFunction && viewResult) {
          // Handle view function result
          const returnValues = viewResult.results[0].returnValues || [];
          
          // Process return values
          const decodedValues = returnValues.map((value: any) => {
            if (Array.isArray(value) && value.length === 2) {
              const [data, type] = value;
              
              if (type && data) {
                try {
                  // For number types, decode the bytes
                  if (['u8', 'u16', 'u32', 'u64', 'u128', 'u256'].includes(type)) {
                    const bytes = new Uint8Array(data);
                    let num = BigInt(0);
                    // Little-endian byte order
                    for (let i = 0; i < bytes.length; i++) {
                      num = num | (BigInt(bytes[i]) << BigInt(i * 8));
                    }
                    return {
                      value: num.toString(),
                      type: type,
                    };
                  }
                  
                  // For bool
                  if (type === 'bool') {
                    return {
                      value: data[0] === 1,
                      type: 'bool',
                    };
                  }
                  
                  // For address
                  if (type === 'address') {
                    const hex = '0x' + Array.from(data, (byte: any) => 
                      byte.toString(16).padStart(2, '0')
                    ).join('');
                    return {
                      value: hex,
                      type: 'address',
                    };
                  }
                  
                  // Default
                  return {
                    value: data,
                    type: type,
                  };
                } catch (e) {
                  return { value: data, type: type };
                }
              }
            }
            return value;
          });
          
          // Calculate gas used
          const computationCost = parseInt(viewResult.effects?.gasUsed?.computationCost || '0');
          const storageCost = parseInt(viewResult.effects?.gasUsed?.storageCost || '0');
          const storageRebate = parseInt(viewResult.effects?.gasUsed?.storageRebate || '0');
          const totalGasUsed = (computationCost + storageCost - storageRebate).toString();
          
          setResult({
            success: true,
            gasUsed: totalGasUsed,
            returnValues: decodedValues,
            isViewFunction: true,
          });
          
          toast({
            title: "View Function Executed",
            description: "Function executed successfully (read-only)",
          });
          
          if (onExecutionComplete) {
            onExecutionComplete();
          }
        } else {
          // Execute as a regular transaction
          console.log('🚀 Executing as regular transaction...');
          
          const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: {
              showEffects: true,
              showObjectChanges: true,
              showEvents: true,
            }
          });
          
          if (result.effects?.status?.status === 'success') {
            // Calculate total gas used
            const computationCost = parseInt(result.effects.gasUsed?.computationCost || '0');
            const storageCost = parseInt(result.effects.gasUsed?.storageCost || '0');
            const storageRebate = parseInt(result.effects.gasUsed?.storageRebate || '0');
            const totalGasUsed = (computationCost + storageCost - storageRebate).toString();
            
            setResult({
              success: true,
              transactionDigest: result.digest,
              gasUsed: totalGasUsed,
              objectChanges: result.objectChanges,
              events: result.events,
              effects: result.effects,
            });
            
            await savePTBHistory(true, result.digest, totalGasUsed);
            
            toast({
              title: "Transaction Successful",
              description: `Transaction: ${result.digest.slice(0, 10)}...`,
            });
            
            if (onExecutionComplete) {
              onExecutionComplete();
            }
          } else {
            const errorMsg = result.effects?.status?.error || 'Transaction failed';
            
            // Check for ownership errors
            if (errorMsg.includes('is owned by') || errorMsg.includes('owner/signer')) {
              const ownerMatch = errorMsg.match(/owned by account address (0x[a-f0-9]+)/i);
              const ownerAddress = ownerMatch ? ownerMatch[1] : 'another wallet';
              
              throw new Error(
                `This object is owned by ${ownerAddress}. Only the owner can execute functions that require owned objects. ` +
                `The playground wallet (${playgroundAddress}) cannot access objects owned by other wallets.`
              );
            }
            
            throw new Error(errorMsg);
          }
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
      
      // Extract function and module names from MoveCall commands
      let functionName = '';
      let moduleName = '';
      const moveCallCommand = commands.find(cmd => cmd.type === 'MoveCall');
      if (moveCallCommand) {
        // Extract module and function from the command
        if ('module' in moveCallCommand && moveCallCommand.module) {
          moduleName = moveCallCommand.module;
        }
        if ('function' in moveCallCommand && moveCallCommand.function) {
          functionName = moveCallCommand.function;
        }
        // Fallback: parse from target if available
        if (!functionName && 'target' in moveCallCommand && moveCallCommand.target) {
          const parts = moveCallCommand.target.split('::');
          if (parts.length >= 3) {
            moduleName = moduleName || parts[1];
            functionName = functionName || parts[2];
          }
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
        functionName: functionName || commands[0]?.type || 'PTB',
        moduleName: moduleName || 'PTB',
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
        `https://explorer.iota.org/txblock/${result.transactionDigest}?network=${network}`,
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
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 p-4">
                {commands.map((command, index) => (
                  <Card key={index} className="border bg-gradient-to-br from-muted/50 to-background">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline" className="font-mono">
                          {index + 1}
                        </Badge>
                        <Badge>{command.type}</Badge>
                        {command.description && (
                          <span className="text-sm text-muted-foreground">
                            {command.description}
                          </span>
                        )}
                      </div>
                      <div className="bg-background/50 rounded-md p-3 border overflow-hidden">
                        <pre className="text-xs font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-[300px] overflow-y-auto">
                          {JSON.stringify(command, null, 2)}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
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

                  {/* Commands Summary */}
                  {commands.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Executed Commands ({commands.length})</Label>
                      <div className="space-y-2 mt-2">
                        {commands.map((cmd, index) => {
                          const getIcon = () => {
                            switch (cmd.type) {
                              case 'MoveCall': return <FunctionSquare className="h-3 w-3" />;
                              case 'TransferObjects': return <Send className="h-3 w-3" />;
                              case 'SplitCoins': return <Split className="h-3 w-3" />;
                              case 'MergeCoins': return <Merge className="h-3 w-3" />;
                              default: return <Code2 className="h-3 w-3" />;
                            }
                          };
                          
                          return (
                            <div key={index} className="p-2.5 bg-gradient-to-r from-muted/50 to-muted/30 rounded-md border border-border/50">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs h-5">
                                  {index + 1}
                                </Badge>
                                {getIcon()}
                                <span className="font-mono text-xs truncate">
                                  {cmd.type === 'MoveCall' ? `${cmd.module}::${cmd.function}` : cmd.type}
                                </span>
                                {cmd.type === 'MoveCall' && (cmd as any).isEntry && (
                                  <Badge variant="secondary" className="text-xs h-5">
                                    Entry
                                  </Badge>
                                )}
                              </div>
                              {cmd.type === 'MoveCall' && cmd.target && (
                                <div className="mt-1 text-[10px] text-muted-foreground font-mono pl-7 truncate">
                                  {cmd.target.split('::')[0].slice(0, 10)}...{cmd.target.split('::')[0].slice(-4)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {result.senderAddress && (
                    <div className="overflow-hidden">
                      <Label className="text-sm">Sender Address</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs bg-muted p-2 rounded flex-1 font-mono break-all">
                          {result.senderAddress}
                        </code>
                      </div>
                    </div>
                  )}

                  {result.returnValues && result.returnValues.length > 0 && (
                    <div className="overflow-hidden">
                      <Label className="text-sm">Return Values</Label>
                      <div className="mt-1 bg-muted rounded-md p-2 max-h-[200px] overflow-auto space-y-2">
                        {result.returnValues.map((value: any, index: number) => (
                          <div key={index} className="flex items-start gap-2">
                            <Badge variant="outline" className="text-xs h-5 mt-0.5">
                              {index}
                            </Badge>
                            <div className="flex-1">
                              {value.type && value.value !== undefined ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono">
                                      {typeof value.value === 'object' 
                                        ? JSON.stringify(value.value) 
                                        : String(value.value)}
                                    </span>
                                    <Badge variant="secondary" className="text-xs h-4">
                                      {value.type}
                                    </Badge>
                                  </div>
                                </div>
                              ) : (
                                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                                  {JSON.stringify(value, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.transactionDigest && (
                    <div className="overflow-hidden">
                      <Label className="text-sm">Transaction Digest</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs bg-muted p-2 rounded flex-1 break-all">
                          {result.transactionDigest}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={openExplorer}
                          className="flex-shrink-0"
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
                      <AlertDescription className="break-words">{result.error}</AlertDescription>
                    </Alert>
                  )}

                  {result.objectChanges && result.objectChanges.length > 0 && (
                    <div className="overflow-hidden">
                      <Label className="text-sm">Object Changes</Label>
                      <div className="mt-1 bg-muted rounded-md p-2 max-h-[200px] overflow-auto">
                        <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                          {JSON.stringify(result.objectChanges, null, 2)}
                        </pre>
                      </div>
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
