import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { PTBMergeCoinsCommand } from '@/components/views/PTBBuilderV3';
import { 
  Merge,
  Plus,
  Trash2,
  AlertCircle,
  Coins,
  ArrowDown
} from 'lucide-react';

interface PTBAddMergeCoinsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (command: PTBMergeCoinsCommand) => void;
  previousCommands: any[];
  initialCommand?: PTBMergeCoinsCommand;
}

export function PTBAddMergeCoinsModal({
  open,
  onOpenChange,
  onSave,
  previousCommands,
  initialCommand
}: PTBAddMergeCoinsModalProps) {
  const [destination, setDestination] = useState<any>({ type: 'gas', value: '' });
  const [sources, setSources] = useState<any[]>([{ type: 'object', value: '' }]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset state when modal opens or load initial command
  useEffect(() => {
    if (open) {
      if (initialCommand) {
        // Load data from initial command for editing
        setDestination(initialCommand.destination || { type: 'gas', value: '' });
        setSources(initialCommand.sources || [{ type: 'object', value: '' }]);
      } else {
        // Reset for new command
        setDestination({ type: 'gas', value: '' });
        setSources([{ type: 'object', value: '' }]);
      }
      setErrors({});
    }
  }, [open, initialCommand]);

  // Get available results from previous commands that could be coins
  const availableResults = previousCommands
    .map((cmd, index) => {
      if (cmd.type === 'MoveCall' || cmd.type === 'SplitCoins') {
        return {
          index,
          command: cmd,
          label: `Step ${index + 1} - ${cmd.type === 'MoveCall' ? `${cmd.module}::${cmd.function}` : 'SplitCoins'}`
        };
      }
      return null;
    })
    .filter(Boolean);

  const validateCoinId = (value: string): string | null => {
    if (!value) return 'Coin ID is required';
    if (!value.startsWith('0x')) return 'Coin ID must start with 0x';
    if (value.length !== 66) return 'Coin ID must be 66 characters (0x + 64 hex)';
    if (!/^0x[a-fA-F0-9]{64}$/.test(value)) return 'Invalid coin ID format';
    return null;
  };

  const handleAddSource = () => {
    setSources([...sources, { type: 'object', value: '' }]);
  };

  const handleRemoveSource = (index: number) => {
    if (sources.length > 1) {
      setSources(sources.filter((_, i) => i !== index));
      // Clear error for removed source
      const newErrors = { ...errors };
      delete newErrors[`source_${index}`];
      setErrors(newErrors);
    }
  };

  const handleDestinationChange = (newValue: any) => {
    setDestination(newValue);

    // Validate if it's a coin object ID
    if (newValue.type === 'object') {
      const error = validateCoinId(newValue.value);
      setErrors(prev => {
        const newErrors = { ...prev };
        if (error) {
          newErrors['destination'] = error;
        } else {
          delete newErrors['destination'];
        }
        return newErrors;
      });
    } else {
      // Clear error for gas or result types
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors['destination'];
        return newErrors;
      });
    }
  };

  const handleSourceChange = (index: number, newValue: any) => {
    const newSources = [...sources];
    newSources[index] = newValue;
    setSources(newSources);

    // Validate if it's a coin object ID
    if (newValue.type === 'object') {
      const error = validateCoinId(newValue.value);
      setErrors(prev => {
        const newErrors = { ...prev };
        if (error) {
          newErrors[`source_${index}`] = error;
        } else {
          delete newErrors[`source_${index}`];
        }
        return newErrors;
      });
    } else {
      // Clear error for result references
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`source_${index}`];
        return newErrors;
      });
    }
  };

  const handleSave = () => {
    // Validate all fields
    const newErrors: Record<string, string> = {};

    // Validate destination
    if (destination.type === 'object') {
      const error = validateCoinId(destination.value);
      if (error) {
        newErrors['destination'] = error;
      }
    } else if (destination.type === 'result' && destination.resultFrom === undefined) {
      newErrors['destination'] = 'Please select a result source';
    }

    // Validate sources
    sources.forEach((src, index) => {
      if (src.type === 'object') {
        const error = validateCoinId(src.value);
        if (error) {
          newErrors[`source_${index}`] = error;
        }
      } else if (src.type === 'result' && src.resultFrom === undefined) {
        newErrors[`source_${index}`] = 'Please select a result source';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const command: PTBMergeCoinsCommand = {
      id: Date.now().toString(),
      type: 'MergeCoins',
      destination: {
        ...destination,
        paramType: 'coin'
      },
      sources: sources.map(src => ({
        ...src,
        paramType: 'coin'
      }))
    };

    onSave(command);
    onOpenChange(false);
  };

  const renderDestinationInput = () => {
    const error = errors['destination'];

    return (
      <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Destination Coin</Label>
          <Badge variant="outline" className="text-xs">Receives merged value</Badge>
        </div>

        <div className="space-y-2">
          {/* Type selector */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={destination.type === 'gas' ? 'secondary' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => handleDestinationChange({ type: 'gas', value: '' })}
            >
              Gas Coin
            </Button>
            <Button
              size="sm"
              variant={destination.type === 'object' ? 'secondary' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => handleDestinationChange({ type: 'object', value: '' })}
            >
              Coin Object
            </Button>
            {availableResults.length > 0 && (
              <Button
                size="sm"
                variant={destination.type === 'result' ? 'secondary' : 'ghost'}
                className="h-7 text-xs"
                onClick={() => handleDestinationChange({ 
                  type: 'result', 
                  resultFrom: availableResults[0].index,
                  value: availableResults[0].label 
                })}
              >
                Previous Result
              </Button>
            )}
          </div>

          {/* Input field */}
          {destination.type === 'gas' && (
            <div className="px-2 py-1 bg-blue-500/10 text-blue-600 rounded text-xs">
              ⛽ Using gas coin from transaction
            </div>
          )}

          {destination.type === 'object' && (
            <Input
              placeholder="Coin object ID (0x...)"
              value={destination.value || ''}
              onChange={(e) => handleDestinationChange({ ...destination, value: e.target.value })}
              className={cn("h-8 text-sm font-mono", error && "border-red-500")}
            />
          )}

          {destination.type === 'result' && availableResults.length > 0 && (
            <select
              className="w-full h-8 px-2 text-sm bg-background border rounded"
              value={destination.resultFrom ?? ''}
              onChange={(e) => {
                const resultIndex = parseInt(e.target.value);
                const result = availableResults.find(r => r.index === resultIndex);
                if (result) {
                  handleDestinationChange({ 
                    type: 'result', 
                    resultFrom: result.index,
                    value: result.label 
                  });
                }
              }}
            >
              {availableResults.map(result => (
                <option key={result.index} value={result.index}>
                  {result.label}
                </option>
              ))}
            </select>
          )}

          {/* Error message */}
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

  const renderSourceInput = (src: any, index: number) => {
    const error = errors[`source_${index}`];

    return (
      <div key={index} className="space-y-2 p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Source Coin {index + 1}</Label>
          </div>
          {sources.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleRemoveSource(index)}
              className="h-7 w-7 p-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {/* Type selector */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={src.type === 'object' ? 'secondary' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => handleSourceChange(index, { type: 'object', value: '' })}
            >
              Coin Object
            </Button>
            {availableResults.length > 0 && (
              <Button
                size="sm"
                variant={src.type === 'result' ? 'secondary' : 'ghost'}
                className="h-7 text-xs"
                onClick={() => handleSourceChange(index, { 
                  type: 'result', 
                  resultFrom: availableResults[0].index,
                  value: availableResults[0].label 
                })}
              >
                Previous Result
              </Button>
            )}
          </div>

          {/* Input field */}
          {src.type === 'object' && (
            <Input
              placeholder="Coin object ID (0x...)"
              value={src.value || ''}
              onChange={(e) => handleSourceChange(index, { ...src, value: e.target.value })}
              className={cn("h-8 text-sm font-mono", error && "border-red-500")}
            />
          )}

          {src.type === 'result' && availableResults.length > 0 && (
            <select
              className="w-full h-8 px-2 text-sm bg-background border rounded"
              value={src.resultFrom ?? ''}
              onChange={(e) => {
                const resultIndex = parseInt(e.target.value);
                const result = availableResults.find(r => r.index === resultIndex);
                if (result) {
                  handleSourceChange(index, { 
                    type: 'result', 
                    resultFrom: result.index,
                    value: result.label 
                  });
                }
              }}
            >
              {availableResults.map(result => (
                <option key={result.index} value={result.index}>
                  {result.label}
                </option>
              ))}
            </select>
          )}

          {/* Error message */}
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5 text-primary" />
            Merge Coins
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="p-6 space-y-4">
            {/* Info Alert */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Merge multiple coins of the same type into a single coin. The destination coin will receive the combined balance of all source coins.
                Source coins will be destroyed after merging.
              </AlertDescription>
            </Alert>

            {/* Destination Section */}
            <div className="space-y-3">
              <Label>Destination (Receives Merged Value)</Label>
              {renderDestinationInput()}
            </div>

            {/* Visual Separator */}
            <div className="flex items-center justify-center py-2">
              <ArrowDown className="h-5 w-5 text-muted-foreground" />
            </div>

            {/* Sources Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Source Coins (To Be Merged)</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddSource}
                  className="h-8 gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Source
                </Button>
              </div>

              {sources.map((src, index) => renderSourceInput(src, index))}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Merge className="h-4 w-4" />
            Add Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}