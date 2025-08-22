import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Check, 
  X, 
  Copy, 
  RotateCcw,
  Calculator,
  Info
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  type: 'u8' | 'u16' | 'u32' | 'u64' | 'u128' | 'u256';
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface NumberTypeInfo {
  min: bigint;
  max: bigint;
  description: string;
  examples: string[];
}

const NUMBER_TYPE_INFO: Record<string, NumberTypeInfo> = {
  u8: {
    min: 0n,
    max: 255n,
    description: '8-bit unsigned integer',
    examples: ['0', '42', '255']
  },
  u16: {
    min: 0n,
    max: 65535n,
    description: '16-bit unsigned integer',
    examples: ['0', '1000', '65535']
  },
  u32: {
    min: 0n,
    max: 4294967295n,
    description: '32-bit unsigned integer',
    examples: ['0', '100000', '4294967295']
  },
  u64: {
    min: 0n,
    max: 18446744073709551615n,
    description: '64-bit unsigned integer',
    examples: ['0', '1000000000', '18446744073709551615']
  },
  u128: {
    min: 0n,
    max: 340282366920938463463374607431768211455n,
    description: '128-bit unsigned integer',
    examples: ['0', '1000000000000000000', '340282366920938463463374607431768211455']
  },
  u256: {
    min: 0n,
    max: 115792089237316195423570985008687907853269984665640564039457584007913129639935n,
    description: '256-bit unsigned integer',
    examples: ['0', '1000000000000000000000000000', '115792089237316195423570985008687907853269984665640564039457584007913129639935']
  }
};

interface ValidationResult {
  isValid: boolean;
  error?: string;
  parsedValue?: bigint;
}

export function NumberInput({
  value,
  onChange,
  type,
  placeholder,
  disabled = false,
  className
}: NumberInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true });
  
  const typeInfo = NUMBER_TYPE_INFO[type];

  // Validate the input value
  const validateInput = (inputValue: string): ValidationResult => {
    if (!inputValue.trim()) {
      return { isValid: true }; // Empty is valid (will be handled by required validation)
    }

    // Remove whitespace and check for invalid characters
    const cleanValue = inputValue.trim();
    
    // Check for invalid characters (only digits allowed)
    if (!/^\d+$/.test(cleanValue)) {
      return {
        isValid: false,
        error: 'Only positive integers are allowed'
      };
    }

    try {
      const parsed = BigInt(cleanValue);
      
      // Check range
      if (parsed < typeInfo.min || parsed > typeInfo.max) {
        return {
          isValid: false,
          error: `Value must be between ${typeInfo.min} and ${typeInfo.max}`
        };
      }

      return {
        isValid: true,
        parsedValue: parsed
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid number format'
      };
    }
  };

  // Update validation when value changes
  useEffect(() => {
    const result = validateInput(value);
    setValidation(result);
  }, [value, type]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  const handleExampleClick = (example: string) => {
    onChange(example);
  };

  const handleMaxClick = () => {
    onChange(typeInfo.max.toString());
  };

  const handleClear = () => {
    onChange('');
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const formatNumber = (num: string) => {
    try {
      const bigintNum = BigInt(num);
      return bigintNum.toLocaleString();
    } catch {
      return num;
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Input with validation indicators */}
      <div className="relative">
        <Input
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder || `Enter ${type} value (0 - ${typeInfo.max})`}
          disabled={disabled}
          className={cn(
            "pr-10 font-mono",
            validation.isValid ? "border-green-500/20" : "border-red-500 focus:border-red-500",
            value && validation.isValid && "border-green-500 focus:border-green-500"
          )}
        />
        
        {/* Validation indicator */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {value && (
            validation.isValid ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <X className="h-4 w-4 text-red-500" />
            )
          )}
        </div>
      </div>

      {/* Type info and controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">
            {type}
          </Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                  <Info className="h-3 w-3" />
                  {typeInfo.description}
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-2">
                  <div className="font-semibold">{type.toUpperCase()} Type</div>
                  <div className="text-xs">
                    <div>Range: {typeInfo.min.toLocaleString()} - {typeInfo.max.toLocaleString()}</div>
                    <div className="mt-1">{typeInfo.description}</div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1">
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleClear}
              title="Clear"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleMaxClick}
            title={`Set to maximum value (${typeInfo.max})`}
          >
            Max
          </Button>
        </div>
      </div>

      {/* Examples and quick values */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Examples:</div>
        <div className="flex flex-wrap gap-1">
          {typeInfo.examples.map((example, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs font-mono"
              onClick={() => handleExampleClick(example)}
              title={`Use ${formatNumber(example)}`}
            >
              {formatNumber(example)}
              <Copy className="h-3 w-3 ml-1" />
            </Button>
          ))}
        </div>
      </div>

      {/* Validation error message */}
      {!validation.isValid && validation.error && (
        <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md p-2">
          <div className="flex items-center gap-2">
            <X className="h-3 w-3 flex-shrink-0" />
            <span>{validation.error}</span>
          </div>
        </div>
      )}

      {/* Formatted value display for large numbers */}
      {value && validation.isValid && validation.parsedValue && validation.parsedValue > 1000000n && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
          <div className="flex items-center justify-between">
            <span>Formatted: {formatNumber(value)}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0"
              onClick={() => copyToClipboard(value)}
              title="Copy exact value"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}