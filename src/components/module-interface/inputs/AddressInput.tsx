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
  Wallet,
  Info,
  ExternalLink
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useWallet } from '@/contexts/WalletContext';

export interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showWalletOption?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
  normalizedAddress?: string;
}

// Common IOTA addresses
const COMMON_ADDRESSES = {
  zero: '0x0000000000000000000000000000000000000000000000000000000000000000',
  system: '0x0000000000000000000000000000000000000000000000000000000000000001',
  clock: '0x0000000000000000000000000000000000000000000000000000000000000006',
};

const ADDRESS_EXAMPLES = [
  {
    label: 'Zero Address',
    value: COMMON_ADDRESSES.zero,
    description: 'The zero address (0x0...)'
  },
  {
    label: 'System',
    value: COMMON_ADDRESSES.system,
    description: 'System package address'
  },
  {
    label: 'Clock',
    value: COMMON_ADDRESSES.clock,
    description: 'Clock object address'
  }
];

export function AddressInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  showWalletOption = true
}: AddressInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true });
  const { currentAccount } = useWallet();

  // Validate IOTA address format
  const validateAddress = (inputValue: string): ValidationResult => {
    if (!inputValue.trim()) {
      return { isValid: true }; // Empty is valid (will be handled by required validation)
    }

    const cleanValue = inputValue.trim();

    // Check if it starts with 0x
    if (!cleanValue.startsWith('0x')) {
      return {
        isValid: false,
        error: 'Address must start with 0x'
      };
    }

    // Remove 0x prefix for validation
    const hexPart = cleanValue.slice(2);

    // Check if it's valid hex
    if (!/^[0-9a-fA-F]*$/.test(hexPart)) {
      return {
        isValid: false,
        error: 'Address must contain only hexadecimal characters'
      };
    }

    // IOTA addresses should be 32 bytes (64 hex characters)
    if (hexPart.length !== 64) {
      return {
        isValid: false,
        error: 'IOTA address must be 32 bytes (64 hex characters) long'
      };
    }

    // Normalize the address (lowercase)
    const normalizedAddress = '0x' + hexPart.toLowerCase();

    return {
      isValid: true,
      normalizedAddress
    };
  };

  // Update validation when value changes
  useEffect(() => {
    const result = validateAddress(value);
    setValidation(result);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    
    // Auto-add 0x prefix if user starts typing hex characters
    if (newValue && !newValue.startsWith('0x') && /^[0-9a-fA-F]/.test(newValue)) {
      newValue = '0x' + newValue;
    }
    
    onChange(newValue);
  };

  const handleExampleClick = (address: string) => {
    onChange(address);
  };

  const handleWalletAddressClick = () => {
    if (currentAccount?.address) {
      onChange(currentAccount.address);
    }
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

  const truncateAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    // Ensure proper 0x prefix and lowercase
    if (address.startsWith('0x')) {
      return '0x' + address.slice(2).toLowerCase();
    }
    return '0x' + address.toLowerCase();
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
          placeholder={placeholder || "Enter IOTA address (0x...)"}
          disabled={disabled}
          className={cn(
            "pr-10 font-mono text-sm",
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
            address
          </Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                  <Info className="h-3 w-3" />
                  IOTA Address
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-2">
                  <div className="font-semibold">IOTA Address Format</div>
                  <div className="text-xs">
                    <div>• Must start with 0x</div>
                    <div>• 32 bytes (64 hex characters)</div>
                    <div>• Case insensitive</div>
                    <div>• Points to accounts, objects, or packages</div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1">
          {value && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(value)}
                title="Copy address"
              >
                <Copy className="h-3 w-3" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleClear}
                title="Clear"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </>
          )}

          {showWalletOption && currentAccount?.address && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleWalletAddressClick}
              title="Use connected wallet address"
            >
              <Wallet className="h-3 w-3 mr-1" />
              My Address
            </Button>
          )}
        </div>
      </div>

      {/* Common addresses */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Common addresses:</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
          {ADDRESS_EXAMPLES.map((example, index) => (
            <TooltipProvider key={index}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs font-mono justify-start"
                    onClick={() => handleExampleClick(example.value)}
                  >
                    <div className="flex items-center gap-1 w-full">
                      <span className="truncate">{example.label}</span>
                      <Copy className="h-3 w-3 ml-auto flex-shrink-0" />
                    </div>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <div className="font-semibold">{example.label}</div>
                    <div className="text-xs">{example.description}</div>
                    <div className="font-mono text-xs text-muted-foreground break-all">
                      {example.value}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>

      {/* Connected wallet address */}
      {showWalletOption && currentAccount?.address && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Connected wallet:</div>
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
            <Wallet className="h-4 w-4 text-blue-500" />
            <code className="text-xs font-mono flex-1 truncate">
              {currentAccount.address}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => copyToClipboard(currentAccount.address)}
              title="Copy wallet address"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleWalletAddressClick}
              title="Use this address"
            >
              <Check className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Validation error message */}
      {!validation.isValid && validation.error && (
        <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md p-2">
          <div className="flex items-center gap-2">
            <X className="h-3 w-3 flex-shrink-0" />
            <span>{validation.error}</span>
          </div>
        </div>
      )}

      {/* Address info display */}
      {value && validation.isValid && validation.normalizedAddress && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span>Normalized:</span>
              <div className="flex items-center gap-1">
                <code className="font-mono">{truncateAddress(validation.normalizedAddress)}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0"
                  onClick={() => copyToClipboard(validation.normalizedAddress!)}
                  title="Copy normalized address"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <a
                  href={`https://explorer.iota.org/address/${validation.normalizedAddress}?network=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                  title="View on IOTA Explorer"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}