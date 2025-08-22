import React from 'react';
import { ModuleFunctionInput } from '@/lib/types';
import { NumberInput } from './NumberInput';
import { AddressInput } from './AddressInput';
import { ObjectIdInput } from './ObjectIdInput';
import { VectorInput } from './VectorInput';
import { BooleanInput } from './BooleanInput';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ParameterInputProps {
  parameter: ModuleFunctionInput;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  network?: 'testnet' | 'mainnet';
}

interface TypeInfo {
  category: 'number' | 'address' | 'object' | 'vector' | 'boolean' | 'string' | 'reference';
  subtype?: string;
  isReference?: boolean;
  isMutable?: boolean;
  elementType?: string;
}

export function ParameterInput({
  parameter,
  value,
  onChange,
  disabled = false,
  className,
  network = 'testnet'
}: ParameterInputProps) {
  
  // Enhanced type analysis aligned with IOTA SDK patterns
  const analyzeType = (type: string): TypeInfo => {
    const normalizedType = type.toLowerCase().trim();
    
    // Check for references - these ALWAYS need tx.object()
    const isReference = normalizedType.startsWith('&');
    const isMutable = normalizedType.startsWith('&mut');
    const coreType = normalizedType.replace(/^&(mut\s+)?/, '');
    
    // IMPORTANT: Any reference type should use object category for tx.object()
    if (isReference) {
      return {
        category: 'object',
        subtype: coreType,
        isReference: true,
        isMutable
      };
    }
    
    // Check for vector types
    if (coreType.startsWith('vector<')) {
      const elementTypeMatch = coreType.match(/vector<(.+)>/);
      const elementType = elementTypeMatch ? elementTypeMatch[1].trim() : 'string';
      
      return {
        category: 'vector',
        elementType,
        isReference: false,
        isMutable
      };
    }
    
    // Check for Move primitive number types (use tx.pure.*)
    if (/^u(8|16|32|64|128|256)$/.test(coreType)) {
      return {
        category: 'number',
        subtype: coreType,
        isReference: false,
        isMutable
      };
    }
    
    // Check for boolean (use tx.pure.bool)
    if (coreType === 'bool') {
      return {
        category: 'boolean',
        isReference: false,
        isMutable
      };
    }
    
    // Check for address (use tx.pure.address)
    if (coreType === 'address') {
      return {
        category: 'address',
        subtype: 'address',
        isReference: false,
        isMutable
      };
    }
    
    // Check for signer (use tx.pure.address)
    if (coreType === 'signer') {
      return {
        category: 'address',
        subtype: 'signer',
        isReference: false,
        isMutable
      };
    }
    
    // Check for custom struct types (typically need tx.object() if they're parameters)
    // Types with :: usually represent struct types from other modules
    if (coreType.includes('::')) {
      return {
        category: 'object',
        subtype: coreType,
        isReference: false, // Not a reference, but still an object type
        isMutable
      };
    }
    
    // Default to string for unknown types (use tx.pure.string)
    return {
      category: 'string',
      subtype: coreType,
      isReference: false,
      isMutable
    };
  };

  const typeInfo = analyzeType(parameter.type);
  
  // Generate appropriate placeholder text
  const getPlaceholder = (): string => {
    const baseType = typeInfo.subtype || typeInfo.category;
    const prefix = typeInfo.isReference ? 'Enter object ID for ' : 'Enter ';
    
    switch (typeInfo.category) {
      case 'number':
        return `${prefix}${typeInfo.subtype} value`;
      case 'address':
        return typeInfo.subtype === 'signer' ? 'Enter signer address (0x...)' : 'Enter address (0x...)';
      case 'object':
        return `${prefix}${baseType.replace('::', ' ')} object (0x...)`;
      case 'vector':
        return `Enter ${parameter.type} values`;
      case 'boolean':
        return 'Select true or false';
      default:
        return `Enter ${baseType} value`;
    }
  };

  // Skip TxContext parameters (they're handled automatically)
  if (parameter.type.includes('TxContext')) {
    return null;
  }

  // Render the appropriate input component
  const renderInputComponent = () => {
    const commonProps = {
      value,
      onChange,
      disabled,
      className: 'w-full',
      placeholder: getPlaceholder()
    };

    switch (typeInfo.category) {
      case 'number':
        return (
          <NumberInput
            {...commonProps}
            type={typeInfo.subtype as any}
          />
        );

      case 'address':
        return (
          <AddressInput
            {...commonProps}
            showWalletOption={true}
          />
        );

      case 'object':
        return (
          <ObjectIdInput
            {...commonProps}
            expectedType={typeInfo.subtype}
            network={network}
          />
        );

      case 'vector':
        return (
          <VectorInput
            {...commonProps}
            type={parameter.type}
            network={network}
          />
        );

      case 'boolean':
        return (
          <BooleanInput
            {...commonProps}
            variant="toggle"
          />
        );

      default:
        // Fallback to basic input for unknown types
        return (
          <Input
            {...commonProps}
            className={cn("font-mono text-sm", commonProps.className)}
          />
        );
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {renderInputComponent()}
      
      {/* Enhanced type-specific helper text with SDK context */}
      <div className="text-xs text-muted-foreground">
        {(() => {
          switch (typeInfo.category) {
            case 'object':
              return (
                <div className="space-y-1">
                  <div>💡 <strong>Object Reference:</strong> Passed as <code className="bg-muted px-1 rounded">tx.object(objectId)</code></div>
                  {typeInfo.subtype && (
                    <div className="ml-4">Expected type: <code className="font-mono">{typeInfo.subtype}</code></div>
                  )}
                  {typeInfo.isReference && (
                    <div className="ml-4 text-blue-600">🔗 Reference parameter - requires existing blockchain object</div>
                  )}
                  {typeInfo.isMutable && (
                    <div className="ml-4 text-amber-600">⚠️ Mutable reference - function will modify the object</div>
                  )}
                </div>
              );
            
            case 'address':
              if (typeInfo.subtype === 'signer') {
                return (
                  <div className="space-y-1">
                    <div>🔐 <strong>Signer Address:</strong> Passed as <code className="bg-muted px-1 rounded">tx.pure.address(address)</code></div>
                    <div className="ml-4">Use your wallet address or another account address</div>
                  </div>
                );
              }
              return (
                <div className="space-y-1">
                  <div>📍 <strong>Address Parameter:</strong> Passed as <code className="bg-muted px-1 rounded">tx.pure.address(address)</code></div>
                  <div className="ml-4">Must be a valid IOTA address (32 bytes, 0x prefix)</div>
                </div>
              );
            
            case 'vector':
              return (
                <div className="space-y-1">
                  <div>📋 <strong>Vector Parameter:</strong> Passed as <code className="bg-muted px-1 rounded">tx.pure.vector(type, values)</code></div>
                  <div className="ml-4">Add/remove elements using the builder or enter raw JSON array</div>
                </div>
              );
            
            case 'number':
              const isLargeNumber = ['u64', 'u128', 'u256'].includes(typeInfo.subtype || '');
              return (
                <div className="space-y-1">
                  <div>🔢 <strong>Number Parameter:</strong> Passed as <code className="bg-muted px-1 rounded">tx.pure.{typeInfo.subtype}({isLargeNumber ? '"value"' : 'value'})</code></div>
                  <div className="ml-4">{typeInfo.subtype?.toUpperCase()} type with range validation{isLargeNumber ? ' (uses string for precision)' : ''}</div>
                </div>
              );
            
            case 'boolean':
              return (
                <div className="space-y-1">
                  <div>✅ <strong>Boolean Parameter:</strong> Passed as <code className="bg-muted px-1 rounded">tx.pure.bool(value)</code></div>
                  <div className="ml-4">Controls conditional behavior in the function</div>
                </div>
              );
            
            default:
              return (
                <div className="space-y-1">
                  <div>📝 <strong>Generic Parameter:</strong> Passed as <code className="bg-muted px-1 rounded">tx.pure.string(value)</code></div>
                  <div className="ml-4">Type: {parameter.type}</div>
                </div>
              );
          }
        })()}
      </div>
    </div>
  );
}