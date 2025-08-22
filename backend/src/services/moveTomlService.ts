import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import toml from '@iarna/toml';

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

// Ensure project directory exists
async function ensureProjectDirectory(userId: string, projectId: string): Promise<string> {
  const projectPath = path.join(__dirname, '..', '..', 'projects', userId, projectId);
  
  if (!fs.existsSync(projectPath)) {
    throw new AppError('Project directory not found. Please compile the project first.', 404, 'PROJECT_NOT_FOUND');
  }
  
  return projectPath;
}

// Get default Move.toml configuration
function getDefaultMoveToml(projectName: string = 'user_project'): MoveTomlConfig {
  return {
    package: {
      name: projectName,
      edition: '2024.beta',
    },
    dependencies: {
      Iota: {
        git: 'https://github.com/iotaledger/iota.git',
        subdir: 'crates/iota-framework/packages/iota-framework',
        rev: 'framework/testnet'
      }
    },
    addresses: {
      [projectName]: '0x0',
      iota: '0000000000000000000000000000000000000000000000000000000000000002'
    }
  };
}

// Read Move.toml from project directory
export async function readMoveToml(userId: string, projectId: string): Promise<string> {
  try {
    const projectPath = await ensureProjectDirectory(userId, projectId);
    const moveTomlPath = path.join(projectPath, 'Move.toml');
    
    // Check if Move.toml exists
    if (!fs.existsSync(moveTomlPath)) {
      // Create default Move.toml if it doesn't exist
      const defaultConfig = getDefaultMoveToml();
      const tomlContent = toml.stringify(defaultConfig as any);
      await writeFile(moveTomlPath, tomlContent);
      logger.info(`Created default Move.toml for project ${projectId}`);
      return tomlContent;
    }
    
    // Read existing Move.toml
    const content = await readFile(moveTomlPath, 'utf-8');
    logger.info(`Read Move.toml for project ${projectId}`);
    return content;
  } catch (error: any) {
    logger.error('Failed to read Move.toml:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to read Move.toml configuration', 500, 'READ_ERROR');
  }
}

// Validate Move.toml configuration
export function validateMoveToml(content: string): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  try {
    // Parse TOML
    const config = toml.parse(content) as any;
    
    // Validate [package] section
    if (!config.package) {
      errors.push('[package] section is required');
    } else {
      if (!config.package.name) {
        errors.push('[package].name is required');
      } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(config.package.name)) {
        errors.push('[package].name must be a valid Move identifier (alphanumeric and underscores, starting with a letter)');
      }
      
      if (!config.package.edition) {
        errors.push('[package].edition is required');
      } else if (!['2024.beta', '2024.alpha', 'legacy'].includes(config.package.edition)) {
        errors.push('[package].edition must be one of: 2024.beta, 2024.alpha, legacy');
      }
    }
    
    // Validate [addresses] section
    if (config.addresses) {
      for (const [key, value] of Object.entries(config.addresses)) {
        if (typeof value !== 'string') {
          errors.push(`[addresses].${key} must be a string`);
        } else if (!/^0x[0-9a-fA-F]+$/.test(value)) {
          errors.push(`[addresses].${key} must be a valid hex address (starting with 0x)`);
        }
      }
    }
    
    // Validate [dependencies] section
    if (config.dependencies) {
      for (const [key, value] of Object.entries(config.dependencies)) {
        if (typeof value === 'object' && value !== null) {
          const dep = value as any;
          if (dep.git && typeof dep.git !== 'string') {
            errors.push(`[dependencies].${key}.git must be a string URL`);
          }
          if (dep.local && typeof dep.local !== 'string') {
            errors.push(`[dependencies].${key}.local must be a string path`);
          }
          if (!dep.git && !dep.local) {
            errors.push(`[dependencies].${key} must have either 'git' or 'local' field`);
          }
        } else if (typeof value !== 'string') {
          errors.push(`[dependencies].${key} must be an object or string`);
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

// Update Move.toml in project directory
export async function updateMoveToml(userId: string, projectId: string, content: string): Promise<void> {
  try {
    // Validate the content first
    const validation = validateMoveToml(content);
    if (!validation.valid) {
      throw new AppError(
        `Invalid Move.toml configuration: ${validation.errors?.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }
    
    const projectPath = await ensureProjectDirectory(userId, projectId);
    const moveTomlPath = path.join(projectPath, 'Move.toml');
    
    // Create backup of existing Move.toml
    if (fs.existsSync(moveTomlPath)) {
      const backupPath = path.join(projectPath, 'Move.toml.backup');
      const existingContent = await readFile(moveTomlPath, 'utf-8');
      await writeFile(backupPath, existingContent);
      logger.info(`Created backup of Move.toml for project ${projectId}`);
    }
    
    // Write new Move.toml
    await writeFile(moveTomlPath, content);
    logger.info(`Updated Move.toml for project ${projectId}`);
    
    // Remove Move.lock to ensure fresh dependency resolution
    const moveLockPath = path.join(projectPath, 'Move.lock');
    if (fs.existsSync(moveLockPath)) {
      await fs.promises.unlink(moveLockPath);
      logger.info(`Removed Move.lock for project ${projectId} to refresh dependencies`);
    }
  } catch (error: any) {
    logger.error('Failed to update Move.toml:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to update Move.toml configuration', 500, 'UPDATE_ERROR');
  }
}

// Parse Move.toml to extract structured data
export async function parseMoveToml(userId: string, projectId: string): Promise<MoveTomlConfig> {
  try {
    const content = await readMoveToml(userId, projectId);
    const config = toml.parse(content) as any;
    return config as MoveTomlConfig;
  } catch (error: any) {
    logger.error('Failed to parse Move.toml:', error);
    throw new AppError('Failed to parse Move.toml configuration', 500, 'PARSE_ERROR');
  }
}