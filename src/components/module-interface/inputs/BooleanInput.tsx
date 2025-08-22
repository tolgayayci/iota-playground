import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { 
  Check, 
  X,
  RotateCcw,
  Info,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface BooleanInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  variant?: 'toggle' | 'select' | 'buttons';
}

export function BooleanInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  variant = 'toggle'
}: BooleanInputProps) {
  const [boolValue, setBoolValue] = useState<boolean | null>(null);

  // Parse string value to boolean
  const parseStringToBool = (str: string): boolean | null => {
    if (!str || str.trim() === '') return null;
    
    const normalized = str.toLowerCase().trim();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    
    return null;
  };

  // Convert boolean to string
  const boolToString = (bool: boolean | null): string => {
    if (bool === null) return '';
    return bool ? 'true' : 'false';
  };

  // Update internal state when value changes
  useEffect(() => {
    const parsed = parseStringToBool(value);
    setBoolValue(parsed);
  }, [value]);

  const handleBoolChange = (newBool: boolean | null) => {
    setBoolValue(newBool);
    onChange(boolToString(newBool));
  };

  const handleClear = () => {
    handleBoolChange(null);
  };

  const getStatusColor = () => {
    if (boolValue === null) return 'text-muted-foreground';
    return boolValue ? 'text-green-600' : 'text-red-600';
  };

  const getStatusIcon = () => {
    if (boolValue === null) return null;
    return boolValue ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />;
  };

  const renderToggleVariant = () => (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <div className={cn("transition-colors", getStatusColor())}>
          {getStatusIcon()}
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium">
            {boolValue === null ? 'Not set' : (boolValue ? 'True' : 'False')}
          </div>
          <div className="text-xs text-muted-foreground">
            {boolValue === null ? 'Click to set value' : `Boolean value: ${boolValue}`}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {boolValue !== null && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleClear}
            title="Clear value"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
        
        <Switch
          checked={boolValue === true}
          onCheckedChange={(checked) => handleBoolChange(checked)}
          disabled={disabled}
          className="data-[state=checked]:bg-green-500"
        />
      </div>
    </div>
  );

  const renderSelectVariant = () => (
    <div className="space-y-2">
      <Select
        value={boolToString(boolValue)}
        onValueChange={(newValue) => {
          if (newValue === '') {
            handleBoolChange(null);
          } else {
            handleBoolChange(newValue === 'true');
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder || "Select true or false"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">
            <span className="text-muted-foreground">Not set</span>
          </SelectItem>
          <SelectItem value="true">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span>True</span>
            </div>
          </SelectItem>
          <SelectItem value="false">
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-red-600" />
              <span>False</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      
      {boolValue !== null && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleClear}
            title="Clear value"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );

  const renderButtonsVariant = () => (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          variant={boolValue === true ? 'default' : 'outline'}
          size="sm"
          className={cn(
            "flex-1",
            boolValue === true && "bg-green-600 hover:bg-green-700"
          )}
          onClick={() => handleBoolChange(true)}
          disabled={disabled}
        >
          <Check className="h-4 w-4 mr-2" />
          True
        </Button>
        
        <Button
          variant={boolValue === false ? 'default' : 'outline'}
          size="sm"
          className={cn(
            "flex-1",
            boolValue === false && "bg-red-600 hover:bg-red-700"
          )}
          onClick={() => handleBoolChange(false)}
          disabled={disabled}
        >
          <X className="h-4 w-4 mr-2" />
          False
        </Button>
      </div>

      {boolValue !== null && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleClear}
            title="Clear selection"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );

  const renderInput = () => {
    switch (variant) {
      case 'select':
        return renderSelectVariant();
      case 'buttons':
        return renderButtonsVariant();
      case 'toggle':
      default:
        return renderToggleVariant();
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Type info and status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">
            bool
          </Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                  <Info className="h-3 w-3" />
                  Boolean Value
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-2">
                  <div className="font-semibold">Boolean Input</div>
                  <div className="text-xs">
                    <div>• Accepts true or false values</div>
                    <div>• Used for conditional parameters</div>
                    <div>• Can be left unset for optional parameters</div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Current value indicator */}
        <div className={cn("flex items-center gap-1 text-xs font-mono", getStatusColor())}>
          {boolValue === null ? (
            <span className="text-muted-foreground">unset</span>
          ) : (
            <>
              {getStatusIcon()}
              <span>{boolValue ? 'true' : 'false'}</span>
            </>
          )}
        </div>
      </div>

      {/* Input component */}
      {renderInput()}

      {/* Helper text */}
      <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
        <div className="space-y-1">
          <div>
            <strong>Current value:</strong> {boolValue === null ? 'Not set' : (boolValue ? 'true' : 'false')}
          </div>
          <div>
            Boolean parameters control conditional behavior in smart contract functions.
          </div>
        </div>
      </div>

      {/* Quick examples */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Common use cases:</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded">
            <div className="flex items-center gap-1 font-medium text-green-600">
              <Check className="h-3 w-3" />
              true
            </div>
            <div className="text-muted-foreground mt-1">
              Enable feature, allow action, confirm operation
            </div>
          </div>
          
          <div className="p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
            <div className="flex items-center gap-1 font-medium text-red-600">
              <X className="h-3 w-3" />
              false
            </div>
            <div className="text-muted-foreground mt-1">
              Disable feature, deny action, skip operation
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}