import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
  normalizedValue?: string;
  metadata?: Record<string, any>;
}

export interface ValidationOptions {
  network?: 'testnet' | 'mainnet';
  checkExistence?: boolean;
  expectedType?: string;
  allowEmpty?: boolean;
}

/**
 * Enhanced validation system for Move parameter inputs
 */
export class ParameterValidator {
  private client: IotaClient;
  
  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    this.client = new IotaClient({ url: getFullnodeUrl(network) });
  }

  /**
   * Validate number input based on Move type
   */
  validateNumber(value: string, type: 'u8' | 'u16' | 'u32' | 'u64' | 'u128' | 'u256', options: ValidationOptions = {}): ValidationResult {
    if (!value.trim()) {
      return { isValid: options.allowEmpty !== false };
    }

    // Type ranges
    const ranges: Record<string, { min: bigint; max: bigint }> = {
      u8: { min: 0n, max: 255n },
      u16: { min: 0n, max: 65535n },
      u32: { min: 0n, max: 4294967295n },
      u64: { min: 0n, max: 18446744073709551615n },
      u128: { min: 0n, max: 340282366920938463463374607431768211455n },
      u256: { min: 0n, max: 115792089237316195423570985008687907853269984665640564039457584007913129639935n }
    };

    const range = ranges[type];
    if (!range) {
      return { isValid: false, error: `Unknown number type: ${type}` };
    }

    // Check format
    if (!/^\d+$/.test(value.trim())) {
      return { isValid: false, error: 'Only positive integers are allowed' };
    }

    try {
      const parsed = BigInt(value);
      
      if (parsed < range.min || parsed > range.max) {
        return {
          isValid: false,
          error: `Value must be between ${range.min} and ${range.max}`
        };
      }

      return {
        isValid: true,
        normalizedValue: parsed.toString(),
        metadata: { type, range }
      };
    } catch {
      return { isValid: false, error: 'Invalid number format' };
    }
  }

  /**
   * Validate IOTA address format with normalization
   */
  validateAddress(value: string, options: ValidationOptions = {}): ValidationResult {
    if (!value.trim()) {
      return { isValid: options.allowEmpty !== false };
    }

    const cleanValue = value.trim();

    // Auto-add 0x prefix if missing
    const prefixedValue = cleanValue.startsWith('0x') ? cleanValue : `0x${cleanValue}`;

    // Check hex format after prefix
    const hexPart = prefixedValue.slice(2);
    if (!/^[0-9a-fA-F]*$/.test(hexPart)) {
      return { isValid: false, error: 'Address must contain only hexadecimal characters' };
    }

    // Normalize length - pad short addresses to 64 hex chars (32 bytes)
    let normalizedHex = hexPart.toLowerCase();
    if (normalizedHex.length < 64) {
      normalizedHex = normalizedHex.padStart(64, '0');
    } else if (normalizedHex.length > 64) {
      return { isValid: false, error: 'IOTA address cannot be longer than 32 bytes (64 hex characters)' };
    }

    const normalizedAddress = '0x' + normalizedHex;

    return {
      isValid: true,
      normalizedValue: normalizedAddress,
      metadata: { 
        type: 'address', 
        originalLength: hexPart.length,
        wasNormalized: hexPart.length !== 64
      }
    };
  }

  /**
   * Validate object ID and optionally check existence
   */
  async validateObjectId(value: string, options: ValidationOptions = {}): Promise<ValidationResult> {
    // First validate format (same as address)
    const formatResult = this.validateAddress(value, options);
    if (!formatResult.isValid) {
      return { ...formatResult, error: formatResult.error?.replace('Address', 'Object ID') };
    }

    // If existence check is disabled, return format validation
    if (!options.checkExistence) {
      return {
        ...formatResult,
        metadata: { ...formatResult.metadata, type: 'object' }
      };
    }

    // Check object existence on blockchain
    try {
      const objectResponse = await this.client.getObject({
        id: formatResult.normalizedValue!,
        options: {
          showType: true,
          showOwner: true,
        },
      });

      if (!objectResponse.data) {
        return {
          isValid: false,
          error: 'Object not found on blockchain'
        };
      }

      // Check type if expected type is provided
      if (options.expectedType && objectResponse.data.type) {
        const objectType = objectResponse.data.type;
        if (!objectType.toLowerCase().includes(options.expectedType.toLowerCase())) {
          return {
            isValid: true,
            warning: `Object type "${objectType}" may not match expected type "${options.expectedType}"`,
            normalizedValue: formatResult.normalizedValue,
            metadata: {
              type: 'object',
              objectType,
              expectedType: options.expectedType,
              owner: objectResponse.data.owner,
              version: objectResponse.data.version
            }
          };
        }
      }

      return {
        isValid: true,
        normalizedValue: formatResult.normalizedValue,
        metadata: {
          type: 'object',
          objectType: objectResponse.data.type,
          owner: objectResponse.data.owner,
          version: objectResponse.data.version,
          exists: true
        }
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Failed to verify object existence: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate boolean input
   */
  validateBoolean(value: string, options: ValidationOptions = {}): ValidationResult {
    if (!value.trim()) {
      return { isValid: options.allowEmpty !== false };
    }

    const normalized = value.toLowerCase().trim();
    
    if (normalized === 'true') {
      return { isValid: true, normalizedValue: 'true', metadata: { type: 'boolean', value: true } };
    }
    
    if (normalized === 'false') {
      return { isValid: true, normalizedValue: 'false', metadata: { type: 'boolean', value: false } };
    }

    return {
      isValid: false,
      error: 'Boolean value must be "true" or "false"'
    };
  }

  /**
   * Validate vector/array input
   */
  validateVector(value: string, elementType: string, options: ValidationOptions = {}): ValidationResult {
    if (!value.trim()) {
      return { isValid: options.allowEmpty !== false };
    }

    try {
      // Handle special byte string format for vector<u8>
      if (elementType === 'u8' && value.startsWith('b"') && value.endsWith('"')) {
        const text = value.slice(2, -1);
        return {
          isValid: true,
          normalizedValue: value,
          metadata: { type: 'vector', elementType, format: 'byte_string', length: text.length }
        };
      }

      // Parse as JSON array
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        return { isValid: false, error: 'Vector must be an array' };
      }

      // Validate each element
      const elementResults = parsed.map((element, index) => {
        const elementValue = String(element);
        return this.validateSingleType(elementValue, elementType, { ...options, allowEmpty: false });
      });

      const invalidElements = elementResults.filter(result => !result.isValid);
      if (invalidElements.length > 0) {
        return {
          isValid: false,
          error: `Invalid elements found: ${invalidElements.map(r => r.error).join(', ')}`
        };
      }

      return {
        isValid: true,
        normalizedValue: JSON.stringify(parsed),
        metadata: {
          type: 'vector',
          elementType,
          length: parsed.length,
          elements: elementResults.map(r => r.metadata)
        }
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid vector format. Use JSON array syntax: [item1, item2, ...]'
      };
    }
  }

  /**
   * Validate a single type (used internally)
   */
  private validateSingleType(value: string, type: string, options: ValidationOptions = {}): ValidationResult {
    // Number types
    if (/^u(8|16|32|64|128|256)$/.test(type)) {
      return this.validateNumber(value, type as any, options);
    }

    // Address type
    if (type === 'address') {
      return this.validateAddress(value, options);
    }

    // Boolean type
    if (type === 'bool') {
      return this.validateBoolean(value, options);
    }

    // Default to string validation (minimal)
    return {
      isValid: true,
      normalizedValue: value,
      metadata: { type: 'string' }
    };
  }

  /**
   * Enhanced comprehensive parameter validation with IOTA SDK compatibility
   */
  async validateParameter(value: string, paramType: string, options: ValidationOptions = {}): Promise<ValidationResult> {
    const normalizedType = paramType.toLowerCase().trim();
    
    // Skip TxContext parameters - they're handled automatically by the SDK
    if (normalizedType.includes('txcontext')) {
      return { 
        isValid: true, 
        metadata: { 
          type: 'txcontext', 
          skipped: true,
          sdkUsage: 'Automatically handled by IOTA SDK - no user input needed'
        } 
      };
    }

    // Handle references - these ALWAYS require existing blockchain objects
    const isReference = normalizedType.startsWith('&');
    const isMutable = normalizedType.startsWith('&mut');
    const coreType = normalizedType.replace(/^&(mut\s+)?/, '');

    // Reference types validation - must be object IDs
    if (isReference) {
      const result = await this.validateObjectId(value, { 
        ...options, 
        checkExistence: true, 
        expectedType: coreType 
      });
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          isReference: true,
          isMutable,
          sdkUsage: 'tx.object(objectId)',
          warning: isMutable ? 'This function will modify the referenced object' : undefined
        }
      };
    }

    // Vector types - special handling for different element types
    if (coreType.startsWith('vector<')) {
      const elementTypeMatch = coreType.match(/vector<(.+)>/);
      const elementType = elementTypeMatch ? elementTypeMatch[1].trim() : 'string';
      const result = this.validateVector(value, elementType, options);
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          sdkUsage: `tx.pure.vector("${elementType}", values)`,
          elementType
        }
      };
    }

    // Custom struct types (contain ::) - these might need object IDs or be constructable
    if (coreType.includes('::')) {
      // For parameters, struct types usually expect object IDs of existing instances
      const result = await this.validateObjectId(value, { 
        ...options, 
        checkExistence: true, 
        expectedType: coreType 
      });
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          isStructType: true,
          sdkUsage: 'tx.object(objectId)',
          warning: 'Custom struct types typically require existing object instances'
        }
      };
    }

    // Primitive types - use appropriate tx.pure.* methods
    let result: ValidationResult;
    let sdkUsage: string;

    if (['u8', 'u16', 'u32', 'u64', 'u128', 'u256'].includes(coreType)) {
      result = this.validateNumber(value, coreType as any, options);
      const isLargeNumber = ['u64', 'u128', 'u256'].includes(coreType);
      sdkUsage = `tx.pure.${coreType}(${isLargeNumber ? '"value"' : 'value'})`;
      
      if (isLargeNumber && result.isValid) {
        // Check if value might cause precision issues
        try {
          const numValue = Number(value);
          if (numValue > Number.MAX_SAFE_INTEGER) {
            result.warning = 'Large number - will be passed as string to prevent precision loss';
          }
        } catch {
          // Already handled by validation
        }
      }
    } else if (coreType === 'address') {
      result = this.validateAddress(value, options);
      sdkUsage = 'tx.pure.address(address)';
    } else if (coreType === 'signer') {
      result = this.validateAddress(value, options);
      sdkUsage = 'tx.pure.address(signerAddress)';
      result.warning = 'Signer parameters typically use wallet addresses';
    } else if (coreType === 'bool') {
      result = this.validateBoolean(value, options);
      sdkUsage = 'tx.pure.bool(value)';
    } else {
      // Unknown type - default to string
      result = {
        isValid: true,
        normalizedValue: value,
        metadata: { type: 'string' },
        warning: `Unknown type "${paramType}" - will be passed as string`
      };
      sdkUsage = 'tx.pure.string(value)';
    }

    return {
      ...result,
      metadata: {
        ...result.metadata,
        originalType: paramType,
        normalizedType: coreType,
        sdkUsage,
        isReference: false,
        isMutable: false
      }
    };
  }

  /**
   * Validate compatibility between expected Move type and input value
   */
  validateTypeCompatibility(value: string, expectedType: string): ValidationResult {
    const normalizedType = expectedType.toLowerCase().trim();
    
    // Check common type mismatches
    const warnings: string[] = [];
    
    // Number type compatibility
    if (['u8', 'u16', 'u32', 'u64', 'u128', 'u256'].includes(normalizedType)) {
      if (isNaN(Number(value))) {
        return {
          isValid: false,
          error: `Expected numeric value for ${expectedType}, got: ${value}`
        };
      }
      
      // Check range compatibility
      const numValue = Number(value);
      if (normalizedType === 'u8' && numValue > 255) {
        warnings.push('Value exceeds u8 range (0-255)');
      } else if (normalizedType === 'u16' && numValue > 65535) {
        warnings.push('Value exceeds u16 range (0-65535)');
      } else if (['u64', 'u128', 'u256'].includes(normalizedType) && numValue > Number.MAX_SAFE_INTEGER) {
        warnings.push('Large number - precision may be lost without string format');
      }
    }
    
    // Address compatibility
    if (normalizedType === 'address' && (!value.startsWith('0x') || value.length !== 66)) {
      return {
        isValid: false,
        error: 'Address must be 64-character hex string starting with 0x'
      };
    }
    
    // Object reference compatibility
    if (normalizedType.startsWith('&')) {
      if (!value.startsWith('0x') || value.length !== 66) {
        return {
          isValid: false,
          error: 'Object reference requires valid object ID (64-character hex string starting with 0x)'
        };
      }
    }

    return {
      isValid: true,
      warning: warnings.length > 0 ? warnings.join('; ') : undefined,
      metadata: {
        type: 'compatibility_check',
        expectedType,
        inputValue: value
      }
    };
  }
}

/**
 * Create a validator instance
 */
export function createValidator(network: 'testnet' | 'mainnet' = 'testnet'): ParameterValidator {
  return new ParameterValidator(network);
}

/**
 * Quick validation functions for common use cases
 */
export const validators = {
  number: (value: string, type: 'u8' | 'u16' | 'u32' | 'u64' | 'u128' | 'u256') => 
    new ParameterValidator().validateNumber(value, type),
  
  address: (value: string) => 
    new ParameterValidator().validateAddress(value),
  
  boolean: (value: string) => 
    new ParameterValidator().validateBoolean(value),
  
  vector: (value: string, elementType: string) => 
    new ParameterValidator().validateVector(value, elementType),
};