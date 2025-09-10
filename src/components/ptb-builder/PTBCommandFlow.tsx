import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  Plus,
  ChevronDown,
  ChevronRight,
  Zap,
  ArrowDown,
  AlertCircle,
  CheckCircle,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { PTBCommand } from '@/components/views/PTBBuilderV3';
import { PTBCommandNode } from './PTBCommandNode';
import { PTBAddMoveCallModal } from './PTBAddMoveCallModal';
import { PTBAddTransferObjectsModal } from './PTBAddTransferObjectsModal';
import { PTBAddSplitCoinsModal } from './PTBAddSplitCoinsModal';
import { PTBAddMergeCoinsModal } from './PTBAddMergeCoinsModal';
import { generateAutoReferences, validateCommandReferences } from '@/lib/ptb-utils';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FunctionSquare, Send, Split, Merge } from 'lucide-react';

interface PTBCommandFlowProps {
  commands: PTBCommand[];
  onCommandsChange: (commands: PTBCommand[]) => void;
  modules: any[];
  selectedPackage: string;
  isLoading?: boolean;
  onShowTemplates?: () => void;
}

export function PTBCommandFlow({
  commands,
  onCommandsChange,
  modules,
  selectedPackage,
  isLoading,
  onShowTemplates
}: PTBCommandFlowProps) {
  const [expandedCommands, setExpandedCommands] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCommandType, setSelectedCommandType] = useState<'MoveCall' | 'TransferObjects' | 'SplitCoins' | 'MergeCoins'>('MoveCall');
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [addingAtIndex, setAddingAtIndex] = useState<number>(0);
  const [editingCommand, setEditingCommand] = useState<PTBCommand | null>(null);
  const [validationErrors, setValidationErrors] = useState<Map<string, string[]>>(new Map());
  const flowRef = useRef<HTMLDivElement>(null);

  // Auto-validate commands when they change
  useEffect(() => {
    const errors = new Map<string, string[]>();
    commands.forEach((command, index) => {
      const commandErrors = validateCommandReferences(command, commands.slice(0, index));
      if (commandErrors.length > 0) {
        errors.set(command.id, commandErrors);
      }
    });
    setValidationErrors(errors);
  }, [commands]);

  const handleAddCommand = (newCommand: PTBCommand) => {
    if (editingCommand) {
      // If editing, replace the existing command
      const index = commands.findIndex(cmd => cmd.id === editingCommand.id);
      if (index !== -1) {
        const enhancedCommand = generateAutoReferences(newCommand, commands.slice(0, index));
        const updatedCommands = [...commands];
        updatedCommands[index] = { ...enhancedCommand, id: editingCommand.id };
        onCommandsChange(updatedCommands);
      }
      setEditingCommand(null);
    } else {
      // Auto-generate references based on previous commands
      const enhancedCommand = generateAutoReferences(newCommand, commands.slice(0, addingAtIndex));
      const updatedCommands = [...commands];
      updatedCommands.splice(addingAtIndex, 0, { ...enhancedCommand, id: Date.now().toString() });
      onCommandsChange(updatedCommands);
    }
    setShowAddModal(false);
  };

  const openAddModal = (index: number) => {
    setAddingAtIndex(index);
    setShowTypeSelector(true);
  };

  const handleSelectCommandType = (type: 'MoveCall' | 'TransferObjects' | 'SplitCoins' | 'MergeCoins') => {
    setSelectedCommandType(type);
    setShowTypeSelector(false);
    setShowAddModal(true);
  };

  const handleUpdateCommand = (id: string, updatedCommand: PTBCommand) => {
    const index = commands.findIndex(cmd => cmd.id === id);
    if (index !== -1) {
      // Auto-update references when command changes
      const enhancedCommand = generateAutoReferences(updatedCommand, commands.slice(0, index));
      onCommandsChange(commands.map(cmd => 
        cmd.id === id ? enhancedCommand : cmd
      ));
    }
  };

  const handleEditCommand = (command: PTBCommand) => {
    setEditingCommand(command);
    setSelectedCommandType(command.type as any);
    const index = commands.findIndex(cmd => cmd.id === command.id);
    setAddingAtIndex(index);
    setShowAddModal(true);
  };

  const handleDeleteCommand = (id: string) => {
    // When deleting, update all subsequent command references
    const deletedIndex = commands.findIndex(cmd => cmd.id === id);
    const updatedCommands = commands.filter(cmd => cmd.id !== id);
    
    // Adjust references in subsequent commands
    if (deletedIndex !== -1) {
      for (let i = deletedIndex; i < updatedCommands.length; i++) {
        updatedCommands[i] = adjustCommandReferences(updatedCommands[i], deletedIndex);
      }
    }
    
    onCommandsChange(updatedCommands);
  };

  const handleMoveCommand = (id: string, direction: 'up' | 'down') => {
    const index = commands.findIndex(cmd => cmd.id === id);
    if (index === -1) return;
    
    if (direction === 'up' && index > 0) {
      const newCommands = [...commands];
      [newCommands[index - 1], newCommands[index]] = [newCommands[index], newCommands[index - 1]];
      onCommandsChange(newCommands);
    } else if (direction === 'down' && index < commands.length - 1) {
      const newCommands = [...commands];
      [newCommands[index], newCommands[index + 1]] = [newCommands[index + 1], newCommands[index]];
      onCommandsChange(newCommands);
    }
  };

  const toggleCommandExpansion = (id: string) => {
    const newExpanded = new Set(expandedCommands);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCommands(newExpanded);
  };

  const adjustCommandReferences = (command: PTBCommand, deletedIndex: number): PTBCommand => {
    // Adjust Result(n) references when a command is deleted
    const updatedCommand = { ...command };
    
    // This is a simplified version - in production, you'd need to parse and update
    // all reference values that point to indices >= deletedIndex
    
    return updatedCommand;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Initial state when no commands - centered */}
      {commands.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="flex flex-col items-center">
            <div className="p-4 bg-muted/30 rounded-full mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h4 className="font-medium mb-2">Start Your PTB</h4>
            <p className="text-sm text-muted-foreground text-center mb-4 max-w-sm">
              Add your first Move call to begin building your programmable transaction
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => openAddModal(0)}
                variant="default"
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Move Call
              </Button>
              {onShowTemplates && (
                <Button
                  onClick={onShowTemplates}
                  variant="outline"
                  className="gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  Load Template
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Command Pipeline with ScrollArea */}
      {commands.length > 0 && (
        <ScrollArea className="flex-1">
          <div className="p-4">
            <div className="space-y-2">

            {commands.map((command, index) => (
              <div key={command.id} className="relative">
                {/* Visual Connection Line */}
                {index > 0 && (
                  <div className="absolute left-1/2 -top-2 w-0.5 h-2 bg-border" />
                )}

                {/* Command Node */}
                <PTBCommandNode
                  command={command}
                  index={index}
                  isExpanded={expandedCommands.has(command.id)}
                  validationErrors={validationErrors.get(command.id) || []}
                  previousCommands={commands.slice(0, index)}
                  totalCommands={commands.length}
                  onToggleExpand={() => toggleCommandExpansion(command.id)}
                  onUpdate={(updated) => handleUpdateCommand(command.id, updated)}
                  onEdit={() => handleEditCommand(command)}
                  onDelete={() => handleDeleteCommand(command.id)}
                  onMove={(direction) => handleMoveCommand(command.id, direction)}
                  modules={modules}
                  selectedPackage={selectedPackage}
                />

                {/* Add Command Button Between Nodes */}
                {index < commands.length - 1 && (
                  <div className="relative py-2">
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-border" />
                    <div className="flex justify-center relative z-10">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 rounded-full bg-background border hover:bg-primary/10 relative"
                        onClick={() => openAddModal(index + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add command at end */}
            {commands.length > 0 && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => openAddModal(commands.length)}
                >
                  <Plus className="h-4 w-4" />
                  Add Move Call
                </Button>
              </div>
            )}

                {/* Expand/Collapse All button when there are multiple commands */}
              {commands.length > 1 && (
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (expandedCommands.size === commands.length) {
                        setExpandedCommands(new Set());
                      } else {
                        setExpandedCommands(new Set(commands.map(c => c.id)));
                      }
                    }}
                  >
                    {expandedCommands.size === commands.length ? 'Collapse All' : 'Expand All'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Command Type Selector Modal */}
      <Dialog open={showTypeSelector} onOpenChange={setShowTypeSelector}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Command Type</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="MoveCall" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="MoveCall">Move Call</TabsTrigger>
              <TabsTrigger value="TransferObjects">Transfer</TabsTrigger>
              <TabsTrigger value="SplitCoins">Split</TabsTrigger>
              <TabsTrigger value="MergeCoins">Merge</TabsTrigger>
            </TabsList>
            <TabsContent value="MoveCall" className="space-y-4">
              <div className="p-4 border rounded-lg hover:bg-accent cursor-pointer" onClick={() => handleSelectCommandType('MoveCall')}>
                <div className="flex items-center gap-2 mb-2">
                  <FunctionSquare className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Move Call</h3>
                </div>
                <p className="text-sm text-muted-foreground">Call a function from a Move module</p>
              </div>
            </TabsContent>
            <TabsContent value="TransferObjects" className="space-y-4">
              <div className="p-4 border rounded-lg hover:bg-accent cursor-pointer" onClick={() => handleSelectCommandType('TransferObjects')}>
                <div className="flex items-center gap-2 mb-2">
                  <Send className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Transfer Objects</h3>
                </div>
                <p className="text-sm text-muted-foreground">Transfer objects to another address</p>
              </div>
            </TabsContent>
            <TabsContent value="SplitCoins" className="space-y-4">
              <div className="p-4 border rounded-lg hover:bg-accent cursor-pointer" onClick={() => handleSelectCommandType('SplitCoins')}>
                <div className="flex items-center gap-2 mb-2">
                  <Split className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Split Coins</h3>
                </div>
                <p className="text-sm text-muted-foreground">Split a coin into multiple smaller amounts</p>
              </div>
            </TabsContent>
            <TabsContent value="MergeCoins" className="space-y-4">
              <div className="p-4 border rounded-lg hover:bg-accent cursor-pointer" onClick={() => handleSelectCommandType('MergeCoins')}>
                <div className="flex items-center gap-2 mb-2">
                  <Merge className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Merge Coins</h3>
                </div>
                <p className="text-sm text-muted-foreground">Merge multiple coins into one</p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Add Command Modals */}
      {selectedCommandType === 'MoveCall' && (
        <PTBAddMoveCallModal
          open={showAddModal}
          onOpenChange={(open) => {
            setShowAddModal(open);
            if (!open) setEditingCommand(null);
          }}
          onSave={handleAddCommand}
          modules={modules}
          selectedPackage={selectedPackage}
          previousCommands={commands.slice(0, addingAtIndex)}
          isLoadingModules={isLoading}
          initialCommand={editingCommand as any}
        />
      )}
      {selectedCommandType === 'TransferObjects' && (
        <PTBAddTransferObjectsModal
          open={showAddModal}
          onOpenChange={(open) => {
            setShowAddModal(open);
            if (!open) setEditingCommand(null);
          }}
          onSave={handleAddCommand}
          previousCommands={commands.slice(0, addingAtIndex)}
          initialCommand={editingCommand as any}
        />
      )}
      {selectedCommandType === 'SplitCoins' && (
        <PTBAddSplitCoinsModal
          open={showAddModal}
          onOpenChange={(open) => {
            setShowAddModal(open);
            if (!open) setEditingCommand(null);
          }}
          onSave={handleAddCommand}
          previousCommands={commands.slice(0, addingAtIndex)}
          initialCommand={editingCommand as any}
        />
      )}
      {selectedCommandType === 'MergeCoins' && (
        <PTBAddMergeCoinsModal
          open={showAddModal}
          onOpenChange={(open) => {
            setShowAddModal(open);
            if (!open) setEditingCommand(null);
          }}
          onSave={handleAddCommand}
          previousCommands={commands.slice(0, addingAtIndex)}
          initialCommand={editingCommand as any}
        />
      )}
    </div>
  );
}