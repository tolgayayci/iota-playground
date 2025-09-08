export interface User {
  id: string;
  email: string;
  name?: string;
  company?: string;
  bio?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  code: string;
  created_at: string;
  updated_at: string;
  last_compilation?: CompilationResult;
  metadata?: Record<string, any>;
  last_activity_at?: string;
  deployment_count?: number;
}

export interface ModuleFunction {
  name: string;
  type: string;
  inputs?: ModuleFunctionInput[];
  outputs?: ModuleFunctionOutput[];
  parameters?: ModuleFunctionInput[]; // Move format
  visibility?: 'public' | 'entry' | 'private' | 'friend';
  is_entry?: boolean; // IOTA Move format
  module?: string; // Module name for function calls
  return_type?: string; // Move return type
  returnType?: string; // Alternative return type field
  typeParameters?: string[]; // Generic type parameters
  isMut?: boolean; // Whether the function mutates state
  isOptional?: boolean; // Whether parameters are optional
}

export interface ModuleFunctionInput {
  name: string;
  type: string;
  indexed?: boolean;
  isOptional?: boolean;
}

export interface ModuleFunctionOutput {
  name: string;
  type: string;
}

// Legacy types for backward compatibility
export interface ABIMethod extends ModuleFunction {}
export interface ABIInput extends ModuleFunctionInput {}
export interface ABIOutput extends ModuleFunctionOutput {}
export interface ABIParameter extends ModuleFunctionInput {}

export interface Deployment {
  id: string;
  project_id: string;
  user_id: string;
  contract_address: string;
  package_id: string;
  module_address: string;
  module_name: string;
  abi: ModuleFunction[];
  created_at: string;
  network?: string;
  transaction_hash?: string;
  gas_used?: number;
  source_code?: string;
}

export interface CompilationResult {
  success: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  details: {
    status: string;
    compilation_time: number;
    project_path: string;
  };
  abi?: ModuleFunction[];
  bytecode?: string;
  modules?: string[]; // Base64 encoded modules
  dependencies?: string[];
  disassembly?: string; // Disassembly output
  digest?: string; // Blake2B digest from IOTA CLI
  code_snapshot: string;
}

export interface DeploymentResult {
  success: boolean;
  contract_address?: string;
  transaction_hash?: string;
  package_id?: string;
  module_ids?: string[];
  gas_used?: number;
  gas_cost?: number;
  error?: string;
  network: 'testnet' | 'mainnet';
  explorer_url?: string;
}

export interface ModuleCall {
  id: string;
  project_id: string;
  contract_address: string;
  method_name: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  status: 'pending' | 'success' | 'error';
  error?: string;
  gas_used?: number;
  created_at: string;
  network?: string;
}

// IOTA Normalized Module Types
export interface IotaMoveNormalizedType {
  Struct?: {
    address: string;
    module: string;
    name: string;
    type_arguments?: IotaMoveNormalizedType[];
  };
  Reference?: IotaMoveNormalizedType;
  MutableReference?: IotaMoveNormalizedType;
  Vector?: IotaMoveNormalizedType;
  TypeParameter?: number;
  Bool?: null;
  U8?: null;
  U16?: null;
  U32?: null;
  U64?: null;
  U128?: null;
  U256?: null;
  Address?: null;
  Signer?: null;
}

export interface IotaMoveNormalizedFunction {
  visibility: 'Public' | 'Friend' | 'Private';
  is_entry: boolean;
  type_parameters: Array<{
    constraints: {
      abilities: string[];
    };
  }>;
  parameters: IotaMoveNormalizedType[];
  return_: IotaMoveNormalizedType[];
}

export interface IotaMoveNormalizedStruct {
  abilities: {
    abilities: string[];
  };
  type_parameters: Array<{
    constraints: {
      abilities: string[];
    };
    is_phantom: boolean;
  }>;
  fields: Array<{
    name: string;
    type_: IotaMoveNormalizedType;
  }>;
}

export interface IotaMoveNormalizedModule {
  file_format_version: number;
  address: string;
  name: string;
  friends: Array<{
    address: string;
    name: string;
  }>;
  structs: Record<string, IotaMoveNormalizedStruct>;
  exposed_functions: Record<string, IotaMoveNormalizedFunction>;
}

export interface ModuleInterfaceData {
  packageId: string;
  modules: Array<{
    name: string;
    address: string;
    functions: ModuleFunction[];
    structs: Array<{
      name: string;
      fields: Array<{
        name: string;
        type: string;
      }>;
      abilities?: string[];
    }>;
  }>;
}