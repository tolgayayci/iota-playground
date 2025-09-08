import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FunctionSquare,
  Send,
  Split,
  Merge,
  Grid,
  Upload,
  Plus,
  Trash2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { PTBCommand } from '@/components/views/PTBBuilderV3';

interface ModuleInfo {
  name: string;
  address: string;
  functions: FunctionInfo[];
}

interface FunctionInfo {
  name: string;
  visibility: string;
  isEntry: boolean;
  parameters: Array<{
    name: string;
    type: string;
  }>;
  returnTypes: string[];
}

interface PTBCommandBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (command: PTBCommand) => void;
  modules: ModuleInfo[];
  selectedPackage: string;
  editingCommand: PTBCommand | null;
  previousCommands: PTBCommand[];
}

export function PTBCommandBuilder({
  open,
  onOpenChange,
  onSave,
  modules,
  selectedPackage,
  editingCommand,
  previousCommands,
}: PTBCommandBuilderProps) {
  const [commandType, setCommandType] = useState<PTBCommand['type']>('MoveCall');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedFunction, setSelectedFunction] = useState('');
  const [functionArgs, setFunctionArgs] = useState<any[]>([]);
  const [typeArguments, setTypeArguments] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  
  // TransferObjects specific
  const [objects, setObjects] = useState<any[]>([{ type: 'input', value: '' }]);
  const [recipient, setRecipient] = useState<any>({ type: 'input', value: '' });
  
  // SplitCoins specific
  const [coin, setCoin] = useState<any>({ type: 'gas', value: 'gas' });
  const [amounts, setAmounts] = useState<any[]>([{ type: 'input', value: '' }]);
  
  // MergeCoins specific
  const [destination, setDestination] = useState<any>({ type: 'gas', value: 'gas' });
  const [sources, setSources] = useState<any[]>([{ type: 'input', value: '' }]);

  useEffect(() => {
    if (editingCommand) {
      setCommandType(editingCommand.type);
      setDescription(editingCommand.description || '');
      
      if (editingCommand.type === 'MoveCall') {
        setSelectedModule(editingCommand.module || '');
        setSelectedFunction(editingCommand.function || '');
        setFunctionArgs(editingCommand.arguments || []);
        setTypeArguments(editingCommand.typeArguments || []);
      } else if (editingCommand.type === 'TransferObjects') {
        setObjects(editingCommand.objects || []);
        setRecipient(editingCommand.recipient || { type: 'input', value: '' });
      } else if (editingCommand.type === 'SplitCoins') {
        setCoin(editingCommand.coin || { type: 'gas', value: 'gas' });
        setAmounts(editingCommand.amounts || []);
      } else if (editingCommand.type === 'MergeCoins') {
        setDestination(editingCommand.destination || { type: 'gas', value: 'gas' });
        setSources(editingCommand.sources || []);
      }
    } else {
      resetForm();
    }
  }, [editingCommand, open]);

  const resetForm = () => {
    setCommandType('MoveCall');
    setSelectedModule('');
    setSelectedFunction('');
    setFunctionArgs([]);
    setTypeArguments([]);
    setDescription('');
    setObjects([{ type: 'input', value: '' }]);
    setRecipient({ type: 'input', value: '' });
    setCoin({ type: 'gas', value: 'gas' });
    setAmounts([{ type: 'input', value: '' }]);
    setDestination({ type: 'gas', value: 'gas' });
    setSources([{ type: 'input', value: '' }]);
  };

  const handleFunctionSelect = (functionName: string) => {
    setSelectedFunction(functionName);
    const module = modules.find(m => m.name === selectedModule);
    const func = module?.functions.find(f => f.name === functionName);
    
    if (func) {
      // Initialize arguments based on function parameters
      setFunctionArgs(func.parameters.map((param) => ({
        type: param.type.startsWith('&') ? 'object' : 'input',
        value: '',
        paramType: param.type,
      })));
    }
  };

  const handleSave = () => {
    const command: PTBCommand = {
      id: editingCommand?.id || Date.now().toString(),
      type: commandType,
      description,
    };

    switch (commandType) {
      case 'MoveCall':
        command.target = `${selectedPackage}::${selectedModule}::${selectedFunction}`;
        command.module = selectedModule;
        command.function = selectedFunction;
        command.arguments = functionArgs;
        command.typeArguments = typeArguments.filter(t => t);
        break;
      case 'TransferObjects':
        command.objects = objects;
        command.recipient = recipient;
        break;
      case 'SplitCoins':
        command.coin = coin;
        command.amounts = amounts;
        break;
      case 'MergeCoins':
        command.destination = destination;
        command.sources = sources;
        break;
    }

    onSave(command);
    resetForm();
  };

  const renderMoveCallForm = () => {
    const selectedModuleData = modules.find(m => m.name === selectedModule);
    const selectedFunctionData = selectedModuleData?.functions.find(f => f.name === selectedFunction);

    return (
      <div className="space-y-4">
        <div>
          <Label>Module</Label>
          <Select value={selectedModule} onValueChange={setSelectedModule}>
            <SelectTrigger>
              <SelectValue placeholder="Select module" />
            </SelectTrigger>
            <SelectContent>
              {modules.map(module => (
                <SelectItem key={module.name} value={module.name}>
                  {module.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedModule && (
          <div>
            <Label>Function</Label>
            <Select value={selectedFunction} onValueChange={handleFunctionSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select function" />
              </SelectTrigger>
              <SelectContent>
                {selectedModuleData?.functions.map(func => (
                  <SelectItem key={func.name} value={func.name}>
                    <div className="flex items-center gap-2">
                      <span>{func.name}</span>
                      {func.isEntry && (
                        <Badge variant="secondary" className="text-xs">entry</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedFunctionData && functionArgs.length > 0 && (
          <div className="space-y-3">
            <Label>Arguments</Label>
            {selectedFunctionData.parameters.map((param, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">
                    {param.name} ({param.type})
                  </Label>
                  <Select
                    value={functionArgs[index]?.type || 'input'}
                    onValueChange={(value) => {
                      const newArgs = [...functionArgs];
                      newArgs[index] = { ...newArgs[index], type: value };
                      setFunctionArgs(newArgs);
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="input">Input</SelectItem>
                      <SelectItem value="object">Object</SelectItem>
                      {previousCommands.length > 0 && (
                        <SelectItem value="result">Result</SelectItem>
                      )}
                      <SelectItem value="gas">Gas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {functionArgs[index]?.type === 'result' ? (
                  <Select
                    value={functionArgs[index]?.resultFrom?.toString() || ''}
                    onValueChange={(value) => {
                      const newArgs = [...functionArgs];
                      newArgs[index] = { ...newArgs[index], resultFrom: parseInt(value) };
                      setFunctionArgs(newArgs);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select command output" />
                    </SelectTrigger>
                    <SelectContent>
                      {previousCommands.map((cmd, cmdIndex) => (
                        <SelectItem key={cmdIndex} value={cmdIndex.toString()}>
                          Command {cmdIndex + 1}: {cmd.type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : functionArgs[index]?.type !== 'gas' ? (
                  <Input
                    value={functionArgs[index]?.value || ''}
                    onChange={(e) => {
                      const newArgs = [...functionArgs];
                      newArgs[index] = { ...newArgs[index], value: e.target.value };
                      setFunctionArgs(newArgs);
                    }}
                    placeholder={param.type.startsWith('&') ? '0x...' : 'Enter value'}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTransferObjectsForm = () => (
    <div className="space-y-4">
      <div>
        <Label>Objects to Transfer</Label>
        {objects.map((obj, index) => (
          <div key={index} className="flex gap-2 mt-2">
            <Select
              value={obj.type}
              onValueChange={(value) => {
                const newObjects = [...objects];
                newObjects[index] = { ...newObjects[index], type: value };
                setObjects(newObjects);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="input">Input</SelectItem>
                <SelectItem value="object">Object</SelectItem>
                {previousCommands.length > 0 && (
                  <SelectItem value="result">Result</SelectItem>
                )}
              </SelectContent>
            </Select>
            
            {obj.type === 'result' ? (
              <Select
                value={obj.resultFrom?.toString() || ''}
                onValueChange={(value) => {
                  const newObjects = [...objects];
                  newObjects[index] = { ...newObjects[index], resultFrom: parseInt(value) };
                  setObjects(newObjects);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select command output" />
                </SelectTrigger>
                <SelectContent>
                  {previousCommands.map((cmd, cmdIndex) => (
                    <SelectItem key={cmdIndex} value={cmdIndex.toString()}>
                      Command {cmdIndex + 1}: {cmd.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={obj.value || ''}
                onChange={(e) => {
                  const newObjects = [...objects];
                  newObjects[index] = { ...newObjects[index], value: e.target.value };
                  setObjects(newObjects);
                }}
                placeholder="Object ID"
                className="flex-1"
              />
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setObjects(objects.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setObjects([...objects, { type: 'input', value: '' }])}
          className="mt-2"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Object
        </Button>
      </div>

      <div>
        <Label>Recipient</Label>
        <Input
          value={recipient.value}
          onChange={(e) => setRecipient({ ...recipient, value: e.target.value })}
          placeholder="Recipient address"
        />
      </div>
    </div>
  );

  const renderSplitCoinsForm = () => (
    <div className="space-y-4">
      <div>
        <Label>Coin to Split</Label>
        <Select
          value={coin.type}
          onValueChange={(value) => setCoin({ type: value, value: value === 'gas' ? 'gas' : '' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gas">Gas Coin</SelectItem>
            <SelectItem value="object">Object</SelectItem>
            {previousCommands.length > 0 && (
              <SelectItem value="result">Result</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Split Amounts</Label>
        {amounts.map((amount, index) => (
          <div key={index} className="flex gap-2 mt-2">
            <Input
              type="number"
              value={amount.value}
              onChange={(e) => {
                const newAmounts = [...amounts];
                newAmounts[index] = { ...newAmounts[index], value: e.target.value };
                setAmounts(newAmounts);
              }}
              placeholder="Amount"
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAmounts(amounts.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAmounts([...amounts, { type: 'input', value: '' }])}
          className="mt-2"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Amount
        </Button>
      </div>
    </div>
  );

  const renderMergeCoinsForm = () => (
    <div className="space-y-4">
      <div>
        <Label>Destination Coin</Label>
        <Select
          value={destination.type}
          onValueChange={(value) => setDestination({ type: value, value: value === 'gas' ? 'gas' : '' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gas">Gas Coin</SelectItem>
            <SelectItem value="object">Object</SelectItem>
            {previousCommands.length > 0 && (
              <SelectItem value="result">Result</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Source Coins</Label>
        {sources.map((source, index) => (
          <div key={index} className="flex gap-2 mt-2">
            <Select
              value={source.type}
              onValueChange={(value) => {
                const newSources = [...sources];
                newSources[index] = { ...newSources[index], type: value };
                setSources(newSources);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="object">Object</SelectItem>
                {previousCommands.length > 0 && (
                  <SelectItem value="result">Result</SelectItem>
                )}
              </SelectContent>
            </Select>
            
            {source.type === 'result' ? (
              <Select
                value={source.resultFrom?.toString() || ''}
                onValueChange={(value) => {
                  const newSources = [...sources];
                  newSources[index] = { ...newSources[index], resultFrom: parseInt(value) };
                  setSources(newSources);
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select command output" />
                </SelectTrigger>
                <SelectContent>
                  {previousCommands.map((cmd, cmdIndex) => (
                    <SelectItem key={cmdIndex} value={cmdIndex.toString()}>
                      Command {cmdIndex + 1}: {cmd.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={source.value || ''}
                onChange={(e) => {
                  const newSources = [...sources];
                  newSources[index] = { ...newSources[index], value: e.target.value };
                  setSources(newSources);
                }}
                placeholder="Coin object ID"
                className="flex-1"
              />
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSources(sources.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSources([...sources, { type: 'object', value: '' }])}
          className="mt-2"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Source
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingCommand ? 'Edit Command' : 'Add PTB Command'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!editingCommand && (
            <Tabs value={commandType} onValueChange={(v) => setCommandType(v as PTBCommand['type'])}>
              <TabsList className="grid grid-cols-6 w-full">
                <TabsTrigger value="MoveCall">
                  <FunctionSquare className="h-4 w-4 mr-1" />
                  Call
                </TabsTrigger>
                <TabsTrigger value="TransferObjects">
                  <Send className="h-4 w-4 mr-1" />
                  Transfer
                </TabsTrigger>
                <TabsTrigger value="SplitCoins">
                  <Split className="h-4 w-4 mr-1" />
                  Split
                </TabsTrigger>
                <TabsTrigger value="MergeCoins">
                  <Merge className="h-4 w-4 mr-1" />
                  Merge
                </TabsTrigger>
                <TabsTrigger value="MakeMoveVec" disabled>
                  <Grid className="h-4 w-4 mr-1" />
                  Vector
                </TabsTrigger>
                <TabsTrigger value="Publish" disabled>
                  <Upload className="h-4 w-4 mr-1" />
                  Publish
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {!selectedPackage && commandType === 'MoveCall' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please select a package first to add MoveCall commands
              </AlertDescription>
            </Alert>
          )}

          {commandType === 'MoveCall' && renderMoveCallForm()}
          {commandType === 'TransferObjects' && renderTransferObjectsForm()}
          {commandType === 'SplitCoins' && renderSplitCoinsForm()}
          {commandType === 'MergeCoins' && renderMergeCoinsForm()}

          <div>
            <Label>Description (Optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this command does"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {editingCommand ? 'Update' : 'Add'} Command
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}