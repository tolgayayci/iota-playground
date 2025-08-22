import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Parse legacy string argument (backward compatibility)
 */
function parseLegacyArgument(tx: any, arg: string): any {
  // Try to parse as number first (for u8, u16, u32, u64, etc.)
  const num = parseInt(arg);
  if (!isNaN(num) && num.toString() === arg.trim()) {
    return tx.pure.u64(num); // Use pure value for numbers
  }
  
  // Handle boolean values
  if (arg.toLowerCase() === 'true') return tx.pure.bool(true);
  if (arg.toLowerCase() === 'false') return tx.pure.bool(false);
  
  // Handle addresses
  if (arg.startsWith('0x') && arg.match(/^0x[0-9a-fA-F]+$/)) {
    return tx.pure.address(arg);
  }
  
  // Handle object references (when user passes object IDs)
  if (arg.match(/^0x[0-9a-fA-F]{64}$/)) {
    return tx.object(arg);
  }
  
  // Default to string
  return tx.pure.string(arg);
}

/**
 * Parse typed argument using Move type information
 */
function parseTypedArgument(tx: any, value: string, moveType: string): any {
  const normalizedType = moveType.trim().toLowerCase();
  
  // Handle reference types (objects) - these need tx.object()
  if (normalizedType.includes('&')) {
    // Remove reference markers to get the base type
    const baseType = normalizedType.replace(/^&(mut\s+)?/, '');
    logger.info(`Parsing object reference: ${moveType} -> ${baseType}`);
    
    // Validate object ID format
    if (!value.match(/^0x[0-9a-fA-F]{64}$/)) {
      throw new Error(`Invalid object ID format for ${moveType}: ${value}. Expected 64-character hex string starting with 0x.`);
    }
    
    return tx.object(value);
  }
  
  // Handle primitive types - these use tx.pure.*()
  
  // Integer types
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
    const num = BigInt(value);
    if (num < 0n || num > 18446744073709551615n) {
      throw new Error(`Invalid u64 value: ${value}. Must be 0-18446744073709551615.`);
    }
    return tx.pure.u64(value); // Pass as string for large numbers
  }
  
  if (normalizedType === 'u128') {
    const num = BigInt(value);
    if (num < 0n) {
      throw new Error(`Invalid u128 value: ${value}. Must be non-negative.`);
    }
    return tx.pure.u128(value); // Pass as string for large numbers
  }
  
  if (normalizedType === 'u256') {
    const num = BigInt(value);
    if (num < 0n) {
      throw new Error(`Invalid u256 value: ${value}. Must be non-negative.`);
    }
    return tx.pure.u256(value); // Pass as string for large numbers
  }
  
  // Boolean type
  if (normalizedType === 'bool') {
    if (value.toLowerCase() === 'true') return tx.pure.bool(true);
    if (value.toLowerCase() === 'false') return tx.pure.bool(false);
    throw new Error(`Invalid bool value: ${value}. Must be 'true' or 'false'.`);
  }
  
  // Address type
  if (normalizedType === 'address') {
    if (!value.match(/^0x[0-9a-fA-F]+$/)) {
      throw new Error(`Invalid address format: ${value}. Must be hex string starting with 0x.`);
    }
    return tx.pure.address(value);
  }
  
  // Vector types
  if (normalizedType.startsWith('vector<')) {
    // For now, handle as string - could be enhanced for specific vector types
    logger.warn(`Vector type parsing not fully implemented for: ${moveType}`);
    return tx.pure.string(value);
  }
  
  // String and other types
  logger.info(`Treating as string type: ${moveType}`);
  return tx.pure.string(value);
}

export interface PTBExecutionResult {
  success: boolean;
  transactionDigest?: string;
  gasUsed?: string;
  error?: string;
  objectChanges?: any[];
}

export interface ViewFunctionResult {
  success: boolean;
  returnValues?: any[];
  error?: string;
  gasUsed?: string;
}

type FunctionArg = string | { value: string; type: string };

export async function executePlaygroundWalletPTB(
  projectId: string,
  functionTarget: string,
  functionArgs: FunctionArg[],
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<PTBExecutionResult> {
  try {
    const argsLog = functionArgs.map(arg => 
      typeof arg === 'string' ? arg : `${arg.value} (${arg.type})`
    ).join(', ');
    logger.info(`Executing PTB: ${functionTarget} with args: [${argsLog}]`);

    // Use SDK implementation directly - more reliable than CLI
    return await executePlaygroundWalletPTBWithSDK(projectId, functionTarget, functionArgs, network);

  } catch (error) {
    logger.error('PTB execution failed:', error);
    
    if (error instanceof Error) {
      // Check for common IOTA errors
      if (error.message.includes('insufficient funds')) {
        throw new Error('Insufficient funds in playground wallet. Please fund the wallet with testnet IOTA.');
      }
      if (error.message.includes('package not found')) {
        throw new Error('Package not found. Make sure the contract is deployed correctly.');
      }
      if (error.message.includes('function not found')) {
        throw new Error('Function not found in the specified module.');
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown execution error',
    };
  }
}

// Alternative implementation using TypeScript SDK (if CLI fails)
export async function executePlaygroundWalletPTBWithSDK(
  projectId: string,
  functionTarget: string,
  functionArgs: FunctionArg[],
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<PTBExecutionResult> {
  try {
    const { Transaction } = await import('@iota/iota-sdk/transactions');
    const { IotaClient, getFullnodeUrl } = await import('@iota/iota-sdk/client');
    const { Ed25519Keypair } = await import('@iota/iota-sdk/keypairs/ed25519');
    
    // Initialize client
    const client = new IotaClient({ url: getFullnodeUrl(network) });
    
    // Get playground wallet keypair
    const { getPlaygroundPrivateKey } = await import('../config/wallet');
    const privateKey = getPlaygroundPrivateKey();
    if (!privateKey) {
      throw new Error('Playground wallet private key not configured');
    }

    const keypair = Ed25519Keypair.fromSecretKey(privateKey);
    const senderAddress = keypair.toIotaAddress();
    
    // Create transaction
    const tx = new Transaction();
    
    // Convert arguments to proper Transaction arguments based on type information
    const txArgs = functionArgs.map(arg => {
      // Handle legacy string arguments (backward compatibility)
      if (typeof arg === 'string') {
        return parseLegacyArgument(tx, arg);
      }
      
      // Handle new typed arguments
      const { value, type } = arg;
      return parseTypedArgument(tx, value, type);
    });
    
    tx.moveCall({
      target: functionTarget,
      arguments: txArgs,
    });

    // Execute transaction
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
      return {
        success: true,
        transactionDigest: result.digest,
        gasUsed: result.effects.gasUsed?.computationCost || '0',
        objectChanges: result.objectChanges || [],
      };
    } else {
      throw new Error(result.effects?.status?.error || 'Transaction failed');
    }

  } catch (error) {
    logger.error('SDK PTB execution failed:', error);
    logger.error('Error details:', error instanceof Error ? error.stack : error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SDK execution failed',
    };
  }
}

// Execute view function using devInspectTransactionBlock
export async function executeViewFunction(
  functionTarget: string,
  functionArgs: FunctionArg[],
  network: 'testnet' | 'mainnet' = 'testnet',
  sender?: string
): Promise<ViewFunctionResult> {
  try {
    const { Transaction } = await import('@iota/iota-sdk/transactions');
    const { IotaClient, getFullnodeUrl } = await import('@iota/iota-sdk/client');
    
    logger.info(`Executing view function: ${functionTarget}`);
    logger.info(`Network: ${network}`);
    logger.info(`Sender: ${sender || 'will determine from objects'}`);
    
    // Initialize client
    const client = new IotaClient({ url: getFullnodeUrl(network) });
    
    // Create transaction
    const tx = new Transaction();
    
    // Determine sender address
    let inspectSender = sender || '0x0000000000000000000000000000000000000000000000000000000000000000';
    
    // If no sender provided but we have object references, try to get owner
    if (!sender && functionArgs.length > 0) {
      for (const arg of functionArgs) {
        const argValue = typeof arg === 'string' ? arg : arg.value;
        const argType = typeof arg === 'string' ? '' : arg.type;
        
        // Check if this is an object reference
        if (argType.toLowerCase().startsWith('&') || argValue.match(/^0x[0-9a-fA-F]{64}$/)) {
          try {
            logger.info(`Checking owner of object: ${argValue}`);
            const objectInfo = await client.getObject({
              id: argValue,
              options: { showOwner: true }
            });
            
            if (objectInfo.data?.owner) {
              if (typeof objectInfo.data.owner === 'object' && 'AddressOwner' in objectInfo.data.owner) {
                inspectSender = objectInfo.data.owner.AddressOwner;
                logger.info(`Using object owner as sender: ${inspectSender}`);
                break;
              }
            }
          } catch (e) {
            logger.warn(`Could not fetch object info for ${argValue}:`, e);
          }
        }
      }
    }
    
    // Set sender BEFORE building arguments - critical for proper serialization
    tx.setSender(inspectSender);
    logger.info(`Set transaction sender to: ${inspectSender}`);
    
    // Convert arguments to proper Transaction arguments
    const txArgs = functionArgs.map((arg, index) => {
      logger.info(`Processing argument ${index}: ${JSON.stringify(arg)}`);
      
      if (typeof arg === 'string') {
        return parseLegacyArgument(tx, arg);
      }
      
      const { value, type } = arg;
      return parseTypedArgument(tx, value, type);
    });
    
    logger.info(`Built ${txArgs.length} transaction arguments`);
    
    // Add the move call
    tx.moveCall({
      target: functionTarget,
      arguments: txArgs,
    });
    
    logger.info('Added moveCall to transaction, building transaction block...');
    
    // Build the transaction
    const transactionBlock = await tx.build({ client });
    
    logger.info('Executing devInspectTransactionBlock...');
    
    // Execute devInspect
    const result = await client.devInspectTransactionBlock({
      transactionBlock,
      sender: inspectSender,
    });
    
    logger.info('devInspect result:', JSON.stringify(result, null, 2));
    
    if (result.effects?.status?.status === 'success') {
      // Extract return values
      const returnValues = result.results?.[0]?.returnValues || [];
      
      // Process and decode return values
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
                  raw: data
                };
              }
              
              // For bool
              if (type === 'bool') {
                return {
                  value: data[0] === 1,
                  type: 'bool',
                  raw: data
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
                  raw: data
                };
              }
              
              // Default: return raw data
              return {
                value: data,
                type: type,
                raw: data
              };
            } catch (e) {
              logger.error('Error decoding value:', e);
              return {
                value: data,
                type: type,
                error: e instanceof Error ? e.message : 'Decoding error'
              };
            }
          }
        }
        return value;
      });
      
      logger.info(`View function executed successfully, ${decodedValues.length} return values`);
      
      return {
        success: true,
        returnValues: decodedValues,
        gasUsed: result.effects?.gasUsed?.computationCost || '0',
      };
    } else {
      const errorMsg = result.effects?.status?.error || 'View function execution failed';
      logger.error('View function failed:', errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }
    
  } catch (error) {
    logger.error('View function execution error:', error);
    logger.error('Error stack:', error instanceof Error ? error.stack : error);
    
    // Check for specific error patterns
    if (error instanceof Error) {
      if (error.message.includes('Deserialization error')) {
        // Try alternative approach with playground wallet
        logger.info('Deserialization error detected, trying with playground wallet address...');
        
        try {
          const { getPlaygroundPrivateKey } = await import('../config/wallet');
          const privateKey = getPlaygroundPrivateKey();
          
          if (privateKey) {
            const { Ed25519Keypair } = await import('@iota/iota-sdk/keypairs/ed25519');
            const keypair = Ed25519Keypair.fromSecretKey(privateKey);
            const playgroundAddress = keypair.toIotaAddress();
            
            // Retry with playground wallet address if not already tried
            if (sender !== playgroundAddress) {
              logger.info(`Retrying with playground wallet address: ${playgroundAddress}`);
              return await executeViewFunction(functionTarget, functionArgs, network, playgroundAddress);
            }
          }
        } catch (retryError) {
          logger.error('Retry with playground wallet failed:', retryError);
        }
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'View function execution failed',
    };
  }
}