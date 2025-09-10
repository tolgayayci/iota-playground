import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { PTBTransferObjectsCommand } from '@/components/views/PTBBuilderV3';
import { 
  Send,
  Plus,
  Trash2,
  AlertCircle,
  Hash,
  Box,
  Coins,
  Link
} from 'lucide-react';

interface PTBAddTransferObjectsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (command: PTBTransferObjectsCommand) => void;
  previousCommands: any[];
  initialCommand?: PTBTransferObjectsCommand;
}

export function PTBAddTransferObjectsModal({
  open,
  onOpenChange,
  onSave,
  previousCommands,
  initialCommand
}: PTBAddTransferObjectsModalProps) {
  const [objects, setObjects] = useState<any[]>([{ type: 'object', value: '' }]);
  const [recipient, setRecipient] = useState<any>({ type: 'input', value: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset state when modal opens or load initial command
  useEffect(() => {
    if (open) {
      if (initialCommand) {
        // Load data from initial command for editing
        setObjects(initialCommand.objects || [{ type: 'object', value: '' }]);
        setRecipient(initialCommand.recipient || { type: 'input', value: '' });
      } else {
        // Reset for new command
        setObjects([{ type: 'object', value: '' }]);
        setRecipient({ type: 'input', value: '' });
      }
      setErrors({});
    }
  }, [open, initialCommand]);

  // Get available results from previous commands
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

  const validateObjectId = (value: string): string | null => {
    if (!value) return 'Object ID is required';
    if (!value.startsWith('0x')) return 'Object ID must start with 0x';
    if (value.length !== 66) return 'Object ID must be 66 characters (0x + 64 hex)';
    if (!/^0x[a-fA-F0-9]{64}$/.test(value)) return 'Invalid object ID format';
    return null;
  };

  const validateAddress = (value: string): string | null => {
    if (!value) return 'Recipient address is required';
    if (!value.startsWith('0x')) return 'Address must start with 0x';
    if (value.length !== 66) return 'Address must be 66 characters (0x + 64 hex)';
    if (!/^0x[a-fA-F0-9]{64}$/.test(value)) return 'Invalid address format';
    return null;
  };

  const handleAddObject = () => {
    setObjects([...objects, { type: 'object', value: '' }]);
  };

  const handleRemoveObject = (index: number) => {
    if (objects.length > 1) {
      setObjects(objects.filter((_, i) => i !== index));
      // Clear error for removed object
      const newErrors = { ...errors };
      delete newErrors[`object_${index}`];
      setErrors(newErrors);
    }
  };

  const handleObjectChange = (index: number, newValue: any) => {
    const newObjects = [...objects];
    newObjects[index] = newValue;
    setObjects(newObjects);

    // Validate if it's an object ID
    if (newValue.type === 'object') {
      const error = validateObjectId(newValue.value);
      setErrors(prev => {
        const newErrors = { ...prev };
        if (error) {
          newErrors[`object_${index}`] = error;
        } else {
          delete newErrors[`object_${index}`];
        }
        return newErrors;
      });
    } else {
      // Clear error for non-object types
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`object_${index}`];
        return newErrors;
      });
    }
  };

  const handleRecipientChange = (newValue: any) => {
    setRecipient(newValue);

    // Validate if it's an address
    if (newValue.type === 'input') {
      const error = validateAddress(newValue.value);
      setErrors(prev => {
        const newErrors = { ...prev };
        if (error) {
          newErrors['recipient'] = error;
        } else {
          delete newErrors['recipient'];
        }
        return newErrors;
      });
    } else {
      // Clear error for result references
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors['recipient'];
        return newErrors;
      });
    }
  };

  const handleSave = () => {
    // Validate all fields
    const newErrors: Record<string, string> = {};

    // Validate objects
    objects.forEach((obj, index) => {
      if (obj.type === 'object') {
        const error = validateObjectId(obj.value);
        if (error) {
          newErrors[`object_${index}`] = error;
        }
      } else if (obj.type === 'result' && obj.resultFrom === undefined) {
        newErrors[`object_${index}`] = 'Please select a result source';
      }
    });

    // Validate recipient
    if (recipient.type === 'input') {
      const error = validateAddress(recipient.value);
      if (error) {
        newErrors['recipient'] = error;
      }
    } else if (recipient.type === 'result' && recipient.resultFrom === undefined) {
      newErrors['recipient'] = 'Please select a result source';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const command: PTBTransferObjectsCommand = {
      id: Date.now().toString(),
      type: 'TransferObjects',
      objects: objects.map(obj => ({
        ...obj,
        paramType: 'object'
      })),
      recipient: {
        ...recipient,
        paramType: 'address'
      }
    };

    onSave(command);
    onOpenChange(false);
  };

  const renderObjectInput = (obj: any, index: number) => {
    const error = errors[`object_${index}`];

    return (
      <div key={index} className="space-y-2 p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Object {index + 1}</Label>
          </div>
          {objects.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleRemoveObject(index)}
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
              variant={obj.type === 'object' ? 'secondary' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => handleObjectChange(index, { type: 'object', value: '' })}
            >
              Object ID
            </Button>
            {availableResults.length > 0 && (
              <Button
                size="sm"
                variant={obj.type === 'result' ? 'secondary' : 'ghost'}
                className="h-7 text-xs"
                onClick={() => handleObjectChange(index, { 
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
          {obj.type === 'object' && (
            <Input
              placeholder="Object ID (0x...)"
              value={obj.value || ''}
              onChange={(e) => handleObjectChange(index, { ...obj, value: e.target.value })}
              className={cn("h-8 text-sm font-mono", error && "border-red-500")}
            />
          )}

          {obj.type === 'result' && availableResults.length > 0 && (
            <select
              className="w-full h-8 px-2 text-sm bg-background border rounded"
              value={obj.resultFrom ?? ''}
              onChange={(e) => {
                const resultIndex = parseInt(e.target.value);
                const result = availableResults.find(r => r.index === resultIndex);
                if (result) {
                  handleObjectChange(index, { 
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

  const renderRecipientInput = () => {
    const error = errors['recipient'];

    return (
      <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Recipient Address</Label>
          <Badge variant="outline" className="text-xs">Required</Badge>
        </div>

        <div className="space-y-2">
          {/* Type selector */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={recipient.type === 'input' ? 'secondary' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => handleRecipientChange({ type: 'input', value: '' })}
            >
              Direct Input
            </Button>
            {availableResults.length > 0 && (
              <Button
                size="sm"
                variant={recipient.type === 'result' ? 'secondary' : 'ghost'}
                className="h-7 text-xs"
                onClick={() => handleRecipientChange({ 
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
          {recipient.type === 'input' && (
            <Input
              placeholder="Recipient address (0x...)"
              value={recipient.value || ''}
              onChange={(e) => handleRecipientChange({ ...recipient, value: e.target.value })}
              className={cn("h-8 text-sm font-mono", error && "border-red-500")}
            />
          )}

          {recipient.type === 'result' && availableResults.length > 0 && (
            <select
              className="w-full h-8 px-2 text-sm bg-background border rounded"
              value={recipient.resultFrom ?? ''}
              onChange={(e) => {
                const resultIndex = parseInt(e.target.value);
                const result = availableResults.find(r => r.index === resultIndex);
                if (result) {
                  handleRecipientChange({ 
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
            <Send className="h-5 w-5 text-primary" />
            Transfer Objects
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="p-6 space-y-4">
            {/* Info Alert */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Transfer one or more objects to a recipient address. Objects must be owned by the transaction sender.
              </AlertDescription>
            </Alert>

            {/* Objects Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Objects to Transfer</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddObject}
                  className="h-8 gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Object
                </Button>
              </div>

              {objects.map((obj, index) => renderObjectInput(obj, index))}
            </div>

            {/* Recipient Section */}
            <div className="space-y-3">
              <Label>Recipient</Label>
              {renderRecipientInput()}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Send className="h-4 w-4" />
            Add Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}