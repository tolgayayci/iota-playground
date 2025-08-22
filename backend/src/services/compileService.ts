import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, writeFile, rm, copyFile, readdir, stat } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import { getMoveConfig } from '../config/iota';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

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
  bytecode?: string;
  abi?: any;
  modules?: string[];
  dependencies?: string[];
  code_snapshot: string;
}

// Copy directory recursively
async function copyDir(src: string, dest: string) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

// Ensure project exists for user
async function ensureProjectDirectory(userId: string, projectId: string): Promise<string> {
  const projectPath = path.join(__dirname, '..', '..', 'projects', userId, projectId);
  
  // Check if project already exists
  if (fs.existsSync(projectPath)) {
    logger.info(`Using existing project at: ${projectPath}`);
    return projectPath;
  }

  // Create user directory if needed
  const userDir = path.join(__dirname, '..', '..', 'projects', userId);
  await mkdir(userDir, { recursive: true });

  // Copy base project template
  const baseProjectPath = path.join(__dirname, '..', '..', 'base_project');
  await copyDir(baseProjectPath, projectPath);
  
  logger.info(`Created new project at: ${projectPath}`);
  return projectPath;
}

export async function compileMove(
  code: string,
  projectId: string,
  userId: string
): Promise<CompilationResult> {
  const startTime = Date.now();
  
  try {
    // Ensure project directory exists
    const projectPath = await ensureProjectDirectory(userId, projectId);
    
    // Write the Move source code
    const sourcePath = path.join(projectPath, 'sources', 'module.move');
    await writeFile(sourcePath, code);
    
    logger.info(`Compiling Move project at: ${projectPath}`);
    
    // Run Move compiler
    const config = getMoveConfig();
    const compileCommand = `${config.compilerPath} move build --path ${projectPath}`;
    
    const { stdout, stderr } = await execAsync(compileCommand, {
      timeout: config.timeout,
      env: {
        ...process.env,
        RUST_BACKTRACE: '1'
      }
    });
    
    // If compilation successful, try to get digest using --dump-bytecode-as-base64
    let digestOutput = '';
    if (!stderr.includes('error') && !stderr.includes('Error') && !stdout.includes('Failed')) {
      try {
        const digestCommand = `printf "testnet\\n0\\n" | ${config.compilerPath} move build --dump-bytecode-as-base64 --path ${projectPath} 2>/dev/null`;
        const { stdout: digestStdout } = await execAsync(digestCommand, {
          timeout: config.timeout,
          env: { ...process.env }
        });
        digestOutput = digestStdout;
      } catch (digestError) {
        logger.warn('Failed to get digest:', digestError);
      }
    }
    
    const compilationTime = Date.now() - startTime;
    
    // Check if compilation was successful
    const success = !stderr.includes('error') && !stderr.includes('Error') && !stdout.includes('Failed');
    
    // Try to extract bytecode, modules, and digest if compilation was successful
    let bytecode: string | undefined;
    let abi: any | undefined;
    let modules: string[] = [];
    let dependencies: string[] = [];
    let digest: string | undefined;
    let disassemblyOutput: string = '';
    
    if (success) {
      try {
        // First, try to parse JSON output from digest command
        if (digestOutput) {
          try {
            const jsonOutput = digestOutput.split('\n').find(line => line.trim().startsWith('{'));
            if (jsonOutput) {
              const parsed = JSON.parse(jsonOutput.trim());
              if (parsed.modules) {
                modules = parsed.modules;
                logger.info(`Extracted ${modules.length} modules from digest JSON output`);
              }
              if (parsed.dependencies) {
                dependencies = parsed.dependencies;
              }
              if (parsed.digest && Array.isArray(parsed.digest)) {
                // Convert digest array to hex string
                digest = Buffer.from(parsed.digest).toString('hex');
                logger.info(`Extracted digest: ${digest}`);
              }
            }
          } catch (jsonError) {
            logger.warn('Failed to parse JSON output from digest command:', jsonError);
          }
        }

        // Fallback: Read the compiled bytecode from build directory
        const buildPath = path.join(projectPath, 'build', 'user_project');
        const { stdout: bytecodeOutput } = await execAsync(`find ${buildPath} -name "*.mv" -type f 2>/dev/null || true`);
        
        if (bytecodeOutput.trim()) {
          const bytecodePath = bytecodeOutput.trim().split('\n')[0];
          const { stdout: hexOutput } = await execAsync(`xxd -p -c 256 ${bytecodePath}`);
          bytecode = hexOutput.trim();
        }
        
        // If we didn't get modules from JSON, extract from bytecode_modules directory
        if (modules.length === 0) {
          const bytecodeModulesPath = path.join(buildPath, 'bytecode_modules');
          if (fs.existsSync(bytecodeModulesPath)) {
            const moduleFiles = await readdir(bytecodeModulesPath);
            for (const file of moduleFiles) {
              if (file.endsWith('.mv')) {
                const moduleFilePath = path.join(bytecodeModulesPath, file);
                const moduleContent = await fs.promises.readFile(moduleFilePath);
                modules.push(moduleContent.toString('base64'));
              }
            }
            logger.info(`Extracted ${modules.length} modules from filesystem`);
          }
        }
        
        // Set default IOTA dependencies if not provided
        if (dependencies.length === 0) {
          dependencies = ['0x1', '0x2']; // IOTA framework dependencies
        }
        
        // Try to extract ABI and disassembly for each module
        const { stdout: moduleFiles } = await execAsync(`find ${buildPath} -name "*.mv" -type f 2>/dev/null || true`);
        
        if (moduleFiles.trim()) {
          const moduleFilePaths = moduleFiles.trim().split('\n');
          const disassemblyResults = [];
          
          for (const moduleFilePath of moduleFilePaths) {
            try {
              const { stdout: moduleDisassembly } = await execAsync(
                `${config.compilerPath} move disassemble --path ${projectPath} ${moduleFilePath} 2>/dev/null || true`
              );
              if (moduleDisassembly.trim()) {
                disassemblyResults.push(moduleDisassembly);
              }
            } catch (disasmError) {
              logger.warn(`Failed to disassemble module ${moduleFilePath}:`, disasmError);
            }
          }
          
          disassemblyOutput = disassemblyResults.join('\n\n---\n\n');
        }
        
        // Parse ABI directly from Move source code (more reliable than disassembly)
        try {
          abi = parseABIFromMoveCode(code);
          logger.info(`Generated ABI: ${abi.functions.length} functions, ${abi.structs.length} structs`);
        } catch (abiError) {
          logger.warn('Failed to parse ABI from Move code:', abiError);
          // Fallback to disassembly parsing if available
          if (disassemblyOutput) {
            try {
              abi = parseABIFromMoveCode(disassemblyOutput);
            } catch (fallbackError) {
              logger.warn('Fallback ABI parsing also failed:', fallbackError);
            }
          }
        }
      } catch (error) {
        logger.warn('Failed to extract bytecode/ABI:', error);
      }
    }
    
    // Save compilation result metadata
    const metadataPath = path.join(projectPath, 'last_compilation.json');
    await writeFile(metadataPath, JSON.stringify({
      success,
      timestamp: new Date().toISOString(),
      compilation_time: compilationTime,
      code_snapshot: code
    }, null, 2));
    
    return {
      success,
      exit_code: success ? 0 : 1,
      stdout: stdout || '',
      stderr: stderr || '',
      details: {
        status: success ? 'success' : 'failed',
        compilation_time: compilationTime,
        project_path: projectPath
      },
      bytecode,
      abi,
      modules,
      dependencies,
      digest,
      disassembly: disassemblyOutput || undefined,
      code_snapshot: code
    };
  } catch (error: any) {
    const compilationTime = Date.now() - startTime;
    
    if (error.code === 'ETIMEDOUT') {
      throw new AppError('Compilation timeout exceeded', 408, 'COMPILATION_TIMEOUT');
    }
    
    logger.error('Compilation error:', error);
    
    return {
      success: false,
      exit_code: error.code || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      details: {
        status: 'error',
        compilation_time: compilationTime,
        project_path: ''
      },
      code_snapshot: code
    };
  }
}

function parseABIFromMoveCode(code: string): any {
  // Enhanced ABI extraction from Move source code
  const abi = {
    modules: [],
    functions: [],
    structs: []
  };
  
  const lines = code.split('\n');
  let currentModule = null;
  let inFunction = false;
  let functionBuffer = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Extract module name
    if (line.startsWith('module ')) {
      const match = line.match(/module\s+[\w:]+::(\w+)/);
      if (match) {
        currentModule = match[1];
        abi.modules.push(currentModule);
      }
    }
    
    // Extract public functions with full signatures
    if (line.includes('public') && (line.includes('fun ') || line.includes('entry fun'))) {
      inFunction = true;
      functionBuffer = line;
      
      // Check if function signature continues on next lines
      let j = i + 1;
      while (j < lines.length && !functionBuffer.includes('{') && !functionBuffer.includes(';')) {
        functionBuffer += ' ' + lines[j].trim();
        j++;
      }
      
      // Parse the complete function signature
      const funcMatch = functionBuffer.match(/public\s+(entry\s+)?fun\s+(\w+)\s*\((.*?)\)(?:\s*:\s*([^{;]+))?/);
      if (funcMatch) {
        const [, isEntry, funcName, params, returnType] = funcMatch;
        
        // Parse parameters
        const parameters = [];
        if (params.trim()) {
          const paramParts = params.split(',').map(p => p.trim());
          for (const param of paramParts) {
            const paramMatch = param.match(/(\w+)\s*:\s*([^,]+)/);
            if (paramMatch) {
              parameters.push({
                name: paramMatch[1],
                type: paramMatch[2].trim()
              });
            }
          }
        }
        
        abi.functions.push({
          module: currentModule,
          name: funcName,
          visibility: 'public',
          is_entry: Boolean(isEntry),
          parameters,
          return_type: returnType ? returnType.trim() : 'void',
          type: isEntry ? 'entry' : 'view'
        });
      }
      inFunction = false;
    }
    
    // Extract structs
    if (line.startsWith('struct ') || line.includes(' struct ')) {
      const structMatch = line.match(/struct\s+(\w+)/);
      if (structMatch) {
        abi.structs.push({
          module: currentModule,
          name: structMatch[1]
        });
      }
    }
  }
  
  return abi;
}

// Get bytecode for deployment
export async function getBytecodeForDeployment(userId: string, projectId: string) {
  const projectPath = path.join(__dirname, '..', '..', 'projects', userId, projectId);
  const buildPath = path.join(projectPath, 'build', 'user_project');
  const metadataPath = path.join(projectPath, 'last_compilation.json');
  
  try {
    // Check if project has been compiled
    if (!fs.existsSync(buildPath) || !fs.existsSync(metadataPath)) {
      throw new Error('Project not compiled. Please compile the project first.');
    }

    // Read the last compilation metadata
    const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    
    if (!metadata.success) {
      throw new Error('Last compilation failed. Please fix errors and recompile.');
    }

    // Read bytecode modules from filesystem
    const modules: string[] = [];
    const dependencies: string[] = ['0x1', '0x2']; // Default IOTA framework dependencies
    let digest = '';

    const bytecodesPath = path.join(buildPath, 'bytecode_modules');
    if (fs.existsSync(bytecodesPath)) {
      const moduleFiles = await readdir(bytecodesPath);
      for (const file of moduleFiles) {
        if (file.endsWith('.mv')) {
          const moduleFilePath = path.join(bytecodesPath, file);
          const bytecode = await fs.promises.readFile(moduleFilePath);
          modules.push(bytecode.toString('base64'));
          logger.info(`Read bytecode module: ${file} (${bytecode.length} bytes)`);
        }
      }
    }

    if (modules.length === 0) {
      throw new Error('No compiled bytecode modules found. Please compile the project first.');
    }

    // Try to get digest from a quick compilation check without recompiling
    try {
      const config = getMoveConfig();
      // Use printf to bypass network prompts and get digest only
      const digestCommand = `printf "testnet\\n0\\n" | ${config.compilerPath} move build --dump-bytecode-as-base64 --path ${projectPath} 2>/dev/null || true`;
      const { stdout } = await execAsync(digestCommand, {
        timeout: 10000, // Short timeout for quick check
        env: { ...process.env }
      });

      // Parse digest from JSON output
      if (stdout) {
        const jsonLine = stdout.split('\n').find(line => line.trim().startsWith('{'));
        if (jsonLine) {
          const parsed = JSON.parse(jsonLine.trim());
          if (parsed.digest && Array.isArray(parsed.digest)) {
            digest = Buffer.from(parsed.digest).toString('hex');
            logger.info(`Retrieved digest: ${digest}`);
          }
        }
      }
    } catch (digestError) {
      logger.warn('Failed to retrieve digest, using empty digest:', digestError);
      // Continue without digest - will be calculated on client if needed
    }

    logger.info(`Returning ${modules.length} modules for deployment`);
    
    return {
      modules,
      dependencies,
      digest,
    };
  } catch (error: any) {
    logger.error('Failed to get bytecode:', error);
    throw new AppError(
      error.message || 'Failed to get bytecode for deployment',
      500
    );
  }
}