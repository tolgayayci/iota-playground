import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { PTBCommand } from '@/components/views/PTBBuilderV3';
import { getAvailableReferences } from '@/lib/ptb-utils';
import { ObjectBrowser } from '@/components/module-interface/inputs/ObjectBrowser';
import { 
  Package, 
  FunctionSquare, 
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Hash,
  Type,
  Link,
  Coins,
  Box,
  CheckCircle,
  Loader2,
  Sparkles,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Search,
  FolderOpen
} from 'lucide-react';

interface PTBAddCommandModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (command: PTBCommand) => void;
  modules: any[];
  selectedPackage: string;
  previousCommands: PTBCommand[];
  isLoadingModules?: boolean;
}

export function PTBAddCommandModal({
  open,
  onOpenChange,
  onSave,
  modules,
  selectedPackage,
  previousCommands,
  isLoadingModules = false
}: PTBAddCommandModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [args, setArgs] = useState<any[]>([]);
  const [typeArgs, setTypeArgs] = useState<string[]>([]);
  const [isParametersOpen, setIsParametersOpen] = useState(true);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [showObjectBrowser, setShowObjectBrowser] = useState(false);
  const [selectedParamIndex, setSelectedParamIndex] = useState<number>(-1);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setSelectedModule('');
      setSelectedFunction('');
      setArgs([]);
      setTypeArgs([]);
      setIsParametersOpen(true);
      setErrors({});
      setShowObjectBrowser(false);
      setSelectedParamIndex(-1);
    }
  }, [open]);

  // Initialize parameters when function is selected
  useEffect(() => {
    if (selectedFunction && selectedFunctionData) {
      // Initialize args based on function parameters
      const initialArgs = selectedFunctionData.parameters.map((param: any) => {
        if (param.type === '&mut 0x2::tx_context::TxContext' || 
            param.type === '&0x2::tx_context::TxContext') {
          return null; // Will be handled by transaction builder
        }
        return { type: 'input', value: '', paramType: param.type };
      }).filter(Boolean);
      setArgs(initialArgs);
    }
  }, [selectedFunction]);

  const availableReferences = getAvailableReferences(previousCommands);
  const selectedModuleData = modules.find(m => m.name === selectedModule);
  const selectedFunctionData = selectedModuleData?.functions.find((f: any) => f.name === selectedFunction);
  
  // Helper to get explorer URL
  const getExplorerUrl = (packageId: string, network: string = 'testnet') => {
    return `https://explorer.iota.org/testnet/object/${packageId}`;
  };

  const validateArgument = (value: any, paramType: any, index: number): string | null => {
    const typeStr = typeof paramType === 'object' ? JSON.stringify(paramType) : String(paramType);
    
    if (!value || (typeof value === 'object' && !value.value && value.type !== 'gas' && value.type !== 'result')) {
      return 'This field is required';
    }

    // Validate address format
    if (typeStr === 'address' && value.type === 'input') {
      const addressValue = value.value;
      if (!addressValue) return 'Address is required';
      if (!addressValue.startsWith('0x')) {
        return 'Address must start with 0x';
      }
      if (addressValue.length !== 66) {
        return 'Address must be 66 characters (0x + 64 hex chars)';
      }
      if (!/^0x[a-fA-F0-9]{64}$/.test(addressValue)) {
        return 'Invalid address format';
      }
    }
    
    // Validate object ID format for object references
    if ((typeStr?.includes('&') || typeStr?.includes('::')) && value.type === 'object') {
      const objectValue = value.value;
      if (!objectValue) return 'Object ID is required';
      if (!objectValue.startsWith('0x')) {
        return 'Object ID must start with 0x';
      }
      if (objectValue.length !== 66) {
        return 'Object ID must be 66 characters (0x + 64 hex chars)';
      }
      if (!/^0x[a-fA-F0-9]{64}$/.test(objectValue)) {
        return 'Invalid object ID format';
      }
    }

    // Validate number types
    if (typeStr?.match(/^u\d+$/) && value.type === 'input') {
      const num = Number(value.value);
      if (isNaN(num)) {
        return 'Must be a valid number';
      }
      if (num < 0) {
        return 'Must be a positive number';
      }
      // Check u8, u16, u32, u64, u128, u256 bounds
      const bits = parseInt(typeStr.substring(1));
      const maxValue = bits === 256 ? BigInt(2) ** BigInt(256) - BigInt(1) : Math.pow(2, bits) - 1;
      if (bits === 256) {
        try {
          const bigValue = BigInt(value.value);
          if (bigValue > maxValue) {
            return `Value exceeds maximum for ${typeStr}`;
          }
        } catch {
          return 'Invalid number for u256';
        }
      } else if (num > maxValue) {
        return `Value exceeds maximum for ${typeStr} (max: ${maxValue})`;
      }
    }

    // Validate boolean
    if (typeStr === 'bool' && value.type === 'input') {
      if (value.value !== 'true' && value.value !== 'false') {
        return 'Must be true or false';
      }
    }

    return null;
  };

  const handleArgumentChange = (index: number, value: any) => {
    const newArgs = [...args];
    newArgs[index] = value;
    setArgs(newArgs);

    // Validate on change
    const param = selectedFunctionData?.parameters[index];
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
    selectedFunctionData?.parameters.forEach((param: any, index: number) => {
      if (param.type === '&mut 0x2::tx_context::TxContext' || 
          param.type === '&0x2::tx_context::TxContext') {
        return; // Skip TxContext
      }
      const error = validateArgument(args[index], param.type, index);
      if (error) {
        newErrors[index] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const command: PTBCommand = {
      id: Date.now().toString(),
      type: 'MoveCall',
      target: `${selectedPackage}::${selectedModule}::${selectedFunction}`,
      module: selectedModule,
      function: selectedFunction,
      arguments: args.filter(Boolean),
      typeArgs: typeArgs.filter(Boolean)
    };

    onSave(command);
    onOpenChange(false);
  };

  const renderParameterInput = (param: any, index: number) => {
    const argValue = args[index] || { type: 'input', value: '' };
    const error = errors[index];

    // Get parameter type display
    const getParamTypeDisplay = (type: any) => {
      // Handle if type is an object (shouldn't happen with our fix, but just in case)
      const typeStr = typeof type === 'object' ? JSON.stringify(type) : String(type);
      
      if (typeStr === 'address') return 'Address';
      if (typeStr === 'bool') return 'Boolean';
      if (typeStr?.match(/^u\d+$/)) return `Number (${typeStr})`;
      if (typeStr?.includes('Coin')) return 'Coin';
      if (typeStr?.includes('&mut')) return 'Mutable Reference';
      if (typeStr?.includes('&')) return 'Object Reference';
      if (typeStr?.includes('::')) {
        // Extract the last part of the type (e.g., "0x2::object::Object" -> "Object")
        const parts = typeStr.split('::');
        return parts[parts.length - 1];
      }
      return typeStr;
    };

    // Get parameter icon
    const getParamIcon = (type: any) => {
      const typeStr = typeof type === 'object' ? JSON.stringify(type) : String(type);
      
      if (typeStr === 'address') return <Hash className="h-3 w-3" />;
      if (typeStr === 'bool') return <CheckCircle className="h-3 w-3" />;
      if (typeStr?.match(/^u\d+$/)) return <Type className="h-3 w-3" />;
      if (typeStr?.includes('Coin')) return <Coins className="h-3 w-3" />;
      if (typeStr?.includes('&')) return <Link className="h-3 w-3" />;
      if (typeStr?.includes('::')) return <Box className="h-3 w-3" />;
      return <Box className="h-3 w-3" />;
    };

    return (
      <div key={index} className="space-y-2 p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getParamIcon(param.type)}
            <Label className="text-sm font-medium">
              {param.name || `Parameter ${index + 1}`}
            </Label>
            <Badge variant="outline" className="text-xs">
              {getParamTypeDisplay(param.type)}
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          {/* Input Type Selector */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={argValue.type === 'input' ? 'secondary' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => handleArgumentChange(index, { type: 'input', value: '', paramType: param.type })}
            >
              Direct Input
            </Button>
            {param.type?.includes('Coin') && (
              <Button
                size="sm"
                variant={argValue.type === 'gas' ? 'secondary' : 'ghost'}
                className="h-7 text-xs"
                onClick={() => handleArgumentChange(index, { type: 'gas' })}
              >
                Gas Coin
              </Button>
            )}
            {availableReferences.length > 0 && (
              <Button
                size="sm"
                variant={argValue.type === 'result' ? 'secondary' : 'ghost'}
                className="h-7 text-xs"
                onClick={() => handleArgumentChange(index, { 
                  type: 'result', 
                  resultFrom: availableReferences[0].resultFrom,
                  value: availableReferences[0].value 
                })}
              >
                Previous Result
              </Button>
            )}
            {(String(param.type)?.includes('&') || 
              String(param.type)?.includes('::') || 
              param.type === 'address') && (
              <Button
                size="sm"
                variant={argValue.type === 'object' ? 'secondary' : 'ghost'}
                className="h-7 text-xs"
                onClick={() => handleArgumentChange(index, { type: 'object', value: '' })}
              >
                Object ID
              </Button>
            )}
          </div>

          {/* Input Field */}
          {argValue.type === 'input' && (
            <div>
              {param.type === 'bool' ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={argValue.value === 'true' ? 'secondary' : 'outline'}
                    onClick={() => handleArgumentChange(index, { ...argValue, value: 'true' })}
                    className="flex-1"
                  >
                    True
                  </Button>
                  <Button
                    size="sm"
                    variant={argValue.value === 'false' ? 'secondary' : 'outline'}
                    onClick={() => handleArgumentChange(index, { ...argValue, value: 'false' })}
                    className="flex-1"
                  >
                    False
                  </Button>
                </div>
              ) : (
                <Input
                  placeholder={
                    param.type === 'address' ? '0x...' :
                    param.type?.match(/^u\d+$/) ? 'Enter number' :
                    'Enter value'
                  }
                  value={argValue.value || ''}
                  onChange={(e) => handleArgumentChange(index, { ...argValue, value: e.target.value })}
                  className={cn("h-8 text-sm font-mono", error && "border-red-500")}
                />
              )}
            </div>
          )}

          {argValue.type === 'gas' && (
            <div className="px-2 py-1 bg-blue-500/10 text-blue-600 rounded text-xs">
              ⛽ Gas coin from transaction
            </div>
          )}

          {argValue.type === 'result' && availableReferences.length > 0 && (
            <select
              className="w-full h-8 px-2 text-sm bg-background border rounded"
              value={argValue.resultFrom || ''}
              onChange={(e) => {
                const ref = availableReferences.find(r => r.resultFrom === parseInt(e.target.value));
                if (ref) {
                  handleArgumentChange(index, { 
                    type: 'result', 
                    resultFrom: ref.resultFrom,
                    value: ref.value 
                  });
                }
              }}
            >
              {availableReferences.map(ref => (
                <option key={ref.resultFrom} value={ref.resultFrom}>
                  Step {(ref.resultFrom || 0) + 1} - {previousCommands[ref.resultFrom || 0]?.function}
                </option>
              ))}
            </select>
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
                <FolderOpen className="h-4 w-4" />
                Packages
              </Button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" />
              {error}
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleObjectSelect = (objectId: string) => {
    if (selectedParamIndex >= 0 && args[selectedParamIndex]) {
      handleArgumentChange(selectedParamIndex, { 
        ...args[selectedParamIndex], 
        value: objectId 
      });
    }
    setShowObjectBrowser(false);
    setSelectedParamIndex(-1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FunctionSquare className="h-5 w-5 text-primary" />
            Add Move Call
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="px-6 py-3 border-b bg-muted/20">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                currentStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                1
              </div>
              <span className={cn("text-sm", currentStep >= 1 ? "text-foreground" : "text-muted-foreground")}>
                Select Function
              </span>
            </div>
            <div className="flex-1 h-[2px] bg-muted mx-2" />
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                currentStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                2
              </div>
              <span className={cn("text-sm", currentStep >= 2 ? "text-foreground" : "text-muted-foreground")}>
                Configure Parameters
              </span>
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[50vh]">
          <div className="p-6 space-y-4">
            {/* Package Info */}
            {selectedPackage && (
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Package:</span>
                  <code className="text-xs font-mono">
                    {selectedPackage.length > 20 
                      ? `${selectedPackage.slice(0, 10)}...${selectedPackage.slice(-8)}`
                      : selectedPackage}
                  </code>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => window.open(getExplorerUrl(selectedPackage), '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Step 1: Select Module and Function */}
            {currentStep === 1 && (
              <>
                {isLoadingModules ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : modules.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No modules found. Make sure the package ID is correct and deployed.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                  {/* Module Selection */}
                  {!selectedModule ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="font-medium">Select a Module</span>
                      </div>
                      <div className="grid gap-2">
                        {modules.map((module) => (
                          <button
                            key={module.name}
                            onClick={() => {
                              setSelectedModule(module.name);
                              setSelectedFunction('');
                              setArgs([]);
                            }}
                            className="group flex items-center justify-between p-3 rounded-lg border text-left transition-all hover:border-primary/50 hover:bg-accent/50"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                                <Package className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="font-medium">{module.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {module.functions.length} function{module.functions.length !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Selected Module Header */}
                      <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Package className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Module</div>
                            <div className="font-medium">{selectedModule}</div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedModule('');
                            setSelectedFunction('');
                            setArgs([]);
                          }}
                        >
                          Change
                        </Button>
                      </div>

                      {/* Function Selection */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <FunctionSquare className="h-4 w-4 text-primary" />
                          <span className="font-medium">Select a Function</span>
                        </div>
                        <div className="grid gap-2">
                          {modules
                            .find(m => m.name === selectedModule)
                            ?.functions.map((func: any) => (
                              <button
                                key={func.name}
                                onClick={() => {
                                  setSelectedFunction(func.name);
                                  // Initialize arguments array based on parameters
                                  setArgs(new Array(func.parameters?.length || 0));
                                }}
                                className={cn(
                                  "group flex items-center justify-between p-3 rounded-lg border text-left transition-all",
                                  selectedFunction === func.name
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/50 hover:bg-accent/50"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "p-2 rounded-lg transition-colors",
                                    selectedFunction === func.name
                                      ? "bg-primary/10 text-primary"
                                      : "bg-muted text-muted-foreground"
                                  )}>
                                    <FunctionSquare className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <div className="font-medium">{func.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                      {func.isEntry && (
                                        <Badge variant="secondary" className="text-xs">
                                          Entry
                                        </Badge>
                                      )}
                                      <Badge variant="outline" className="text-xs">
                                        {func.visibility}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {func.parameters?.length || 0} param{func.parameters?.length !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <ChevronRight className={cn(
                                  "h-4 w-4 transition-opacity",
                                  selectedFunction === func.name
                                    ? "opacity-100"
                                    : "opacity-0 group-hover:opacity-100"
                                )} />
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                )}
              </>
            )}

            {/* Step 2: Configure Parameters */}
            {currentStep === 2 && selectedFunctionData && (
              <div className="space-y-4">
                {/* Selected Function Summary */}
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <FunctionSquare className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Selected Function</div>
                        <div className="font-medium">{selectedModule}::{selectedFunction}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Parameters */}
                {selectedFunctionData.parameters && selectedFunctionData.parameters.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="font-medium">Function Parameters</span>
                      {selectedFunctionData.parameters.filter((p: any) => 
                        !p.type.includes('TxContext')
                      ).length > 0 && (
                        <Badge variant="outline" className="text-xs ml-2">
                          {selectedFunctionData.parameters.filter((p: any) => 
                            !p.type.includes('TxContext')
                          ).length} required
                        </Badge>
                      )}
                    </div>
                    {selectedFunctionData.parameters
                      .filter((p: any) => !p.type.includes('TxContext'))
                      .length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          This function has no parameters
                        </div>
                      ) : (
                        selectedFunctionData.parameters
                          .map((param: any, index: number) => {
                            if (param.type.includes('TxContext')) return null;
                            return renderParameterInput(param, index);
                          })
                          .filter(Boolean)
                      )}
                  </div>
                )}

                {/* Type Arguments */}
                {selectedFunctionData.typeParameters && selectedFunctionData.typeParameters.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Type className="h-4 w-4 text-primary" />
                      <span className="font-medium">Type Arguments</span>
                    </div>
                    {selectedFunctionData.typeParameters.map((typeParam: any, idx: number) => (
                      <div key={idx} className="space-y-2">
                        <Label className="text-sm">Type Parameter {idx + 1}</Label>
                        <Input
                          placeholder="e.g., 0x2::iota::IOTA"
                          className="font-mono"
                          onChange={(e) => {
                            const newTypes = [...typeArgs];
                            newTypes[idx] = e.target.value;
                            setTypeArgs(newTypes);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <div className="flex items-center justify-between w-full">
            <div>
              {currentStep === 2 && (
                <Button
                  variant="ghost"
                  onClick={() => setCurrentStep(1)}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {currentStep === 1 ? (
                <Button 
                  onClick={() => setCurrentStep(2)}
                  disabled={!selectedModule || !selectedFunction}
                  className="gap-2"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  onClick={handleSave}
                  className="gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Add Command
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
      
      {/* Object Packages Modal */}
      <ObjectBrowser
        open={showObjectBrowser}
        onOpenChange={setShowObjectBrowser}
        onSelectObject={handleObjectSelect}
        network="testnet"
      />
    </Dialog>
  );
}