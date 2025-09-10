import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { 
  FunctionSquare,
  Package,
  AlertCircle,
  Hash,
  Type,
  Coins,
  Box,
  CheckCircle,
  Loader2,
  ExternalLink,
  Link,
  Search,
} from 'lucide-react';
import { getAvailableReferences } from '@/lib/ptb-utils';
import { ObjectBrowser } from '@/components/module-interface/inputs/ObjectBrowser';

interface PTBCommand {
  id: string;
  type: 'MoveCall';
  target: string;
  module: string;
  function: string;
  arguments?: any[];
  typeArguments?: string[];
  description?: string;
}

interface ModuleInfo {
  name: string;
  functions: FunctionInfo[];
}

interface FunctionInfo {
  name: string;
  visibility: string;
  isEntry?: boolean;
  is_entry?: boolean;
  parameters: Array<{
    name: string;
    type: string;
  }>;
  typeParameters?: any[];
  returnTypes?: string[];
}

interface PTBAddMoveCallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (command: PTBCommand) => void;
  modules: ModuleInfo[];
  selectedPackage: string;
  previousCommands: PTBCommand[];
  isLoadingModules?: boolean;
  initialCommand?: PTBMoveCallCommand;
}

export function PTBAddMoveCallModal({
  open,
  onOpenChange,
  onSave,
  modules,
  selectedPackage,
  previousCommands,
  isLoadingModules = false,
  initialCommand
}: PTBAddMoveCallModalProps) {
  // State
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [args, setArgs] = useState<any[]>([]);
  const [typeArgs, setTypeArgs] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [showObjectBrowser, setShowObjectBrowser] = useState(false);
  const [selectedParamIndex, setSelectedParamIndex] = useState<number>(-1);

  // Get available references from previous commands
  const availableReferences = useMemo(() => 
    getAvailableReferences(previousCommands),
    [previousCommands]
  );

  // Get selected module and function data
  const selectedModuleData = useMemo(() => 
    modules.find(m => m.name === selectedModule),
    [modules, selectedModule]
  );
  
  const selectedFunctionData = useMemo(() => 
    selectedModuleData?.functions.find(f => f.name === selectedFunction),
    [selectedModuleData, selectedFunction]
  );

  // Reset state when modal opens or load initial command
  useEffect(() => {
    if (open) {
      if (initialCommand) {
        // Load data from initial command for editing
        setSelectedModule(initialCommand.module || '');
        setSelectedFunction(initialCommand.function || '');
        setArgs(initialCommand.arguments || []);
        setTypeArgs(initialCommand.typeArguments || []);
      } else {
        // Reset for new command
        setSelectedModule('');
        setSelectedFunction('');
        setArgs([]);
        setTypeArgs([]);
      }
      setErrors({});
    }
  }, [open, initialCommand]);

  // Initialize parameters when function is selected (only for new commands, not when editing)
  useEffect(() => {
    if (selectedFunctionData && !initialCommand) {
      const initialArgs = selectedFunctionData.parameters
        .filter(param => !param.type.includes('TxContext'))
        .map(param => ({ 
          // Default to 'object' type for reference parameters
          type: param.type?.startsWith('&') ? 'object' : 'input', 
          value: '', 
          paramType: param.type 
        }));
      setArgs(initialArgs);
      
      // Initialize type arguments if any
      if (selectedFunctionData.typeParameters) {
        setTypeArgs(new Array(selectedFunctionData.typeParameters.length).fill(''));
      }
    }
  }, [selectedFunctionData, initialCommand]);
  
  // Reset result type to input if no previous commands available
  useEffect(() => {
    if (previousCommands.length === 0 && args.some(arg => arg?.type === 'result')) {
      const updatedArgs = args.map(arg => 
        arg?.type === 'result' ? { type: 'input', value: '', paramType: arg.paramType } : arg
      );
      setArgs(updatedArgs);
    }
  }, [previousCommands]);

  // Validation
  const validateArgument = (value: any, paramType: string, index: number): string | null => {
    if (!value || (typeof value === 'object' && !value.value && value.type !== 'gas' && value.type !== 'result')) {
      return 'This field is required';
    }

    // Validate object ID format for object type
    if (value.type === 'object') {
      const objectValue = value.value;
      if (!objectValue) return 'Object ID is required';
      if (!objectValue.startsWith('0x')) return 'Object ID must start with 0x';
      if (objectValue.length !== 66) return 'Object ID must be 66 characters';
      if (!/^0x[a-fA-F0-9]{64}$/.test(objectValue)) return 'Invalid object ID format';
    }

    // Validate address format
    if (paramType === 'address' && value.type === 'input') {
      const addressValue = value.value;
      if (!addressValue) return 'Address is required';
      if (!addressValue.startsWith('0x')) return 'Address must start with 0x';
      if (addressValue.length !== 66) return 'Address must be 66 characters';
      if (!/^0x[a-fA-F0-9]{64}$/.test(addressValue)) return 'Invalid address format';
    }
    
    // Validate numbers
    if (paramType?.match(/^u\d+$/) && value.type === 'input') {
      const num = Number(value.value);
      if (isNaN(num)) return 'Must be a valid number';
      if (num < 0) return 'Must be a positive number';
      
      const bits = parseInt(paramType.substring(1));
      const maxValue = bits === 256 ? BigInt(2) ** BigInt(256) - BigInt(1) : Math.pow(2, bits) - 1;
      
      if (bits === 256) {
        try {
          const bigValue = BigInt(value.value);
          if (bigValue > maxValue) return `Value exceeds maximum for ${paramType}`;
        } catch {
          return 'Invalid number for u256';
        }
      } else if (num > maxValue) {
        return `Value exceeds maximum for ${paramType} (max: ${maxValue})`;
      }
    }

    // Validate boolean
    if (paramType === 'bool' && value.type === 'input') {
      if (value.value !== 'true' && value.value !== 'false') {
        return 'Must be true or false';
      }
    }

    // Validate reference types must use object type
    if (paramType?.startsWith('&')) {
      if (value.type === 'input') {
        // If it's a reference type but using input type, validate as object ID
        const objectValue = value.value;
        if (!objectValue) return 'Object ID is required for reference types';
        if (!objectValue.startsWith('0x')) return 'Object ID must start with 0x';
        if (objectValue.length !== 66) return 'Object ID must be 66 characters';
        if (!/^0x[a-fA-F0-9]{64}$/.test(objectValue)) return 'Invalid object ID format';
      }
    }

    return null;
  };

  const handleArgumentChange = (index: number, value: any) => {
    const newArgs = [...args];
    newArgs[index] = value;
    setArgs(newArgs);

    // Validate on change
    const param = selectedFunctionData?.parameters.filter(p => !p.type.includes('TxContext'))[index];
    if (param) {
      const error = validateArgument(value, param.type, index);
      setErrors(prev => {
        const newErrors = { ...prev };
        if (error) {
          newErrors[index] = error;
        } else {
          delete newErrors[index];
        }
        return newErrors;
      });
    }
  };

  const handleSave = () => {
    // Validate all arguments
    const newErrors: Record<number, string> = {};
    const filteredParams = selectedFunctionData?.parameters.filter(p => !p.type.includes('TxContext')) || [];
    
    filteredParams.forEach((param, index) => {
      const error = validateArgument(args[index], param.type, index);
      if (error) {
        newErrors[index] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Store the isEntry flag separately to not include it in the command
    const isEntry = !!(selectedFunctionData?.isEntry || selectedFunctionData?.is_entry);

    const command: PTBCommand = {
      id: Date.now().toString(),
      type: 'MoveCall',
      target: `${selectedPackage}::${selectedModule}::${selectedFunction}`,
      module: selectedModule,
      function: selectedFunction,
      arguments: args,
      typeArguments: typeArgs.filter(Boolean),
      // Store isEntry for reference but it shouldn't be part of the transaction
      ...(isEntry && { isEntry }),
    };

    onSave(command);
    onOpenChange(false);
  };

  // Helper functions for parameter display
  const getParamTypeDisplay = (type: string) => {
    // For primitive types, keep simplified display
    if (type === 'address') return 'Address';
    if (type === 'bool') return 'Boolean';
    if (type?.match(/^u\d+$/)) return type; // Show u8, u64, etc. as-is
    
    // For complex types, show full type signature
    if (type?.includes('::') || type?.includes('&') || type?.includes('Coin')) {
      return type; // Return full type like 0x2::coin::Coin<0x2::iota::IOTA>
    }
    
    return type;
  };

  const getParamIcon = (type: string) => {
    if (type === 'address') return <Hash className="h-3 w-3" />;
    if (type === 'bool') return <CheckCircle className="h-3 w-3" />;
    if (type?.match(/^u\d+$/)) return <Type className="h-3 w-3" />;
    if (type?.includes('Coin')) return <Coins className="h-3 w-3" />;
    if (type?.includes('&')) return <Link className="h-3 w-3" />;
    return <Box className="h-3 w-3" />;
  };

  const renderParameterInput = (param: any, index: number) => {
    // Default to 'object' type for reference parameters
    const defaultType = param.type?.startsWith('&') ? 'object' : 'input';
    const argValue = args[index] || { type: defaultType, value: '', paramType: param.type };
    const error = errors[index];
    const typeDisplay = getParamTypeDisplay(param.type);
    const isLongType = typeDisplay.length > 40;

    return (
      <div key={index} className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm flex items-center gap-2 flex-1 min-w-0">
            {getParamIcon(param.type)}
            <span>{param.name || `Param ${index + 1}`}</span>
            <Badge 
              variant="outline" 
              className="text-xs ml-1 max-w-[300px] truncate"
              title={isLongType ? typeDisplay : undefined}
            >
              {isLongType ? `${typeDisplay.substring(0, 35)}...` : typeDisplay}
            </Badge>
          </Label>
          
          {/* Input type selector */}
          <div className="flex gap-1 flex-shrink-0">
            {/* Only show Input button for non-reference types */}
            {!param.type?.startsWith('&') && (
              <Button
                size="sm"
                variant={argValue.type === 'input' ? 'default' : 'ghost'}
                className="h-6 px-2 text-xs"
                onClick={() => handleArgumentChange(index, { type: 'input', value: '', paramType: param.type })}
              >
                Input
              </Button>
            )}
            
            {param.type?.includes('Coin') && (
              <Button
                size="sm"
                variant={argValue.type === 'gas' ? 'default' : 'ghost'}
                className="h-6 px-2 text-xs"
                onClick={() => handleArgumentChange(index, { type: 'gas' })}
              >
                Gas
              </Button>
            )}
            
            {availableReferences.length > 0 && previousCommands.length > 0 && (
              <Button
                size="sm"
                variant={argValue.type === 'result' ? 'default' : 'ghost'}
                className="h-6 px-2 text-xs"
                onClick={() => {
                  if (availableReferences.length > 0) {
                    handleArgumentChange(index, { 
                      type: 'result', 
                      resultFrom: availableReferences[0].resultFrom,
                      value: availableReferences[0].value 
                    });
                  }
                }}
              >
                Result
              </Button>
            )}
            
            {(param.type?.includes('&') || param.type?.includes('::') || param.type === 'address') && (
              <Button
                size="sm"
                variant={argValue.type === 'object' ? 'default' : 'ghost'}
                className="h-6 px-2 text-xs"
                onClick={() => handleArgumentChange(index, { type: 'object', value: '', paramType: param.type })}
              >
                Object
              </Button>
            )}
          </div>
        </div>

        {/* Input field based on type */}
        {argValue.type === 'input' && (
          <>
            {param.type === 'bool' ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={argValue.value === 'true' ? 'default' : 'outline'}
                  onClick={() => handleArgumentChange(index, { ...argValue, value: 'true' })}
                  className="flex-1 h-8"
                >
                  True
                </Button>
                <Button
                  size="sm"
                  variant={argValue.value === 'false' ? 'default' : 'outline'}
                  onClick={() => handleArgumentChange(index, { ...argValue, value: 'false' })}
                  className="flex-1 h-8"
                >
                  False
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder={
                    param.type === 'address' ? '0x...' :
                    param.type?.match(/^u\d+$/) ? 'Enter number' :
                    'Enter value'
                  }
                  value={argValue.value || ''}
                  onChange={(e) => handleArgumentChange(index, { ...argValue, value: e.target.value })}
                  className={cn("h-8 text-sm font-mono flex-1", error && "border-red-500")}
                />
                {param.type === 'address' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={() => {
                      setSelectedParamIndex(index);
                      setShowObjectBrowser(true);
                    }}
                  >
                    <Search className="h-3 w-3" />
                    Browse
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {argValue.type === 'gas' && (
          <div className="px-3 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md text-xs font-medium">
            Gas coin from transaction
          </div>
        )}
        
        {argValue.type === 'object' && (
          <div className="flex gap-2">
            <Input
              placeholder="Object ID (0x...)"
              value={argValue.value || ''}
              onChange={(e) => handleArgumentChange(index, { ...argValue, value: e.target.value })}
              className={cn("h-8 text-sm font-mono flex-1", error && "border-red-500")}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => {
                setSelectedParamIndex(index);
                setShowObjectBrowser(true);
              }}
            >
              <Search className="h-3 w-3" />
              Browse
            </Button>
          </div>
        )}

        {argValue.type === 'result' && availableReferences.length > 0 && previousCommands.length > 0 && (
          <Select
            value={String(argValue.resultFrom || '')}
            onValueChange={(value) => {
              const ref = availableReferences.find(r => r.resultFrom === parseInt(value));
              if (ref) {
                handleArgumentChange(index, { 
                  type: 'result', 
                  resultFrom: ref.resultFrom,
                  value: ref.value 
                });
              }
            }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select previous result" />
            </SelectTrigger>
            <SelectContent>
              {availableReferences.map(ref => {
                const stepIndex = ref.resultFrom || 0;
                const command = previousCommands[stepIndex];
                return (
                  <SelectItem key={ref.resultFrom} value={String(ref.resultFrom)}>
                    Step {stepIndex + 1} - {command?.function || 'Unknown'}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}

        {error && (
          <div className="flex items-center gap-1 text-xs text-red-500">
            <AlertCircle className="h-3 w-3" />
            {error}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FunctionSquare className="h-5 w-5 text-primary" />
            Add Move Call
          </DialogTitle>
        </DialogHeader>

        {/* Package Info */}
        {selectedPackage && (
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Package:</span>
              <code className="text-xs font-mono">
                {selectedPackage.slice(0, 10)}...{selectedPackage.slice(-8)}
              </code>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => window.open(`https://explorer.iota.org/testnet/object/${selectedPackage}`, '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {/* Module Selection */}
          <div className="space-y-2">
            <Label>Module</Label>
            {isLoadingModules ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : modules.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No modules found. Make sure the package is deployed.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a module" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map(module => (
                    <SelectItem key={module.name} value={module.name}>
                      <div className="flex items-center justify-between w-full">
                        <span>{module.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {module.functions.length} functions
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Function Selection */}
          {selectedModule && (
            <div className="space-y-2">
              <Label>Function</Label>
              <Select value={selectedFunction} onValueChange={setSelectedFunction}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a function" />
                </SelectTrigger>
                <SelectContent>
                  {selectedModuleData?.functions.map(func => (
                    <SelectItem key={func.name} value={func.name}>
                      <div className="flex items-center gap-2">
                        <span>{func.name}</span>
                        {(func.isEntry || func.is_entry) && (
                          <Badge variant="secondary" className="text-xs">
                            Entry
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {func.visibility}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Parameters */}
          {selectedFunctionData && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Parameters</Label>
                <span className="text-xs text-muted-foreground">
                  {selectedFunctionData.parameters.filter(p => !p.type.includes('TxContext')).length} required
                </span>
              </div>
              
              {selectedFunctionData.parameters
                .filter(p => !p.type.includes('TxContext'))
                .length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded-lg">
                    This function has no parameters
                  </div>
                ) : (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                    {selectedFunctionData.parameters
                      .filter(p => !p.type.includes('TxContext'))
                      .map((param, index) => renderParameterInput(param, index))
                    }
                  </div>
                )}
            </div>
          )}

          {/* Type Arguments */}
          {selectedFunctionData?.typeParameters && selectedFunctionData.typeParameters.length > 0 && (
            <div className="space-y-3">
              <Label>Type Arguments</Label>
              {selectedFunctionData.typeParameters.map((_, idx) => (
                <Input
                  key={idx}
                  placeholder="e.g., 0x2::iota::IOTA"
                  className="font-mono text-sm"
                  value={typeArgs[idx] || ''}
                  onChange={(e) => {
                    const newTypes = [...typeArgs];
                    newTypes[idx] = e.target.value;
                    setTypeArgs(newTypes);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!selectedModule || !selectedFunction || isLoadingModules}
          >
            Add Command
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Object Browser Modal */}
    <ObjectBrowser
      open={showObjectBrowser}
      onOpenChange={setShowObjectBrowser}
      onSelectObject={(objectId) => {
        if (selectedParamIndex >= 0 && selectedParamIndex < args.length) {
          handleArgumentChange(selectedParamIndex, {
            ...args[selectedParamIndex],
            value: objectId
          });
        }
        setShowObjectBrowser(false);
        setSelectedParamIndex(-1);
      }}
      network="testnet"
    />
  </>
  );
}
