import { PTBCommand } from '@/components/views/PTBBuilderV3';

export interface ArgumentReference {
  type: 'gas' | 'object' | 'result' | 'input' | 'pure';
  value?: any;
  resultFrom?: number; // Command index this result comes from
  resultIndex?: number; // For array results
  paramType?: string; // The Move type of the parameter
}

// Generate auto-references based on previous commands
export function generateAutoReferences(
  command: PTBCommand,
  previousCommands: PTBCommand[]
): PTBCommand {
  const updatedCommand = { ...command };

  // Auto-reference compatible objects/coins as arguments
  if (updatedCommand.arguments && updatedCommand.arguments.length > 0) {
    updatedCommand.arguments = updatedCommand.arguments.map(arg => {
      if (!arg || arg === '') {
        // Try to auto-fill with compatible results
        const lastResult = previousCommands.length - 1;
        if (lastResult >= 0) {
          return {
            type: 'result',
            value: `Result(${lastResult})`,
            resultFrom: lastResult,
          };
        }
      }
      return arg;
    });
  }

  return updatedCommand;
}

// Validate command references
export function validateCommandReferences(
  command: PTBCommand,
  previousCommands: PTBCommand[]
): string[] {
  const errors: string[] = [];

  // Helper to check if a result reference is valid
  const validateResultReference = (ref: any, paramName: string) => {
    if (ref?.type === 'result' && ref.resultFrom !== undefined) {
      if (ref.resultFrom >= previousCommands.length) {
        errors.push(`${paramName}: References Result(${ref.resultFrom}) which doesn't exist yet`);
      }
    }
  };

  // Validate MoveCall command
  if (!command.target && !command.module && !command.function) {
    errors.push('Move call requires target function');
  }
  
  command.arguments?.forEach((arg, i) => {
    validateResultReference(arg, `Argument ${i}`);
  });

  return errors;
}

// Get available references from previous commands
export function getAvailableReferences(previousCommands: PTBCommand[]): ArgumentReference[] {
  const references: ArgumentReference[] = [
    { type: 'gas', value: 'gas' }, // Always available
  ];

  previousCommands.forEach((command, index) => {
    // All Move calls produce results that can be referenced
    references.push({
      type: 'result',
      value: `Result(${index})`,
      resultFrom: index,
    });
  });

  return references;
}

// Format reference for display
export function formatReference(ref: ArgumentReference): string {
  if (ref.type === 'gas') return '⛽ Gas';
  if (ref.type === 'result') {
    const fromCommand = ref.resultFrom !== undefined ? `Step ${ref.resultFrom + 1}` : '';
    return `📤 ${ref.value} - Output from ${fromCommand}`;
  }
  if (ref.type === 'object') return `🔷 ${ref.value || 'Object'}`;
  if (ref.type === 'input') return `✏️ ${ref.value || 'Input'}`;
  return ref.value?.toString() || '';
}

// Parse Move function signature to get parameter types
export function parseFunctionSignature(func: any): {
  parameters: Array<{ name: string; type: string }>;
  returnTypes: string[];
} {
  // This would parse the actual Move function ABI
  // For now, returning a simplified version
  return {
    parameters: func?.parameters || [],
    returnTypes: func?.returnTypes || [],
  };
}

// Check if a reference type is compatible with a parameter type
export function isTypeCompatible(
  referenceType: string,
  parameterType: string
): boolean {
  // Simplified type checking - in production this would be more sophisticated
  if (parameterType.includes('&')) {
    // Reference type
    return referenceType === 'object' || referenceType === 'result';
  }
  if (parameterType.includes('Coin')) {
    return referenceType === 'gas' || referenceType === 'result';
  }
  if (parameterType === 'address') {
    return referenceType === 'input' || referenceType === 'pure';
  }
  // Default allow for now
  return true;
}