export interface MoveTomlConfig {
  package: {
    name: string;
    edition: string;
    version?: string;
    authors?: string[];
    license?: string;
  };
  dependencies?: Record<string, any>;
  'dev-dependencies'?: Record<string, any>;
  addresses?: Record<string, string>;
  'dev-addresses'?: Record<string, string>;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

// Parse TOML content (basic parser for validation)
function parseTOML(content: string): any {
  try {
    // This is a basic TOML parser for validation purposes
    // For production, consider using a library like @iarna/toml
    const lines = content.split('\n');
    const result: any = {};
    let currentSection: string | null = null;
    let currentSubsection: string | null = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Section header
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const section = trimmed.slice(1, -1);
        if (section.includes('.')) {
          const parts = section.split('.');
          currentSection = parts[0];
          currentSubsection = parts.slice(1).join('.');
          if (!result[currentSection]) result[currentSection] = {};
        } else {
          currentSection = section;
          currentSubsection = null;
          if (!result[currentSection]) result[currentSection] = {};
        }
        continue;
      }
      
      // Key-value pair
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.slice(0, equalIndex).trim();
        const value = trimmed.slice(equalIndex + 1).trim();
        
        if (currentSection) {
          if (currentSubsection) {
            if (!result[currentSection][currentSubsection]) {
              result[currentSection][currentSubsection] = {};
            }
            result[currentSection][currentSubsection][key] = parseValue(value);
          } else {
            result[currentSection][key] = parseValue(value);
          }
        }
      }
    }
    
    return result;
  } catch (error) {
    throw new Error(`Failed to parse TOML: ${error}`);
  }
}

// Parse TOML value
function parseValue(value: string): any {
  // Remove quotes for strings
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  
  // Parse arrays
  if (value.startsWith('[') && value.endsWith(']')) {
    const items = value.slice(1, -1).split(',');
    return items.map(item => parseValue(item.trim()));
  }
  
  // Parse inline tables
  if (value.startsWith('{') && value.endsWith('}')) {
    const pairs = value.slice(1, -1).split(',');
    const result: any = {};
    for (const pair of pairs) {
      const [key, val] = pair.split('=').map(s => s.trim());
      if (key && val) {
        result[key] = parseValue(val);
      }
    }
    return result;
  }
  
  // Parse booleans
  if (value === 'true') return true;
  if (value === 'false') return false;
  
  // Parse numbers
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  
  // Default to string
  return value;
}

// Validate Move.toml configuration
export function validateMoveToml(content: string): ValidationResult {
  const errors: string[] = [];
  
  try {
    // Parse TOML
    const config = parseTOML(content);
    
    // Validate [package] section
    if (!config.package) {
      errors.push('[package] section is required');
    } else {
      if (!config.package.name) {
        errors.push('[package].name is required');
      } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(config.package.name)) {
        errors.push('[package].name must be a valid Move identifier');
      }
      
      if (!config.package.edition) {
        errors.push('[package].edition is required');
      } else if (!['2024.beta', '2024.alpha', 'legacy'].includes(config.package.edition)) {
        errors.push('[package].edition must be: 2024.beta, 2024.alpha, or legacy');
      }
    }
    
    // Validate [addresses] section
    if (config.addresses) {
      for (const [key, value] of Object.entries(config.addresses)) {
        if (typeof value !== 'string') {
          errors.push(`[addresses].${key} must be a string`);
        } else if (!/^0x[0-9a-fA-F]+$/.test(value)) {
          errors.push(`[addresses].${key} must be a hex address (0x...)`)
        }
      }
    }
    
    // Validate [dependencies] section
    if (config.dependencies) {
      for (const [key, value] of Object.entries(config.dependencies)) {
        if (typeof value === 'object' && value !== null) {
          const dep = value as any;
          if (!dep.git && !dep.local) {
            errors.push(`[dependencies].${key} must have 'git' or 'local'`);
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error: any) {
    return {
      valid: false,
      errors: [`Invalid TOML syntax: ${error.message}`]
    };
  }
}

// Generate default Move.toml content
export function generateDefaultMoveToml(projectName: string = 'my_project'): string {
  const safeName = projectName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_');
  
  return `[package]
name = "${safeName}"
edition = "2024.beta"

[dependencies]
Iota = { git = "https://github.com/iotaledger/iota.git", subdir = "crates/iota-framework/packages/iota-framework", rev = "framework/testnet" }

[addresses]
${safeName} = "0x0"
iota = "0000000000000000000000000000000000000000000000000000000000000002"

[dev-dependencies]
# Add test-only dependencies here

[dev-addresses]
# Override addresses for test/dev modes
`;
}

// Format error messages for display
export function formatValidationErrors(errors: string[]): string {
  return errors.map((error, index) => `${index + 1}. ${error}`).join('\n');
}