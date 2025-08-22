import { Transaction } from '@iota/iota-sdk/transactions';
import { IotaClient } from '@iota/iota-sdk/client';

// PTB Command Types
export type PTBCommandType = 
  | 'MoveCall'
  | 'TransferObjects'
  | 'SplitCoins'
  | 'MergeCoins'
  | 'MakeMoveVec'
  | 'Publish';

export interface PTBArgument {
  type: 'input' | 'result' | 'gas' | 'object';
  value: string | number;
  resultFrom?: number; // Index of command that produced this result
}

export interface PTBMoveCallCommand {
  id: string;
  type: 'MoveCall';
  target: string; // package::module::function
  arguments: PTBArgument[];
  typeArguments?: string[];
}

export interface PTBTransferObjectsCommand {
  id: string;
  type: 'TransferObjects';
  objects: PTBArgument[];
  recipient: PTBArgument;
}

export interface PTBSplitCoinsCommand {
  id: string;
  type: 'SplitCoins';
  coin: PTBArgument;
  amounts: PTBArgument[];
}

export interface PTBMergeCoinsCommand {
  id: string;
  type: 'MergeCoins';
  destination: PTBArgument;
  sources: PTBArgument[];
}

export interface PTBMakeMoveVecCommand {
  id: string;
  type: 'MakeMoveVec';
  type_: string;
  objects: PTBArgument[];
}

export interface PTBPublishCommand {
  id: string;
  type: 'Publish';
  modules: string[]; // Base64 encoded modules
  dependencies: string[];
}

export type PTBCommand = 
  | PTBMoveCallCommand
  | PTBTransferObjectsCommand
  | PTBSplitCoinsCommand
  | PTBMergeCoinsCommand
  | PTBMakeMoveVecCommand
  | PTBPublishCommand;

export interface PTBTemplate {
  id: string;
  name: string;
  description: string;
  commands: PTBCommand[];
  created_at: string;
  project_id?: string;
}

export class PTBBuilder {
  private commands: PTBCommand[] = [];
  private nextId = 1;

  constructor(template?: PTBTemplate) {
    if (template) {
      this.commands = [...template.commands];
      this.nextId = this.commands.length + 1;
    }
  }

  // Add commands
  addMoveCall(target: string, args: PTBArgument[] = [], typeArgs: string[] = []): PTBMoveCallCommand {
    const command: PTBMoveCallCommand = {
      id: `cmd-${this.nextId++}`,
      type: 'MoveCall',
      target,
      arguments: args,
      typeArguments: typeArgs.length > 0 ? typeArgs : undefined,
    };
    this.commands.push(command);
    return command;
  }

  addTransferObjects(objects: PTBArgument[], recipient: PTBArgument): PTBTransferObjectsCommand {
    const command: PTBTransferObjectsCommand = {
      id: `cmd-${this.nextId++}`,
      type: 'TransferObjects',
      objects,
      recipient,
    };
    this.commands.push(command);
    return command;
  }

  addSplitCoins(coin: PTBArgument, amounts: PTBArgument[]): PTBSplitCoinsCommand {
    const command: PTBSplitCoinsCommand = {
      id: `cmd-${this.nextId++}`,
      type: 'SplitCoins',
      coin,
      amounts,
    };
    this.commands.push(command);
    return command;
  }

  addMergeCoins(destination: PTBArgument, sources: PTBArgument[]): PTBMergeCoinsCommand {
    const command: PTBMergeCoinsCommand = {
      id: `cmd-${this.nextId++}`,
      type: 'MergeCoins',
      destination,
      sources,
    };
    this.commands.push(command);
    return command;
  }

  // Command management
  removeCommand(id: string): void {
    this.commands = this.commands.filter(cmd => cmd.id !== id);
  }

  moveCommand(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.commands.length || 
        toIndex < 0 || toIndex >= this.commands.length) {
      return;
    }
    const [moved] = this.commands.splice(fromIndex, 1);
    this.commands.splice(toIndex, 0, moved);
  }

  updateCommand(id: string, updates: Partial<PTBCommand>): void {
    const index = this.commands.findIndex(cmd => cmd.id === id);
    if (index >= 0) {
      this.commands[index] = { ...this.commands[index], ...updates };
    }
  }

  // Getters
  getCommands(): PTBCommand[] {
    return [...this.commands];
  }

  getCommand(id: string): PTBCommand | undefined {
    return this.commands.find(cmd => cmd.id === id);
  }

  getCommandIndex(id: string): number {
    return this.commands.findIndex(cmd => cmd.id === id);
  }

  // Enhanced Validation
  validate(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < this.commands.length; i++) {
      const command = this.commands[i];
      
      // Validate command-specific requirements
      switch (command.type) {
        case 'MoveCall':
          if (!command.target || !command.target.includes('::')) {
            errors.push(`Command ${i + 1} (${command.type}): Invalid target format. Expected 'package::module::function'`);
          } else {
            const parts = command.target.split('::');
            if (parts.length !== 3) {
              errors.push(`Command ${i + 1} (${command.type}): Target must have exactly 3 parts: package::module::function`);
            } else if (parts.some(part => part.trim() === '')) {
              errors.push(`Command ${i + 1} (${command.type}): Target parts cannot be empty`);
            }
          }
          
          // Validate arguments
          if (command.arguments.length === 0) {
            warnings.push(`Command ${i + 1} (${command.type}): No arguments provided. Ensure this function doesn't require parameters.`);
          }
          break;
          
        case 'TransferObjects':
          if (command.objects.length === 0) {
            errors.push(`Command ${i + 1} (${command.type}): Must specify at least one object to transfer`);
          }
          
          if (!command.recipient.value || command.recipient.value === '') {
            errors.push(`Command ${i + 1} (${command.type}): Recipient address is required`);
          } else if (typeof command.recipient.value === 'string' && 
                     command.recipient.type === 'input' && 
                     !command.recipient.value.startsWith('0x')) {
            warnings.push(`Command ${i + 1} (${command.type}): Recipient address should start with '0x'`);
          }
          break;
          
        case 'SplitCoins':
          if (command.amounts.length === 0) {
            errors.push(`Command ${i + 1} (${command.type}): Must specify at least one split amount`);
          } else {
            // Validate amounts are positive
            command.amounts.forEach((amt, idx) => {
              if (amt.type === 'input' && typeof amt.value === 'number' && amt.value <= 0) {
                errors.push(`Command ${i + 1} (${command.type}): Split amount ${idx + 1} must be greater than 0`);
              }
            });
          }
          break;
          
        case 'MergeCoins':
          if (command.sources.length === 0) {
            errors.push(`Command ${i + 1} (${command.type}): Must specify at least one source coin to merge`);
          }
          break;
          
        case 'MakeMoveVec':
          if (command.objects.length === 0) {
            warnings.push(`Command ${i + 1} (${command.type}): Creating empty vector`);
          }
          if (!command.type_ || command.type_.trim() === '') {
            errors.push(`Command ${i + 1} (${command.type}): Vector type is required`);
          }
          break;
          
        case 'Publish':
          if (command.modules.length === 0) {
            errors.push(`Command ${i + 1} (${command.type}): Must specify at least one module to publish`);
          }
          break;
      }

      // Validate argument references
      const allArgs = this.getAllArguments(command);
      for (const arg of allArgs) {
        if (arg.type === 'result' && arg.resultFrom !== undefined) {
          if (arg.resultFrom >= i) {
            errors.push(`Command ${i + 1} (${command.type}): Cannot reference result from later command #${arg.resultFrom + 1}`);
          } else if (arg.resultFrom < 0 || arg.resultFrom >= this.commands.length) {
            errors.push(`Command ${i + 1} (${command.type}): Invalid result reference #${arg.resultFrom + 1} (out of range)`);
          }
        } else if (arg.type === 'object' && typeof arg.value === 'string') {
          if (arg.value.startsWith('0x') && arg.value.length !== 66) {
            warnings.push(`Command ${i + 1} (${command.type}): Object ID should be 66 characters long (including 0x)`);
          }
        } else if (arg.type === 'input' && typeof arg.value === 'string' && arg.value.trim() === '') {
          errors.push(`Command ${i + 1} (${command.type}): Input argument cannot be empty`);
        }
      }
    }

    // Cross-command validation
    if (this.commands.length > 1) {
      // Check for unused results
      const usedResults = new Set<number>();
      this.commands.forEach((command, index) => {
        const allArgs = this.getAllArguments(command);
        allArgs.forEach(arg => {
          if (arg.type === 'result' && arg.resultFrom !== undefined) {
            usedResults.add(arg.resultFrom);
          }
        });
      });

      this.commands.forEach((command, index) => {
        // Check if this command produces a result that could be used
        if (['MoveCall', 'SplitCoins', 'MakeMoveVec'].includes(command.type) && 
            !usedResults.has(index) && 
            index < this.commands.length - 1) {
          warnings.push(`Command ${index + 1} (${command.type}): Result not used by any subsequent commands`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private getAllArguments(command: PTBCommand): PTBArgument[] {
    switch (command.type) {
      case 'MoveCall':
        return command.arguments;
      case 'TransferObjects':
        return [...command.objects, command.recipient];
      case 'SplitCoins':
        return [command.coin, ...command.amounts];
      case 'MergeCoins':
        return [command.destination, ...command.sources];
      case 'MakeMoveVec':
        return command.objects;
      case 'Publish':
        return [];
      default:
        return [];
    }
  }

  // Code generation
  generateTypeScript(): string {
    const lines: string[] = [];
    lines.push('import { Transaction } from "@iota/iota-sdk/transactions";');
    lines.push('import { IotaClient, getFullnodeUrl } from "@iota/iota-sdk/client";');
    lines.push('');
    lines.push('export async function executePTB() {');
    lines.push('  const tx = new Transaction();');
    lines.push('');

    const resultVars: string[] = [];

    for (let i = 0; i < this.commands.length; i++) {
      const command = this.commands[i];
      
      switch (command.type) {
        case 'MoveCall':
          const args = command.arguments.map(arg => this.argToString(arg, resultVars)).join(', ');
          const typeArgs = command.typeArguments ? `\n    typeArguments: [${command.typeArguments.map(t => `"${t}"`).join(', ')}],` : '';
          lines.push(`  const result${i} = tx.moveCall({`);
          lines.push(`    target: "${command.target}",`);
          lines.push(`    arguments: [${args}],${typeArgs}`);
          lines.push(`  });`);
          resultVars.push(`result${i}`);
          break;
        
        case 'SplitCoins':
          const coin = this.argToString(command.coin, resultVars);
          const amounts = command.amounts.map(amt => this.argToString(amt, resultVars)).join(', ');
          lines.push(`  const result${i} = tx.splitCoins(${coin}, [${amounts}]);`);
          resultVars.push(`result${i}`);
          break;
        
        case 'TransferObjects':
          const objects = command.objects.map(obj => this.argToString(obj, resultVars)).join(', ');
          const recipient = this.argToString(command.recipient, resultVars);
          lines.push(`  tx.transferObjects([${objects}], ${recipient});`);
          break;
        
        case 'MergeCoins':
          const destination = this.argToString(command.destination, resultVars);
          const sources = command.sources.map(src => this.argToString(src, resultVars)).join(', ');
          lines.push(`  tx.mergeCoins(${destination}, [${sources}]);`);
          break;
      }
      lines.push('');
    }

    lines.push('  return tx;');
    lines.push('}');

    return lines.join('\n');
  }

  private argToString(arg: PTBArgument, resultVars: string[]): string {
    switch (arg.type) {
      case 'input':
        return typeof arg.value === 'string' ? `"${arg.value}"` : String(arg.value);
      case 'result':
        if (arg.resultFrom !== undefined && resultVars[arg.resultFrom]) {
          return resultVars[arg.resultFrom];
        }
        return 'undefined';
      case 'gas':
        return 'tx.gas';
      case 'object':
        return `"${arg.value}"`;
      default:
        return 'undefined';
    }
  }

  // Serialization
  toJSON(): PTBTemplate {
    return {
      id: `ptb-${Date.now()}`,
      name: 'Untitled PTB',
      description: 'Generated PTB template',
      commands: this.commands,
      created_at: new Date().toISOString(),
    };
  }

  static fromJSON(template: PTBTemplate): PTBBuilder {
    return new PTBBuilder(template);
  }

  // Execution
  async buildTransaction(): Promise<Transaction> {
    const tx = new Transaction();
    const results: any[] = [];

    for (const command of this.commands) {
      switch (command.type) {
        case 'MoveCall':
          const args = command.arguments.map(arg => this.resolveArgument(arg, results, tx));
          const result = tx.moveCall({
            target: command.target,
            arguments: args.filter(arg => arg !== undefined),
            typeArguments: command.typeArguments,
          });
          results.push(result);
          break;

        case 'SplitCoins':
          const coin = this.resolveArgument(command.coin, results, tx);
          const amounts = command.amounts.map(amt => this.resolveArgument(amt, results, tx));
          const splitResult = tx.splitCoins(coin, amounts);
          results.push(splitResult);
          break;

        case 'TransferObjects':
          const objects = command.objects.map(obj => this.resolveArgument(obj, results, tx));
          const recipient = this.resolveArgument(command.recipient, results, tx);
          tx.transferObjects(objects, recipient);
          break;

        case 'MergeCoins':
          const destination = this.resolveArgument(command.destination, results, tx);
          const sources = command.sources.map(src => this.resolveArgument(src, results, tx));
          tx.mergeCoins(destination, sources);
          break;
      }
    }

    return tx;
  }

  private resolveArgument(arg: PTBArgument, results: any[], tx: Transaction): any {
    switch (arg.type) {
      case 'input':
        return arg.value;
      case 'result':
        return arg.resultFrom !== undefined ? results[arg.resultFrom] : undefined;
      case 'gas':
        return tx.gas;
      case 'object':
        return arg.value;
      default:
        return undefined;
    }
  }

  // Clear all commands
  clear(): void {
    this.commands = [];
    this.nextId = 1;
  }

  // Get command count
  count(): number {
    return this.commands.length;
  }
}

// Utility functions for creating common PTB arguments
export const PTBArgs = {
  input: (value: string | number): PTBArgument => ({ type: 'input', value }),
  result: (fromIndex: number): PTBArgument => ({ type: 'result', value: '', resultFrom: fromIndex }),
  gas: (): PTBArgument => ({ type: 'gas', value: 'gas' }),
  object: (objectId: string): PTBArgument => ({ type: 'object', value: objectId }),
};

// Predefined PTB templates
export const PTBTemplates = {
  simple_transfer: (): PTBTemplate => ({
    id: 'simple-transfer',
    name: 'Simple Transfer',
    description: 'Transfer IOTA coins to another address',
    commands: [
      {
        id: 'cmd-1',
        type: 'SplitCoins',
        coin: PTBArgs.gas(),
        amounts: [PTBArgs.input(1000000)],
      } as PTBSplitCoinsCommand,
      {
        id: 'cmd-2',
        type: 'TransferObjects',
        objects: [PTBArgs.result(0)],
        recipient: PTBArgs.input('0x...'),
      } as PTBTransferObjectsCommand,
    ],
    created_at: new Date().toISOString(),
  }),
  
  module_call: (): PTBTemplate => ({
    id: 'module-call',
    name: 'Module Function Call',
    description: 'Call a function from a deployed Move module',
    commands: [
      {
        id: 'cmd-1',
        type: 'MoveCall',
        target: 'package::module::function',
        arguments: [PTBArgs.input('example_arg')],
      } as PTBMoveCallCommand,
    ],
    created_at: new Date().toISOString(),
  }),
};