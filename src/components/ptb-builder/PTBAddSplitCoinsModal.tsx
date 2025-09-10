import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { PTBSplitCoinsCommand } from '@/components/views/PTBBuilderV3';
import { 
  Split,
  Plus,
  Trash2,
  AlertCircle,
  Coins,
  Hash
} from 'lucide-react';

interface PTBAddSplitCoinsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (command: PTBSplitCoinsCommand) => void;
  previousCommands: any[];
  initialCommand?: PTBSplitCoinsCommand;
}

export function PTBAddSplitCoinsModal({
  open,
  onOpenChange,
  onSave,
  previousCommands,
  initialCommand
}: PTBAddSplitCoinsModalProps) {
  const [coin, setCoin] = useState<any>({ type: 'gas', value: '' });
  const [amounts, setAmounts] = useState<any[]>([{ type: 'input', value: '' }]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset state when modal opens or load initial command
  useEffect(() => {
    if (open) {
      if (initialCommand) {
        // Load data from initial command for editing
        setCoin(initialCommand.coin || { type: 'gas', value: '' });
        setAmounts(initialCommand.amounts || [{ type: 'input', value: '' }]);
      } else {
        // Reset for new command
        setCoin({ type: 'gas', value: '' });
        setAmounts([{ type: 'input', value: '' }]);
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

  const validateAmount = (value: string): string | null => {
    if (!value) return 'Amount is required';
    const num = Number(value);
    if (isNaN(num)) return 'Amount must be a valid number';
    if (num <= 0) return 'Amount must be greater than 0';
    if (!Number.isInteger(num)) return 'Amount must be a whole number';
    return null;
  };

  const handleAddAmount = () => {
    setAmounts([...amounts, { type: 'input', value: '' }]);
  };

  const handleRemoveAmount = (index: number) => {
    if (amounts.length > 1) {
      setAmounts(amounts.filter((_, i) => i !== index));
      // Clear error for removed amount
      const newErrors = { ...errors };
      delete newErrors[`amount_${index}`];
      setErrors(newErrors);
    }
  };

  const handleCoinChange = (newValue: any) => {
    setCoin(newValue);

    // Validate if it's a coin object ID
    if (newValue.type === 'object') {
      const error = validateCoinId(newValue.value);
      setErrors(prev => {
        const newErrors = { ...prev };
        if (error) {
          newErrors['coin'] = error;
        } else {
          delete newErrors['coin'];
        }
        return newErrors;
      });
    } else {
      // Clear error for gas or result types
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors['coin'];
        return newErrors;
      });
    }
  };

  const handleAmountChange = (index: number, newValue: any) => {
    const newAmounts = [...amounts];
    newAmounts[index] = newValue;
    setAmounts(newAmounts);

    // Validate if it's a direct input
    if (newValue.type === 'input') {
      const error = validateAmount(newValue.value);
      setErrors(prev => {
        const newErrors = { ...prev };
        if (error) {
          newErrors[`amount_${index}`] = error;
        } else {
          delete newErrors[`amount_${index}`];
        }
        return newErrors;
      });
    } else {
      // Clear error for result references
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`amount_${index}`];
        return newErrors;
      });
    }
  };

  const handleSave = () => {
    // Validate all fields
    const newErrors: Record<string, string> = {};

    // Validate coin
    if (coin.type === 'object') {
      const error = validateCoinId(coin.value);
      if (error) {
        newErrors['coin'] = error;
      }
    } else if (coin.type === 'result' && coin.resultFrom === undefined) {
      newErrors['coin'] = 'Please select a result source';
    }

    // Validate amounts
    amounts.forEach((amt, index) => {
      if (amt.type === 'input') {
        const error = validateAmount(amt.value);
        if (error) {
          newErrors[`amount_${index}`] = error;
        }
      } else if (amt.type === 'result' && amt.resultFrom === undefined) {
        newErrors[`amount_${index}`] = 'Please select a result source';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const command: PTBSplitCoinsCommand = {
      id: Date.now().toString(),
      type: 'SplitCoins',
      coin: {
        ...coin,
        paramType: 'coin'
      },
      amounts: amounts.map(amt => ({
        ...amt,
        paramType: 'u64'
      }))
    };

    onSave(command);
    onOpenChange(false);
  };

  const renderCoinInput = () => {
    const error = errors['coin'];

    return (
      <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Coin to Split</Label>
          <Badge variant="outline" className="text-xs">Required</Badge>
        </div>

        <div className="space-y-2">
          {/* Type selector */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={coin.type === 'gas' ? 'secondary' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => handleCoinChange({ type: 'gas', value: '' })}
            >
              Gas Coin
            </Button>
            <Button
              size="sm"
              variant={coin.type === 'object' ? 'secondary' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => handleCoinChange({ type: 'object', value: '' })}
            >
              Coin Object
            </Button>
            {availableResults.length > 0 && (
              <Button
                size="sm"
                variant={coin.type === 'result' ? 'secondary' : 'ghost'}
                className="h-7 text-xs"
                onClick={() => handleCoinChange({ 
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
          {coin.type === 'gas' && (
            <div className="px-2 py-1 bg-blue-500/10 text-blue-600 rounded text-xs">
              ⛽ Using gas coin from transaction
            </div>
          )}

          {coin.type === 'object' && (
            <Input
              placeholder="Coin object ID (0x...)"
              value={coin.value || ''}
              onChange={(e) => handleCoinChange({ ...coin, value: e.target.value })}
              className={cn("h-8 text-sm font-mono", error && "border-red-500")}
            />
          )}

          {coin.type === 'result' && availableResults.length > 0 && (
            <select
              className="w-full h-8 px-2 text-sm bg-background border rounded"
              value={coin.resultFrom ?? ''}
              onChange={(e) => {
                const resultIndex = parseInt(e.target.value);
                const result = availableResults.find(r => r.index === resultIndex);
                if (result) {
                  handleCoinChange({ 
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

  const renderAmountInput = (amt: any, index: number) => {
    const error = errors[`amount_${index}`];

    return (
      <div key={index} className="space-y-2 p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Amount {index + 1}</Label>
            <Badge variant="outline" className="text-xs">MIST</Badge>
          </div>
          {amounts.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleRemoveAmount(index)}
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
              variant={amt.type === 'input' ? 'secondary' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => handleAmountChange(index, { type: 'input', value: '' })}
            >
              Direct Input
            </Button>
            {availableResults.length > 0 && (
              <Button
                size="sm"
                variant={amt.type === 'result' ? 'secondary' : 'ghost'}
                className="h-7 text-xs"
                onClick={() => handleAmountChange(index, { 
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
          {amt.type === 'input' && (
            <Input
              type="number"
              placeholder="Amount in MIST (e.g., 1000000 = 0.001 IOTA)"
              value={amt.value || ''}
              onChange={(e) => handleAmountChange(index, { ...amt, value: e.target.value })}
              className={cn("h-8 text-sm", error && "border-red-500")}
              min="1"
            />
          )}

          {amt.type === 'result' && availableResults.length > 0 && (
            <select
              className="w-full h-8 px-2 text-sm bg-background border rounded"
              value={amt.resultFrom ?? ''}
              onChange={(e) => {
                const resultIndex = parseInt(e.target.value);
                const result = availableResults.find(r => r.index === resultIndex);
                if (result) {
                  handleAmountChange(index, { 
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
            <Split className="h-5 w-5 text-primary" />
            Split Coins
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="p-6 space-y-4">
            {/* Info Alert */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Split a coin into multiple smaller coins with specified amounts. The original coin will have the remaining balance after splitting.
                <br />
                <span className="text-xs text-muted-foreground mt-1 block">
                  1 IOTA = 1,000,000,000 MIST
                </span>
              </AlertDescription>
            </Alert>

            {/* Coin Section */}
            <div className="space-y-3">
              <Label>Source Coin</Label>
              {renderCoinInput()}
            </div>

            {/* Amounts Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Split Amounts</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddAmount}
                  className="h-8 gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Amount
                </Button>
              </div>

              {amounts.map((amt, index) => renderAmountInput(amt, index))}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Split className="h-4 w-4" />
            Add Split
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}