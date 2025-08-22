// Browser-compatible utilities for bytecode inspection

export interface BytecodeModule {
  name: string;
  bytecode: string; // base64 encoded
  size: number;
  hex: string;
}

export interface BytecodeDigest {
  digest: string;
  algorithm: string;
  modules: number;
  dependencies: string[];
}

export interface BytecodeAnalysis {
  totalSize: number;
  moduleCount: number;
  estimatedGas: number;
  complexityScore: number;
}

export interface DisassemblyInfo {
  moduleHandles: any[];
  structHandles: any[];
  functionHandles: any[];
  signatures: any[];
  identifiers: string[];
  fieldHandles: any[];
}

/**
 * Parse base64 bytecode modules into structured format
 */
export function parseBytecodeModules(modules: string[]): BytecodeModule[] {
  return modules.map((module, index) => {
    const bytecode = module;
    // Convert base64 to bytes using browser APIs
    const binaryString = atob(module);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    
    return {
      name: `Module_${index}`,
      bytecode,
      size: bytes.length,
      hex: formatHexWithOffsets(hex)
    };
  });
}

/**
 * Format hex string with offset addresses for display
 */
export function formatHexWithOffsets(hex: string): string {
  const lines: string[] = [];
  const bytesPerLine = 16;
  
  for (let i = 0; i < hex.length; i += bytesPerLine * 2) {
    const offset = (i / 2).toString(16).padStart(8, '0').toUpperCase();
    const hexBytes = hex.substr(i, bytesPerLine * 2);
    
    // Format hex bytes with spaces
    const formattedHex = hexBytes.match(/.{1,2}/g)?.join(' ') || '';
    const paddedHex = formattedHex.padEnd(bytesPerLine * 3 - 1, ' ');
    
    // Create ASCII representation
    const ascii = hexBytes.match(/.{1,2}/g)
      ?.map(byte => {
        const char = String.fromCharCode(parseInt(byte, 16));
        return /[^\x20-\x7E]/.test(char) ? '.' : char;
      })
      .join('') || '';
    
    lines.push(`${offset}  ${paddedHex}  |${ascii.padEnd(bytesPerLine, ' ')}|`);
  }
  
  return lines.join('\n');
}

/**
 * Create BytecodeDigest from backend-provided digest
 * The actual digest calculation is done by the IOTA Move toolchain on the backend
 */
export function createBytecodeDigest(
  digest: string,
  modules: string[], 
  dependencies: string[] = ['0x1', '0x2']
): BytecodeDigest {
  return {
    digest,
    algorithm: 'Blake2B-256',
    modules: modules.length,
    dependencies
  };
}

/**
 * Analyze bytecode for complexity and gas estimation
 */
export function analyzeBytecode(modules: BytecodeModule[]): BytecodeAnalysis {
  const totalSize = modules.reduce((acc, mod) => acc + mod.size, 0);
  const moduleCount = modules.length;
  
  // Rough gas estimation based on bytecode size and complexity
  // IOTA Move charges for storage and computation
  const storageGas = totalSize * 100; // ~100 gas units per byte for storage
  const computationGas = moduleCount * 10000; // Base computation cost per module
  const estimatedGas = storageGas + computationGas;
  
  // Complexity score based on size and module count
  const complexityScore = Math.min(100, (totalSize / 1000) * 20 + (moduleCount * 10));
  
  return {
    totalSize,
    moduleCount,
    estimatedGas,
    complexityScore: Math.round(complexityScore)
  };
}

/**
 * Parse Move disassembly output to extract structured information
 */
export function parseDisassembly(disassemblyOutput: string): DisassemblyInfo {
  const info: DisassemblyInfo = {
    moduleHandles: [],
    structHandles: [],
    functionHandles: [],
    signatures: [],
    identifiers: [],
    fieldHandles: []
  };
  
  const lines = disassemblyOutput.split('\n');
  let currentSection = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('module handles:')) {
      currentSection = 'moduleHandles';
      continue;
    } else if (trimmed.startsWith('struct handles:')) {
      currentSection = 'structHandles';
      continue;
    } else if (trimmed.startsWith('function handles:')) {
      currentSection = 'functionHandles';
      continue;
    } else if (trimmed.startsWith('signatures:')) {
      currentSection = 'signatures';
      continue;
    } else if (trimmed.startsWith('identifiers:')) {
      currentSection = 'identifiers';
      continue;
    } else if (trimmed.startsWith('field handles:')) {
      currentSection = 'fieldHandles';
      continue;
    }
    
    // Parse content for each section
    if (trimmed && !trimmed.startsWith('//') && currentSection) {
      switch (currentSection) {
        case 'identifiers':
          const identifierMatch = trimmed.match(/\d+:\s*"([^"]+)"/);
          if (identifierMatch) {
            info.identifiers.push(identifierMatch[1]);
          }
          break;
        case 'moduleHandles':
        case 'structHandles':
        case 'functionHandles':
        case 'signatures':
        case 'fieldHandles':
          // For now, store raw lines - can be parsed more specifically later
          if (trimmed.match(/^\d+:/)) {
            (info as any)[currentSection].push(trimmed);
          }
          break;
      }
    }
  }
  
  return info;
}

/**
 * Validate bytecode for common issues
 */
export function validateBytecode(modules: BytecodeModule[]): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check if any modules exist
  if (modules.length === 0) {
    errors.push('No bytecode modules found');
    return { isValid: false, warnings, errors };
  }
  
  // Check module sizes
  modules.forEach((module, index) => {
    if (module.size > 100000) { // 100KB limit warning
      warnings.push(`Module ${index} is large (${module.size} bytes) - may increase gas costs`);
    }
    
    if (module.size === 0) {
      errors.push(`Module ${index} is empty`);
    }
  });
  
  // Check total package size
  const totalSize = modules.reduce((acc, mod) => acc + mod.size, 0);
  if (totalSize > 1000000) { // 1MB limit
    warnings.push(`Total package size is very large (${totalSize} bytes)`);
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Convert gas units to IOTA
 */
export function formatGasToIota(gasUnits: number): string {
  return (gasUnits / 1000000000).toFixed(4); // Convert nanoIOTA to IOTA
}