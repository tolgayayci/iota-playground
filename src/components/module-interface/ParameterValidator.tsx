import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertCircle,
  CheckCircle,
  Info,
  Loader2,
  Code,
  HelpCircle,
  Copy,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateMoveType, suggestValidValue } from '@/lib/moveTypeValidator';
import { ObjectBrowser } from './inputs/ObjectBrowser';

interface ParameterValidatorProps {
  name: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean, error?: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  index?: number;
  packageId?: string;
}

interface ValidationState {
  isValid: boolean;
  error?: string;
  warning?: string;
  suggestion?: string;
  isValidating?: boolean;
}

// Type-specific validation rules
const TYPE_RULES: Record<string, { 
  pattern?: RegExp;
  min?: bigint;
  max?: bigint;
  example: string;
  description: string;
}> = {
  'u8': {
    min: 0n,
    max: 255n,
    example: '100',
    description: 'Unsigned 8-bit integer (0-255)',
  },
  'u16': {
    min: 0n,
    max: 65535n,
    example: '1000',
    description: 'Unsigned 16-bit integer (0-65,535)',
  },
  'u32': {
    min: 0n,
    max: 4294967295n,
    example: '100000',
    description: 'Unsigned 32-bit integer (0-4,294,967,295)',
  },
  'u64': {
    min: 0n,
    max: 18446744073709551615n,
    example: '1000000000',
    description: 'Unsigned 64-bit integer (0-18,446,744,073,709,551,615)',
  },
  'u128': {
    min: 0n,
    max: 340282366920938463463374607431768211455n,
    example: '1000000000000',
    description: 'Unsigned 128-bit integer',
  },
  'u256': {
    min: 0n,
    max: 115792089237316195423570985008687907853269984665640564039457584007913129639935n,
    example: '1000000000000000',
    description: 'Unsigned 256-bit integer',
  },
  'bool': {
    pattern: /^(true|false)$/i,
    example: 'true',
    description: 'Boolean value (true or false)',
  },
  'address': {
    pattern: /^0x[a-fA-F0-9]{64}$/,
    example: '0x0000000000000000000000000000000000000000000000000000000000000001',
    description: 'IOTA address (66 characters starting with 0x)',
  },
  'string': {
    example: '"Hello, World!"',
    description: 'UTF-8 string (enclose in quotes for JSON)',
  },
};

export function ParameterValidator({
  name,
  type,
  value,
  onChange,
  onValidationChange,
  required = true,
  placeholder,
  className,
  index = 0,
  packageId,
}: ParameterValidatorProps) {
  const [validation, setValidation] = useState<ValidationState>({ isValid: true });
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showObjectBrowser, setShowObjectBrowser] = useState(false);

  // Normalize type for validation
  const normalizedType = type.toLowerCase().replace(/\s+/g, '');
  const baseType = normalizedType.replace(/vector<|>|&|mut/g, '');
  const isVector = normalizedType.includes('vector');
  const isReference = normalizedType.includes('&');
  const isMutable = normalizedType.includes('mut');

  // Get validation rules for the base type
  const rules = TYPE_RULES[baseType] || {};

  useEffect(() => {
    validateInput(value);
  }, [value, type]);

  const validateInput = async (inputValue: string) => {
    // Don't validate empty values if not required
    if (!required && !inputValue) {
      const state = { isValid: true };
      setValidation(state);
      onValidationChange?.(true);
      return;
    }

    // Empty value for required field
    if (required && !inputValue) {
      const state = { 
        isValid: false, 
        error: 'This field is required' 
      };
      setValidation(state);
      onValidationChange?.(false, state.error);
      return;
    }

    try {
      // Vector validation
      if (isVector) {
        try {
          const parsed = JSON.parse(inputValue);
          if (!Array.isArray(parsed)) {
            throw new Error('Value must be an array');
          }
          
          // Validate each element
          for (let i = 0; i < parsed.length; i++) {
            const elem = parsed[i];
            if (baseType === 'u8' || baseType === 'u16' || baseType === 'u32' || 
                baseType === 'u64' || baseType === 'u128' || baseType === 'u256') {
              const num = BigInt(elem);
              if (rules.min !== undefined && num < rules.min) {
                throw new Error(`Element ${i} is below minimum value ${rules.min}`);
              }
              if (rules.max !== undefined && num > rules.max) {
                throw new Error(`Element ${i} exceeds maximum value ${rules.max}`);
              }
            } else if (baseType === 'bool') {
              if (typeof elem !== 'boolean') {
                throw new Error(`Element ${i} must be a boolean`);
              }
            } else if (baseType === 'address') {
              if (!rules.pattern?.test(elem)) {
                throw new Error(`Element ${i} is not a valid address`);
              }
            }
          }
          
          const state = { isValid: true };
          setValidation(state);
          onValidationChange?.(true);
        } catch (e) {
          const error = e instanceof Error ? e.message : 'Invalid array format';
          const state = { 
            isValid: false, 
            error,
            suggestion: `Example: ${baseType === 'u8' ? '[1, 2, 3]' : baseType === 'address' ? '["0x..."]' : '["value1", "value2"]'}`
          };
          setValidation(state);
          onValidationChange?.(false, state.error);
        }
        return;
      }

      // Number type validation
      if (baseType === 'u8' || baseType === 'u16' || baseType === 'u32' || 
          baseType === 'u64' || baseType === 'u128' || baseType === 'u256') {
        try {
          const num = BigInt(inputValue);
          
          if (rules.min !== undefined && num < rules.min) {
            const state = { 
              isValid: false, 
              error: `Value must be at least ${rules.min}`,
              suggestion: `Use a value between ${rules.min} and ${rules.max}`
            };
            setValidation(state);
            onValidationChange?.(false, state.error);
            return;
          }
          
          if (rules.max !== undefined && num > rules.max) {
            const state = { 
              isValid: false, 
              error: `Value exceeds maximum of ${rules.max}`,
              suggestion: `Use a value between ${rules.min} and ${rules.max}`
            };
            setValidation(state);
            onValidationChange?.(false, state.error);
            return;
          }

          // Warning for large numbers
          if (num > 1000000000000n && baseType === 'u64') {
            const state = { 
              isValid: true,
              warning: 'Large value detected. This might represent token amounts in smallest units (e.g., 1 IOTA = 1B units)'
            };
            setValidation(state);
            onValidationChange?.(true);
          } else {
            const state = { isValid: true };
            setValidation(state);
            onValidationChange?.(true);
          }
        } catch (e) {
          const state = { 
            isValid: false, 
            error: 'Invalid number format',
            suggestion: rules.example ? `Example: ${rules.example}` : undefined
          };
          setValidation(state);
          onValidationChange?.(false, state.error);
        }
        return;
      }

      // Boolean validation
      if (baseType === 'bool') {
        if (!rules.pattern?.test(inputValue)) {
          const state = { 
            isValid: false, 
            error: 'Value must be "true" or "false"',
            suggestion: 'Use: true or false (without quotes)'
          };
          setValidation(state);
          onValidationChange?.(false, state.error);
          return;
        }
        const state = { isValid: true };
        setValidation(state);
        onValidationChange?.(true);
        return;
      }

      // Address validation
      if (baseType === 'address') {
        if (!rules.pattern?.test(inputValue)) {
          const state = { 
            isValid: false, 
            error: 'Invalid address format',
            suggestion: 'Address must be 66 characters starting with 0x'
          };
          setValidation(state);
          onValidationChange?.(false, state.error);
          return;
        }
        const state = { isValid: true };
        setValidation(state);
        onValidationChange?.(true);
        return;
      }

      // String validation
      if (baseType === 'string' || baseType.includes('string')) {
        // Strings should be valid for JSON parsing if they contain special characters
        if (inputValue.includes('"') || inputValue.includes('\\')) {
          try {
            JSON.parse(`"${inputValue}"`);
          } catch {
            const state = { 
              isValid: false, 
              error: 'Invalid string format',
              warning: 'Special characters need to be escaped',
              suggestion: 'Use backslash to escape quotes: \\"'
            };
            setValidation(state);
            onValidationChange?.(false, state.error);
            return;
          }
        }
        const state = { isValid: true };
        setValidation(state);
        onValidationChange?.(true);
        return;
      }

      // Object ID validation
      if (normalizedType.includes('object') || normalizedType.includes('id')) {
        const objectIdPattern = /^0x[a-fA-F0-9]{64}$/;
        if (!objectIdPattern.test(inputValue)) {
          const state = { 
            isValid: false, 
            error: 'Invalid object ID format',
            suggestion: 'Object ID must be 66 characters starting with 0x'
          };
          setValidation(state);
          onValidationChange?.(false, state.error);
          return;
        }
        const state = { isValid: true };
        setValidation(state);
        onValidationChange?.(true);
        return;
      }

      // Generic validation for unknown types
      const state = { 
        isValid: true,
        warning: 'Type validation not available for this parameter'
      };
      setValidation(state);
      onValidationChange?.(true);
      
    } catch (error) {
      const state = { 
        isValid: false, 
        error: 'Validation error occurred'
      };
      setValidation(state);
      onValidationChange?.(false, state.error);
    }
  };

  const handleExampleClick = () => {
    if (rules.example) {
      onChange(rules.example);
      setHasInteracted(true);
    }
  };

  const handleObjectSelect = (objectId: string) => {
    onChange(objectId);
    setHasInteracted(true);
    setShowObjectBrowser(false);
    validateInput(objectId);
  };

  const getInputComponent = () => {
    // Use textarea for complex types
    if (isVector || normalizedType.includes('struct')) {
      return (
        <Textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setHasInteracted(true);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder || `Enter ${type}`}
          className={cn(
            'font-mono text-sm min-h-[80px]',
            validation.error && hasInteracted && 'border-red-500',
            validation.warning && 'border-yellow-500',
            validation.isValid && value && hasInteracted && 'border-green-500',
            className
          )}
        />
      );
    }

    // Use select for boolean
    if (baseType === 'bool') {
      return (
        <Select 
          value={value} 
          onValueChange={(val) => {
            onChange(val);
            setHasInteracted(true);
          }}
        >
          <SelectTrigger className={cn(
            validation.error && hasInteracted && 'border-red-500',
            validation.isValid && value && hasInteracted && 'border-green-500',
            className
          )}>
            <SelectValue placeholder="Select boolean value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">true</SelectItem>
            <SelectItem value="false">false</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    // For object/reference types, add Browse button
    const isObjectType = normalizedType.includes('object') || 
                        normalizedType.includes('&') || 
                        normalizedType.includes('::');
    
    if (isObjectType) {
      return (
        <div className="flex gap-2">
          <Input
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setHasInteracted(true);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder || `Enter object ID (0x...)`}
            className={cn(
              'font-mono flex-1',
              validation.error && hasInteracted && 'border-red-500',
              validation.warning && 'border-yellow-500',
              validation.isValid && value && hasInteracted && 'border-green-500',
              className
            )}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowObjectBrowser(true)}
            className="gap-1.5"
          >
            <FolderOpen className="h-4 w-4" />
            Browse
          </Button>
        </div>
      );
    }

    // Default to input
    return (
      <Input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setHasInteracted(true);
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder || `Enter ${type}`}
        className={cn(
          'font-mono',
          validation.error && hasInteracted && 'border-red-500',
          validation.warning && 'border-yellow-500',
          validation.isValid && value && hasInteracted && 'border-green-500',
          className
        )}
      />
    );
  };

  return (
    <div className="space-y-2">
      {/* Parameter Header */}
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <span className="font-medium">{name || `Parameter ${index + 1}`}</span>
          <Badge variant="outline" className="text-xs font-mono">
            {type}
          </Badge>
          {required && <span className="text-red-500">*</span>}
        </Label>
        
        {/* Type Info */}
        {rules.description && (
          <div className="flex items-center gap-1">
            <HelpCircle className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{rules.description}</span>
          </div>
        )}
      </div>

      {/* Input Field */}
      <div className="relative">
        {getInputComponent()}
        
        {/* Validation Icon */}
        {hasInteracted && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {validation.isValidating && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {!validation.isValidating && validation.isValid && value && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            {!validation.isValidating && validation.error && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            {!validation.isValidating && validation.warning && !validation.error && (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
          </div>
        )}
      </div>

      {/* Helper Actions */}
      {(rules.example || validation.suggestion) && (
        <div className="flex items-center gap-2">
          {rules.example && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleExampleClick}
            >
              <Code className="h-3 w-3 mr-1" />
              Use Example: {rules.example}
            </Button>
          )}
          {validation.suggestion && hasInteracted && (
            <span className="text-xs text-muted-foreground">{validation.suggestion}</span>
          )}
        </div>
      )}

      {/* Validation Messages */}
      {hasInteracted && (
        <>
          {validation.error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{validation.error}</AlertDescription>
            </Alert>
          )}
          {validation.warning && !validation.error && (
            <Alert className="py-2 border-yellow-500/50">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-xs">{validation.warning}</AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Type-specific hints */}
      {isFocused && !hasInteracted && (
        <div className="flex items-start gap-2 p-2 bg-muted rounded-md">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            {isVector && (
              <p>Enter as JSON array, e.g., {baseType === 'u8' ? '[1, 2, 3]' : '["item1", "item2"]'}</p>
            )}
            {isReference && (
              <p>This is a reference type. Enter the ID of an existing object.</p>
            )}
            {isMutable && (
              <p>This parameter can modify the referenced object.</p>
            )}
            {baseType === 'address' && (
              <p>Tip: You can use your connected wallet address or any valid IOTA address.</p>
            )}
            {(baseType === 'u64' || baseType === 'u128') && (
              <p>Note: 1 IOTA = 1,000,000,000 units (smallest denomination)</p>
            )}
          </div>
        </div>
      )}
      
      {/* Object Browser Modal */}
      <ObjectBrowser
        open={showObjectBrowser}
        onOpenChange={setShowObjectBrowser}
        onSelectObject={handleObjectSelect}
        expectedType={type}
        network="testnet"
        packageId={packageId}
      />
    </div>
  );
}