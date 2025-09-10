import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Check, 
  X, 
  Copy, 
  RotateCcw,
  Search,
  Info,
  ExternalLink,
  Loader2,
  Package,
  AlertTriangle,
  Eye,
  FolderOpen
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';
import { useToast } from '@/hooks/use-toast';
import { ObjectBrowser } from './ObjectBrowser';

export interface ObjectIdInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  expectedType?: string; // Expected object type (e.g., "Counter", "Coin", etc.)
  network?: 'testnet' | 'mainnet';
  packageId?: string; // Package context for showing package-related objects
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
  normalizedId?: string;
}

interface ObjectInfo {
  objectId: string;
  version: string;
  digest: string;
  type?: string;
  owner?: any;
  content?: any;
  display?: any;
  storageRebate?: string;
}

interface ObjectVerificationState {
  isChecking: boolean;
  exists: boolean;
  info?: ObjectInfo;
  error?: string;
}

export function ObjectIdInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  expectedType,
  network = 'testnet',
  packageId
}: ObjectIdInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true });
  const [objectState, setObjectState] = useState<ObjectVerificationState>({
    isChecking: false,
    exists: false
  });
  const [showObjectBrowser, setShowObjectBrowser] = useState(false);
  const { toast } = useToast();

  // Validate object ID format with normalization (more lenient for explorer inputs)
  const validateObjectId = (inputValue: string): ValidationResult => {
    if (!inputValue.trim()) {
      return { isValid: true }; // Empty is valid (will be handled by required validation)
    }

    const cleanValue = inputValue.trim();

    // Auto-add 0x prefix if missing
    const prefixedValue = cleanValue.startsWith('0x') ? cleanValue : `0x${cleanValue}`;

    // Remove 0x prefix for validation
    const hexPart = prefixedValue.slice(2);

    // Check if it's valid hex
    if (!/^[0-9a-fA-F]*$/.test(hexPart)) {
      return {
        isValid: false,
        error: 'Object ID must contain only hexadecimal characters'
      };
    }

    // Normalize the hex part - pad short IDs to 64 chars
    let normalizedHex = hexPart.toLowerCase();
    if (normalizedHex.length < 64) {
      normalizedHex = normalizedHex.padStart(64, '0');
    } else if (normalizedHex.length > 64) {
      return {
        isValid: false,
        error: 'Object ID cannot be longer than 32 bytes (64 hex characters)'
      };
    }

    // Object IDs should be 32 bytes (64 hex characters) after normalization
    const normalizedId = '0x' + normalizedHex;

    return {
      isValid: true,
      normalizedId
    };
  };

  // Check if object exists on blockchain
  const checkObjectExists = useCallback(async (objectId: string): Promise<void> => {
    if (!objectId || !validation.isValid) {
      setObjectState({ isChecking: false, exists: false });
      return;
    }

    setObjectState({ isChecking: true, exists: false });

    try {
      const client = new IotaClient({ url: getFullnodeUrl(network) });
      
      const objectResponse = await client.getObject({
        id: objectId,
        options: {
          showType: true,
          showOwner: true,
          showContent: true,
          showDisplay: true,
          showStorageRebate: true,
        },
      });

      if (objectResponse.data) {
        const objectInfo: ObjectInfo = {
          objectId: objectResponse.data.objectId,
          version: objectResponse.data.version,
          digest: objectResponse.data.digest,
          type: objectResponse.data.type,
          owner: objectResponse.data.owner,
          content: objectResponse.data.content,
          display: objectResponse.data.display,
          storageRebate: objectResponse.data.storageRebate,
        };

        setObjectState({
          isChecking: false,
          exists: true,
          info: objectInfo
        });
      } else {
        setObjectState({
          isChecking: false,
          exists: false,
          error: 'Object not found on blockchain'
        });
      }
    } catch (error) {
      console.error('Error checking object existence:', error);
      setObjectState({
        isChecking: false,
        exists: false,
        error: error instanceof Error ? error.message : 'Failed to check object existence'
      });
    }
  }, [validation.isValid, network]);

  // Update validation when value changes
  useEffect(() => {
    const result = validateObjectId(value);
    setValidation(result);
  }, [value]);

  // Check object existence when validation passes and value is complete
  useEffect(() => {
    if (validation.isValid && validation.normalizedId && validation.normalizedId.length === 66) {
      const timeoutId = setTimeout(() => {
        checkObjectExists(validation.normalizedId!);
      }, 500); // Debounce API calls

      return () => clearTimeout(timeoutId);
    } else {
      setObjectState({ isChecking: false, exists: false });
    }
  }, [validation, checkObjectExists]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    
    // Auto-add 0x prefix if user starts typing hex characters
    if (newValue && !newValue.startsWith('0x') && /^[0-9a-fA-F]/.test(newValue)) {
      newValue = '0x' + newValue;
    }
    
    onChange(newValue);
  };

  const handleClear = () => {
    onChange('');
    setObjectState({ isChecking: false, exists: false });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: "Object ID copied successfully",
      });
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const truncateObjectId = (objectId: string) => {
    if (objectId.length <= 10) return objectId;
    return `${objectId.slice(0, 6)}...${objectId.slice(-4)}`;
  };

  const getObjectTypeDisplay = (type?: string) => {
    if (!type) return 'Unknown';
    
    // Extract the struct name from the full type
    const parts = type.split('::');
    if (parts.length >= 3) {
      return parts[parts.length - 1]; // Get the struct name
    }
    return type;
  };

  const getOwnerDisplay = (owner: any) => {
    if (!owner) return 'Unknown';
    
    if (typeof owner === 'string') return truncateObjectId(owner);
    if (owner.AddressOwner) return truncateObjectId(owner.AddressOwner);
    if (owner.ObjectOwner) return `Object: ${truncateObjectId(owner.ObjectOwner)}`;
    if (owner.Shared) return 'Shared';
    if (owner.Immutable) return 'Immutable';
    
    return 'Unknown';
  };

  const getValidationIcon = () => {
    if (!value) return null;
    
    if (objectState.isChecking) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    
    if (!validation.isValid) {
      return <X className="h-4 w-4 text-red-500" />;
    }
    
    if (objectState.exists) {
      return <Check className="h-4 w-4 text-green-500" />;
    }
    
    if (objectState.error) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    
    return <Check className="h-4 w-4 text-green-500" />;
  };

  const getInputBorderColor = () => {
    if (!value) return "";
    
    if (!validation.isValid) return "border-red-500 focus:border-red-500";
    
    if (objectState.isChecking) return "border-blue-500/50 focus:border-blue-500";
    
    if (objectState.exists) return "border-green-500 focus:border-green-500";
    
    if (objectState.error) return "border-yellow-500 focus:border-yellow-500";
    
    return "border-green-500/20";
  };

  const handleObjectSelect = (objectId: string) => {
    onChange(objectId);
    setShowObjectBrowser(false);
    // Trigger verification for the selected object will happen via useEffect
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Input with validation indicators and browse button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={value}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder || `Enter ${expectedType || 'object'} ID (0x...)`}
            disabled={disabled}
            className={cn(
              "pr-10 font-mono text-sm",
              getInputBorderColor()
            )}
          />
          
          {/* Validation indicator */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {getValidationIcon()}
          </div>
        </div>
        
        {/* Packages button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowObjectBrowser(true)}
          disabled={disabled}
          className="gap-1.5"
        >
          <FolderOpen className="h-4 w-4" />
          Packages
        </Button>
      </div>

      {/* Type info and controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">
            {expectedType ? `&${expectedType}` : 'object'}
          </Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                  <Info className="h-3 w-3" />
                  Object Reference
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-2">
                  <div className="font-semibold">Object Reference</div>
                  <div className="text-xs">
                    <div>• Must be a valid object ID</div>
                    <div>• Object must exist on {network}</div>
                    {expectedType && <div>• Expected type: {expectedType}</div>}
                    <div>• Will be verified automatically</div>
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
                title="Copy object ID"
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

          {validation.isValid && validation.normalizedId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => checkObjectExists(validation.normalizedId!)}
              disabled={objectState.isChecking}
              title="Verify object exists"
            >
              {objectState.isChecking ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Search className="h-3 w-3 mr-1" />
              )}
              Verify
            </Button>
          )}
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

      {/* Object verification error */}
      {objectState.error && (
        <div className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span>{objectState.error}</span>
          </div>
        </div>
      )}

      {/* Object information display */}
      {objectState.exists && objectState.info && (
        <div className="text-xs bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md p-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-green-600">
              <Package className="h-3 w-3" />
              Object Found
            </div>
            
            <div className="grid grid-cols-1 gap-1 text-muted-foreground">
              <div className="flex justify-between">
                <span>Type:</span>
                <span className="font-mono">{getObjectTypeDisplay(objectState.info.type)}</span>
              </div>
              
              <div className="flex justify-between">
                <span>Version:</span>
                <span className="font-mono">{objectState.info.version}</span>
              </div>
              
              <div className="flex justify-between">
                <span>Owner:</span>
                <span className="font-mono">{getOwnerDisplay(objectState.info.owner)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-green-200 dark:border-green-800">
              <span className="text-green-600">Verified on {network}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => copyToClipboard(objectState.info!.objectId)}
                  title="Copy object ID"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <a
                  href={`https://explorer.iota.org/object/${objectState.info.objectId}?network=${network}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-500"
                  title="View on IOTA Explorer"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expected type mismatch warning - only show for non-reference types */}
      {expectedType && objectState.exists && objectState.info?.type && 
       !expectedType.startsWith('&') &&
       !objectState.info.type.toLowerCase().includes(expectedType.replace('&', '').toLowerCase()) && (
        <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span>
              Object type "{getObjectTypeDisplay(objectState.info.type)}" may not match expected type "{expectedType}"
            </span>
          </div>
        </div>
      )}
      
      {/* Object Packages Modal */}
      <ObjectBrowser
        open={showObjectBrowser}
        onOpenChange={setShowObjectBrowser}
        onSelectObject={handleObjectSelect}
        expectedType={expectedType}
        network={network}
      />
    </div>
  );
}