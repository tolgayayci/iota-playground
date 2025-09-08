/**
 * Move type validation utilities for parameter input
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Validate a value against a Move type
 */
export function validateMoveType(value: string, type: string): ValidationResult {
  const normalizedType = type.toLowerCase().replace(/\s+/g, '');
  
  // Handle empty values
  if (!value) {
    return { isValid: false, error: 'Value is required' };
  }

  // Vector types
  if (normalizedType.includes('vector<')) {
    return validateVector(value, normalizedType);
  }

  // Object types
  if (normalizedType.includes('object<') || normalizedType.includes('id<')) {
    return validateObjectId(value);
  }

  // Basic types
  const baseType = normalizedType.replace(/&|mut/g, '').trim();
  
  switch (baseType) {
    case 'u8':
      return validateUnsignedInt(value, 0n, 255n);
    case 'u16':
      return validateUnsignedInt(value, 0n, 65535n);
    case 'u32':
      return validateUnsignedInt(value, 0n, 4294967295n);
    case 'u64':
      return validateUnsignedInt(value, 0n, 18446744073709551615n);
    case 'u128':
      return validateUnsignedInt(value, 0n, 340282366920938463463374607431768211455n);
    case 'u256':
      return validateUnsignedInt(value, 0n, 115792089237316195423570985008687907853269984665640564039457584007913129639935n);
    case 'bool':
      return validateBoolean(value);
    case 'address':
      return validateAddress(value);
    case 'string':
    case 'string::string':
    case '0x1::string::string':
      return validateString(value);
    default:
      // For complex or unknown types, assume valid if not empty
      return { isValid: true };
  }
}

/**
 * Validate unsigned integer types
 */
function validateUnsignedInt(value: string, min: bigint, max: bigint): ValidationResult {
  try {
    const num = BigInt(value);
    
    if (num < min) {
      return { 
        isValid: false, 
        error: `Value must be at least ${min}`,
        suggestion: `Use a value between ${min} and ${max}`
      };
    }
    
    if (num > max) {
      return { 
        isValid: false, 
        error: `Value exceeds maximum of ${max}`,
        suggestion: `Use a value between ${min} and ${max}`
      };
    }
    
    return { isValid: true };
  } catch {
    return { 
      isValid: false, 
      error: 'Invalid number format',
      suggestion: 'Enter a valid integer'
    };
  }
}

/**
 * Validate boolean values
 */
function validateBoolean(value: string): ValidationResult {
  if (value !== 'true' && value !== 'false') {
    return { 
      isValid: false, 
      error: 'Value must be "true" or "false"',
      suggestion: 'Enter: true or false'
    };
  }
  return { isValid: true };
}

/**
 * Validate IOTA address
 */
function validateAddress(value: string): ValidationResult {
  const addressPattern = /^0x[a-fA-F0-9]{64}$/;
  
  if (!addressPattern.test(value)) {
    return { 
      isValid: false, 
      error: 'Invalid address format',
      suggestion: 'Address must be 66 characters starting with 0x followed by 64 hex characters'
    };
  }
  
  return { isValid: true };
}

/**
 * Validate object ID
 */
function validateObjectId(value: string): ValidationResult {
  const objectIdPattern = /^0x[a-fA-F0-9]{64}$/;
  
  if (!objectIdPattern.test(value)) {
    return { 
      isValid: false, 
      error: 'Invalid object ID format',
      suggestion: 'Object ID must be 66 characters starting with 0x followed by 64 hex characters'
    };
  }
  
  return { isValid: true };
}

/**
 * Validate string values
 */
function validateString(value: string): ValidationResult {
  // Strings are generally valid, but check for JSON compatibility
  try {
    // Test if it needs escaping
    if (value.includes('"') || value.includes('\\') || value.includes('\n')) {
      JSON.parse(`"${value.replace(/"/g, '\\"').replace(/\\/g, '\\\\').replace(/\n/g, '\\n')}"`);
    }
    return { isValid: true };
  } catch {
    return { 
      isValid: false, 
      error: 'Invalid string format',
      suggestion: 'Escape special characters with backslash'
    };
  }
}

/**
 * Validate vector types
 */
function validateVector(value: string, type: string): ValidationResult {
  try {
    const parsed = JSON.parse(value);
    
    if (!Array.isArray(parsed)) {
      return { 
        isValid: false, 
        error: 'Value must be a JSON array',
        suggestion: 'Example: [1, 2, 3] or ["item1", "item2"]'
      };
    }
    
    // Extract inner type
    const innerTypeMatch = type.match(/vector<(.+)>/);
    if (innerTypeMatch) {
      const innerType = innerTypeMatch[1];
      
      // Validate each element
      for (let i = 0; i < parsed.length; i++) {
        const elementValue = typeof parsed[i] === 'string' ? parsed[i] : String(parsed[i]);
        const result = validateMoveType(elementValue, innerType);
        
        if (!result.isValid) {
          return {
            isValid: false,
            error: `Invalid element at index ${i}: ${result.error}`,
            suggestion: result.suggestion
          };
        }
      }
    }
    
    return { isValid: true };
  } catch {
    return { 
      isValid: false, 
      error: 'Invalid JSON array format',
      suggestion: 'Enter a valid JSON array, e.g., [1, 2, 3]'
    };
  }
}

/**
 * Suggest a valid value for a given Move type
 */
export function suggestValidValue(type: string): string {
  const normalizedType = type.toLowerCase().replace(/\s+/g, '');
  
  // Vector types
  if (normalizedType.includes('vector<')) {
    const innerTypeMatch = normalizedType.match(/vector<(.+)>/);
    if (innerTypeMatch) {
      const innerType = innerTypeMatch[1];
      const innerSuggestion = suggestValidValue(innerType);
      return `[${innerSuggestion}]`;
    }
    return '[]';
  }
  
  // Object types
  if (normalizedType.includes('object<') || normalizedType.includes('id<')) {
    return '0x0000000000000000000000000000000000000000000000000000000000000001';
  }
  
  // Basic types
  const baseType = normalizedType.replace(/&|mut/g, '').trim();
  
  switch (baseType) {
    case 'u8':
      return '100';
    case 'u16':
      return '1000';
    case 'u32':
      return '100000';
    case 'u64':
      return '1000000000'; // 1 IOTA in smallest units
    case 'u128':
      return '1000000000000';
    case 'u256':
      return '1000000000000000';
    case 'bool':
      return 'true';
    case 'address':
      return '0x0000000000000000000000000000000000000000000000000000000000000001';
    case 'string':
    case 'string::string':
    case '0x1::string::string':
      return 'Hello, IOTA!';
    default:
      return '';
  }
}

/**
 * Format a Move type for display
 */
export function formatMoveType(type: string): string {
  // Remove module prefixes for common types
  let formatted = type
    .replace(/0x[a-fA-F0-9]+::/g, '')
    .replace(/std::/g, '')
    .replace(/iota::/g, '');
  
  // Simplify common type patterns
  formatted = formatted
    .replace(/string::String/gi, 'String')
    .replace(/option::Option/gi, 'Option')
    .replace(/vector::Vector/gi, 'Vector');
  
  return formatted;
}