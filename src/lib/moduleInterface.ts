import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';
import {
  IotaMoveNormalizedModule,
  IotaMoveNormalizedFunction,
  IotaMoveNormalizedType,
  ModuleFunction,
  ModuleInterfaceData,
  ModuleFunctionInput,
} from './types';

/**
 * Cache for module interface data to avoid repeated blockchain calls
 */
const moduleInterfaceCache = new Map<string, {
  data: ModuleInterfaceData;
  timestamp: number;
}>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Convert IOTA normalized type to human-readable string
 */
function normalizedTypeToString(type: any): string {
  // Handle null/undefined
  if (!type) return 'unknown';
  
  // Handle string type (might be returned as simple strings)
  if (typeof type === 'string') {
    return type;
  }
  
  // Handle primitive types
  if (type === 'Bool' || (type.Bool !== undefined)) return 'bool';
  if (type === 'U8' || (type.U8 !== undefined)) return 'u8';
  if (type === 'U16' || (type.U16 !== undefined)) return 'u16';
  if (type === 'U32' || (type.U32 !== undefined)) return 'u32';
  if (type === 'U64' || (type.U64 !== undefined)) return 'u64';
  if (type === 'U128' || (type.U128 !== undefined)) return 'u128';
  if (type === 'U256' || (type.U256 !== undefined)) return 'u256';
  if (type === 'Address' || (type.Address !== undefined)) return 'address';
  if (type === 'Signer' || (type.Signer !== undefined)) return 'signer';
  
  // Handle complex types
  if (type.Vector) {
    return `vector<${normalizedTypeToString(type.Vector)}>`;
  }
  
  if (type.Reference) {
    return `&${normalizedTypeToString(type.Reference)}`;
  }
  
  if (type.MutableReference) {
    return `&mut ${normalizedTypeToString(type.MutableReference)}`;
  }
  
  if (type.Struct) {
    const { address, module, name } = type.Struct;
    const typeArgs = type.Struct.type_arguments;
    if (typeArgs && typeArgs.length > 0) {
      const args = typeArgs.map(normalizedTypeToString).join(', ');
      return `${address}::${module}::${name}<${args}>`;
    }
    return `${address}::${module}::${name}`;
  }
  
  if (type.TypeParameter !== undefined) {
    return `T${type.TypeParameter}`;
  }
  
  // Debug log unknown types
  console.warn('Unknown type format:', type);
  return 'unknown';
}

/**
 * Convert IOTA normalized function to our ModuleFunction format
 */
function convertNormalizedFunction(
  name: string,
  func: any, // Use any since the actual IOTA structure differs from our types
  moduleName: string
): ModuleFunction {
  console.log(`Converting function ${name}:`, func);
  
  // Convert parameters - handle both possible property names
  const parameters = func.parameters || func.params || [];
  const inputs: ModuleFunctionInput[] = parameters.map((param: any, index: number) => {
    const paramType = normalizedTypeToString(param);
    return {
      name: `arg${index}`, // IOTA doesn't provide parameter names, use generic names
      type: paramType,
    };
  });

  // Convert return types - handle both possible property names
  const returnTypes = func.return || func.return_ || [];
  const outputs = returnTypes.map((returnType: any, index: number) => ({
    name: `result${index}`,
    type: normalizedTypeToString(returnType),
  }));

  // Handle both isEntry and is_entry
  // IMPORTANT: Functions that create objects or modify state are entry functions
  // even if not explicitly marked as isEntry in the normalized module
  const isEntry = func.isEntry || func.is_entry || false;
  
  // Additional heuristic: functions with no return values that take TxContext are likely entry functions
  const hasTxContext = parameters.some((param: any) => {
    const paramType = normalizedTypeToString(param);
    return paramType.toLowerCase().includes('txcontext');
  });
  
  // Functions named create/mint/burn/transfer are typically entry functions
  const isLikelyEntry = name.startsWith('create_') || 
                        name.startsWith('mint_') || 
                        name.startsWith('burn_') ||
                        name.startsWith('transfer_') ||
                        name === 'create' ||
                        name === 'mint' ||
                        name === 'burn' ||
                        name === 'transfer';
  
  // If it has TxContext and no return values, or matches entry patterns, it's likely an entry function
  const shouldBeEntry = isEntry || (hasTxContext && returnTypes.length === 0) || isLikelyEntry;

  // Map visibility correctly
  let visibility: 'public' | 'entry' | 'private' | 'friend' = 'public';
  if (func.visibility === 'Private') visibility = 'private';
  else if (func.visibility === 'Friend') visibility = 'friend';
  else if (shouldBeEntry) visibility = 'entry';

  // Extract type parameters
  const typeParameters = func.typeParameters?.map((tp: any, idx: number) => `T${idx}`) || [];
  
  // Format return type for display
  const returnType = returnTypes.length > 0 
    ? returnTypes.map(t => normalizedTypeToString(t)).join(', ')
    : undefined;

  return {
    name,
    type: shouldBeEntry ? 'entry' : 'public',
    visibility,
    is_entry: shouldBeEntry,
    module: moduleName,
    inputs,
    outputs: outputs.length > 0 ? outputs : undefined,
    parameters: inputs, // For backward compatibility
    returnType,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    isMut: hasTxContext, // Functions with TxContext usually mutate state
  };
}

/**
 * Fetch normalized module interface from IOTA blockchain
 */
export async function fetchModuleInterface(
  packageId: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<ModuleInterfaceData> {
  const cacheKey = `${packageId}-${network}`;
  const cached = moduleInterfaceCache.get(cacheKey);
  
  // Check cache
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const client = new IotaClient({ url: getFullnodeUrl(network) });
    
    // Get all normalized modules in the package
    console.log(`Fetching modules for package: ${packageId} on ${network}`);
    const normalizedModules = await client.getNormalizedMoveModulesByPackage({
      package: packageId,
    });
    
    console.log('Raw normalized modules:', normalizedModules);

    const modules = Object.entries(normalizedModules).map(([moduleName, moduleData]) => {
      const normalizedModule = moduleData as IotaMoveNormalizedModule;
      
      // Convert functions - use the correct property name (camelCase)
      const exposedFunctions = normalizedModule.exposedFunctions || {};
      
      console.log(`Processing module: ${moduleName}`, { 
        exposedFunctions: normalizedModule.exposedFunctions,
        allProps: Object.keys(normalizedModule)
      });
      
      const functions: ModuleFunction[] = Object.entries(exposedFunctions)
        .filter(([funcName, func]) => {
          console.log(`Checking function ${funcName}: visibility=${func.visibility}, isEntry=${func.isEntry}`);
          // Show public functions OR entry functions
          return func.visibility === 'Public' || func.isEntry === true;
        })
        .map(([funcName, func]) => {
          try {
            return convertNormalizedFunction(funcName, func, moduleName);
          } catch (error) {
            console.error(`Error converting function ${funcName}:`, error, func);
            // Return a fallback function with minimal info
            return {
              name: funcName,
              type: func.is_entry ? 'entry' : 'public',
              visibility: 'public' as const,
              is_entry: func.is_entry || false,
              module: moduleName,
              inputs: [],
              parameters: [],
            };
          }
        });

      // Convert structs
      console.log(`Processing structs for module ${moduleName}:`, normalizedModule.structs);
      const structs = Object.entries(normalizedModule.structs || {}).map(([structName, structData]: [string, any]) => ({
        name: structName,
        fields: (structData.fields || []).map((field: any) => ({
          name: field.name,
          type: normalizedTypeToString(field.type_ || field.type),
        })),
        abilities: structData.abilities?.abilities || [],
      }));

      return {
        name: moduleName,
        address: normalizedModule.address,
        functions,
        structs,
      };
    });

    const result: ModuleInterfaceData = {
      packageId,
      modules,
    };

    // Cache the result
    moduleInterfaceCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  } catch (error) {
    console.error('Error fetching module interface:', error);
    throw new Error(`Failed to fetch module interface for package ${packageId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a specific module by name from a package
 */
export async function fetchSingleModule(
  packageId: string,
  moduleName: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<ModuleFunction[]> {
  try {
    const client = new IotaClient({ url: getFullnodeUrl(network) });
    
    const normalizedModule = await client.getNormalizedMoveModule({
      package: packageId,
      module: moduleName,
    });

    // Convert functions
    const functions: ModuleFunction[] = Object.entries(normalizedModule.exposed_functions || {})
      .filter(([, func]) => func.visibility === 'Public' || func.is_entry) // Only show public/entry functions
      .map(([funcName, func]) => convertNormalizedFunction(funcName, func, moduleName));

    return functions;
  } catch (error) {
    console.error('Error fetching single module:', error);
    throw new Error(`Failed to fetch module ${moduleName} from package ${packageId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clear the module interface cache
 */
export function clearModuleInterfaceCache(packageId?: string, network?: 'testnet' | 'mainnet') {
  if (packageId && network) {
    const cacheKey = `${packageId}-${network}`;
    moduleInterfaceCache.delete(cacheKey);
  } else {
    moduleInterfaceCache.clear();
  }
}

// Force cache refresh when code changes
export const MODULE_INTERFACE_VERSION = 2;

/**
 * Check if a package exists on the blockchain
 */
export async function verifyPackageExists(
  packageId: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<boolean> {
  try {
    const client = new IotaClient({ url: getFullnodeUrl(network) });
    const packageObj = await client.getObject({
      id: packageId,
      options: {
        showContent: false,
        showType: true,
      },
    });
    return packageObj && packageObj.data && packageObj.data.type === 'package';
  } catch (error) {
    console.error('Error verifying package:', error);
    return false;
  }
}