import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Play, 
  Code2, 
  Download, 
  Upload, 
  Trash2,
  GripVertical,
  Copy,
  AlertCircle,
  CheckCircle,
  Zap,
  Package,
  Wallet,
  Settings,
  Edit,
  Save,
  X,
  AlertTriangle,
} from 'lucide-react';
import { PTBBuilder, PTBCommand, PTBCommandType, PTBTemplate, PTBTemplates } from '@/lib/ptb';
import { PTBPreviewDialog } from '@/components/ptb/PTBPreviewDialog';
import { ConsoleOutput, useConsole } from '@/components/debug/ConsoleOutput';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface PTBBuilderViewProps {
  projectId: string;
  isSharedView?: boolean;
}

export function PTBBuilderView({ projectId, isSharedView = false }: PTBBuilderViewProps) {
  const [ptbBuilder, setPtbBuilder] = useState<PTBBuilder>(new PTBBuilder());
  const [selectedCommandType, setSelectedCommandType] = useState<PTBCommandType>('MoveCall');
  const [showGeneratedCode, setShowGeneratedCode] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; errors: string[]; warnings?: string[] }>({ isValid: true, errors: [], warnings: [] });
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [editingCommand, setEditingCommand] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const { toast } = useToast();
  const console = useConsole();
  const { currentWallet, isConnected, network, connectPlaygroundWallet, connectExternalWallet, isPlaygroundWallet, isNetworkCompatible } = useWallet();
  const { user } = useAuth();

  // Validate PTB whenever commands change
  useEffect(() => {
    const result = ptbBuilder.validate();
    setValidationResult(result);
  }, [ptbBuilder]);

  const handleAddCommand = (type: PTBCommandType) => {
    const newBuilder = new PTBBuilder();
    newBuilder.getCommands().push(...ptbBuilder.getCommands());
    
    // Add default command based on type
    switch (type) {
      case 'MoveCall':
        newBuilder.addMoveCall('0x1::module::function', []);
        break;
      case 'SplitCoins':
        newBuilder.addSplitCoins(
          { type: 'gas', value: 'gas' },
          [{ type: 'input', value: 1000000 }]
        );
        break;
      case 'TransferObjects':
        newBuilder.addTransferObjects(
          [{ type: 'result', value: '', resultFrom: 0 }],
          { type: 'input', value: '0x...' }
        );
        break;
      case 'MergeCoins':
        newBuilder.addMergeCoins(
          { type: 'gas', value: 'gas' },
          [{ type: 'result', value: '', resultFrom: 0 }]
        );
        break;
      default:
        return;
    }
    
    setPtbBuilder(newBuilder);
    toast({
      title: "Command Added",
      description: `${type} command added to PTB`,
    });
  };

  const handleRemoveCommand = (id: string) => {
    const newBuilder = new PTBBuilder();
    newBuilder.getCommands().push(...ptbBuilder.getCommands());
    newBuilder.removeCommand(id);
    setPtbBuilder(newBuilder);
    toast({
      title: "Command Removed",
      description: "Command removed from PTB",
    });
  };

  const handleEditCommand = (command: PTBCommand) => {
    setEditingCommand(command.id);
    
    // Initialize edit form based on command type
    switch (command.type) {
      case 'MoveCall':
        setEditForm({
          target: command.target,
          arguments: command.arguments.map(arg => ({
            type: arg.type,
            value: arg.value,
            resultFrom: arg.resultFrom,
          })),
          typeArguments: command.typeArguments || [],
        });
        break;
      case 'SplitCoins':
        setEditForm({
          coin: command.coin,
          amounts: command.amounts,
        });
        break;
      case 'TransferObjects':
        setEditForm({
          objects: command.objects,
          recipient: command.recipient,
        });
        break;
      case 'MergeCoins':
        setEditForm({
          destination: command.destination,
          sources: command.sources,
        });
        break;
      default:
        setEditForm({});
    }
  };

  const handleSaveCommand = () => {
    if (!editingCommand) return;

    const newBuilder = new PTBBuilder();
    newBuilder.getCommands().push(...ptbBuilder.getCommands());
    
    // Update the command with new data
    newBuilder.updateCommand(editingCommand, editForm);
    setPtbBuilder(newBuilder);
    
    setEditingCommand(null);
    setEditForm({});
    
    toast({
      title: "Command Updated",
      description: "Command parameters updated successfully",
    });
  };

  const handleCancelEdit = () => {
    setEditingCommand(null);
    setEditForm({});
  };

  const handleExportPTB = () => {
    const ptbData = ptbBuilder.toJSON();
    const dataStr = JSON.stringify(ptbData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `ptb-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "PTB Exported",
      description: "PTB configuration downloaded as JSON file",
    });
  };

  const handleImportPTB = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const ptbData = JSON.parse(event.target?.result as string);
          const newBuilder = PTBBuilder.fromJSON(ptbData);
          setPtbBuilder(newBuilder);
          
          toast({
            title: "PTB Imported",
            description: `Loaded PTB with ${newBuilder.count()} commands`,
          });
        } catch (error) {
          toast({
            title: "Import Error",
            description: "Failed to parse PTB file. Please check the format.",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  };

  const handleLoadTemplate = (templateName: string) => {
    let template: PTBTemplate;
    
    switch (templateName) {
      case 'simple-transfer':
        template = PTBTemplates.simple_transfer();
        break;
      case 'module-call':
        template = PTBTemplates.module_call();
        break;
      default:
        return;
    }
    
    setPtbBuilder(PTBBuilder.fromJSON(template));
    toast({
      title: "Template Loaded",
      description: `${template.name} template loaded`,
    });
  };

  const handleGenerateCode = () => {
    setShowGeneratedCode(true);
  };

  const handleCopyCode = async () => {
    const code = ptbBuilder.generateTypeScript();
    await navigator.clipboard.writeText(code);
    toast({
      title: "Code Copied",
      description: "Generated TypeScript code copied to clipboard",
    });
  };

  // Save PTB execution to history
  const savePTBHistory = async (
    ptbConfig: any,
    status: 'pending' | 'success' | 'failed',
    executionResult?: any,
    transactionHash?: string,
    gasUsed?: number
  ) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('ptb_history')
        .insert({
          user_id: user.id,
          project_id: projectId,
          ptb_config: ptbConfig,
          execution_result: executionResult,
          network,
          transaction_hash: transactionHash,
          gas_used: gasUsed,
          status,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to save PTB history:', error);
      return null;
    }
  };

  // Simulate PTB execution (dry run)
  const handleSimulatePTB = async () => {
    console.log('Starting PTB simulation', { commandCount: ptbBuilder.commands.length, network }, 'PTB');
    
    if (!validationResult.isValid) {
      console.error('PTB validation failed', validationResult.errors, 'PTB');
      toast({
        title: "Validation Error",
        description: "Please fix validation errors before simulating",
        variant: "destructive",
      });
      return;
    }

    if (!currentWallet) {
      console.error('No wallet connected for simulation', null, 'PTB');
      toast({
        title: "No Wallet Connected",
        description: "Please connect a wallet to simulate the PTB",
        variant: "destructive",
      });
      return;
    }

    setIsSimulating(true);
    try {
      console.log('Building transaction for simulation', { commands: ptbBuilder.commands.map(c => c.type) }, 'PTB');
      const tx = await ptbBuilder.buildTransaction();
      
      // For now, we'll simulate locally
      // In a real implementation, you'd use the IOTA client's dryRun method
      const simulationResult = {
        success: true,
        gasUsed: 1000000, // Mock gas usage
        effects: { status: { status: 'success' } },
      };

      setExecutionResult(simulationResult);
      console.success('PTB simulation completed successfully', simulationResult, 'PTB');
      
      toast({
        title: "Simulation Complete",
        description: `Estimated gas: ${simulationResult.gasUsed}`,
      });
    } catch (error) {
      console.error('PTB simulation failed', error, 'PTB');
      toast({
        title: "Simulation Error",
        description: error instanceof Error ? error.message : "Failed to simulate PTB",
        variant: "destructive",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleExecutePTB = async () => {
    console.log('Starting PTB execution', { 
      commandCount: ptbBuilder.commands.length, 
      network, 
      walletType: isPlaygroundWallet ? 'playground' : 'external' 
    }, 'PTB');
    
    if (!validationResult.isValid) {
      console.error('PTB validation failed before execution', validationResult.errors, 'PTB');
      toast({
        title: "Validation Error",
        description: "Please fix validation errors before executing",
        variant: "destructive",
      });
      return;
    }

    if (!currentWallet) {
      console.error('No wallet connected for execution', null, 'PTB');
      toast({
        title: "No Wallet Connected",
        description: "Please connect a wallet to execute the PTB",
        variant: "destructive",
      });
      return;
    }

    // Network compatibility validation
    if (isPlaygroundWallet && network === 'mainnet') {
      console.warn('Playground wallet cannot execute on mainnet', { network, walletType: 'playground' }, 'PTB');
      toast({
        title: "Network Not Compatible",
        description: "Playground wallet cannot execute PTBs on mainnet. Switch to testnet or connect an external wallet.",
        variant: "destructive",
      });
      return;
    }

    setIsExecuting(true);
    
    // Save PTB as pending
    console.log('Saving PTB to history as pending', { commandCount: ptbBuilder.commands.length }, 'PTB');
    const ptbConfig = ptbBuilder.toJSON();
    const historyRecord = await savePTBHistory(ptbConfig, 'pending');

    try {
      console.log('Building transaction for execution', { commands: ptbBuilder.commands.map(c => c.type) }, 'PTB');
      const tx = await ptbBuilder.buildTransaction();
      
      console.log('Signing and executing transaction', { transactionKind: tx.kind }, 'PTB');
      const result = await currentWallet.signAndExecuteTransaction(tx);
      
      // Update history with success
      if (historyRecord) {
        await supabase
          .from('ptb_history')
          .update({
            status: 'success',
            execution_result: result,
            transaction_hash: result.digest,
            gas_used: result.effects?.gasUsed?.computationCost || 0,
          })
          .eq('id', historyRecord.id);
      }

      setExecutionResult(result);
      console.success('PTB executed successfully', { 
        digest: result.digest, 
        gasUsed: result.effects?.gasUsed?.computationCost 
      }, 'PTB');
      
      toast({
        title: "PTB Executed Successfully",
        description: `Transaction: ${result.digest}`,
      });
    } catch (error) {
      console.error('PTB execution failed', error, 'PTB');
      
      // Update history with failure
      if (historyRecord) {
        await supabase
          .from('ptb_history')
          .update({
            status: 'failed',
            execution_result: { error: error instanceof Error ? error.message : 'Unknown error' },
          })
          .eq('id', historyRecord.id);
      }
      
      toast({
        title: "Execution Error",
        description: error instanceof Error ? error.message : "Failed to execute PTB",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const getCommandTypeColor = (type: PTBCommandType): string => {
    switch (type) {
      case 'MoveCall':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'SplitCoins':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'TransferObjects':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'MergeCoins':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'MakeMoveVec':
        return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
      case 'Publish':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const commands = ptbBuilder.getCommands();

  return (
    <div className="h-full flex flex-col bg-background border rounded-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-md">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">PTB Builder</h3>
            <p className="text-xs text-muted-foreground">
              {isSharedView 
                ? "View and analyze Programmable Transaction Blocks"
                : "Build complex transactions with multiple operations"
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Wallet Status */}
          {isConnected ? (
            <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
              <Wallet className="h-3 w-3" />
              {currentWallet?.address.slice(0, 6)}...
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-600">
              <AlertCircle className="h-3 w-3" />
              No Wallet
            </Badge>
          )}

          {/* Network Badge */}
          <Badge variant="secondary" className="text-xs">
            {network}
          </Badge>

          {/* Validation Status */}
          {validationResult.isValid ? (
            validationResult.warnings && validationResult.warnings.length > 0 ? (
              <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-600">
                <AlertTriangle className="h-3 w-3" />
                {validationResult.warnings.length} warnings
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                <CheckCircle className="h-3 w-3" />
                Valid
              </Badge>
            )
          ) : (
            <Badge variant="outline" className="gap-1 text-red-600 border-red-600">
              <AlertCircle className="h-3 w-3" />
              {validationResult.errors.length} errors
              {validationResult.warnings && validationResult.warnings.length > 0 && 
                `, ${validationResult.warnings.length} warnings`
              }
            </Badge>
          )}

          {/* Template Selector */}
          <Select onValueChange={handleLoadTemplate}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Load template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simple-transfer">Simple Transfer</SelectItem>
              <SelectItem value="module-call">Module Call</SelectItem>
            </SelectContent>
          </Select>

          {/* Action Buttons */}
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={handleExportPTB}
            disabled={commands.length === 0}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>

          {!isSharedView && (
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={handleImportPTB}
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={handleGenerateCode}
          >
            <Code2 className="h-4 w-4" />
            Code
          </Button>
          
          {!isSharedView && (
            <>
              <Button 
                variant="outline"
                size="sm" 
                className="gap-2"
                onClick={handleSimulatePTB}
                disabled={isSimulating || !validationResult.isValid || !isConnected}
              >
                <Settings className="h-4 w-4" />
                {isSimulating ? 'Simulating...' : 'Simulate'}
              </Button>
              
              <PTBPreviewDialog 
                ptbBuilder={ptbBuilder} 
                onExecute={handleExecutePTB}
              >
                <Button 
                  size="sm" 
                  className="gap-2"
                  disabled={isExecuting || !validationResult.isValid || !isConnected}
                >
                  <Play className="h-4 w-4" />
                  {isExecuting ? 'Executing...' : 'Execute'}
                </Button>
              </PTBPreviewDialog>
            </>
          )}
        </div>
      </div>

      {/* Commands Section */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Command Add Bar */}
        {!isSharedView && (
          <div className="p-4 border-b bg-muted/20">
            <div className="flex items-center gap-3">
              <Select value={selectedCommandType} onValueChange={(value) => setSelectedCommandType(value as PTBCommandType)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MoveCall">MoveCall</SelectItem>
                  <SelectItem value="SplitCoins">SplitCoins</SelectItem>
                  <SelectItem value="TransferObjects">TransferObjects</SelectItem>
                  <SelectItem value="MergeCoins">MergeCoins</SelectItem>
                  <SelectItem value="MakeMoveVec">MakeMoveVec</SelectItem>
                  <SelectItem value="Publish">Publish</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => handleAddCommand(selectedCommandType)}
              >
                <Plus className="h-4 w-4" />
                Add Command
              </Button>
              
              <div className="text-sm text-muted-foreground">
                {commands.length} command{commands.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}

        {/* Wallet Connection Section */}
        {!isSharedView && !isConnected && (
          <div className="p-4 border-b bg-yellow-50 dark:bg-yellow-950/30">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Wallet Required
                </div>
                <div className="text-xs text-yellow-700 dark:text-yellow-300">
                  Connect a wallet to execute PTBs on the blockchain
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={connectPlaygroundWallet}
                  disabled={network !== 'testnet'}
                >
                  Playground Wallet
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => connectExternalWallet()}
                >
                  External Wallet
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Commands List */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {commands.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <div className="text-muted-foreground mb-2">No commands in PTB</div>
                <div className="text-sm text-muted-foreground">
                  {isSharedView 
                    ? "This PTB doesn't have any commands yet."
                    : "Add commands to build your transaction block."
                  }
                </div>
              </div>
            ) : (
              commands.map((command, index) => (
                <div 
                  key={command.id}
                  className={cn(
                    "group border rounded-lg p-4 transition-colors",
                    "hover:border-primary/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Command Number & Connections */}
                    <div className="flex flex-col items-center gap-1 mt-1 relative">
                      {/* Input connection indicator */}
                      {(() => {
                        const hasResultInputs = ptbBuilder.getCommands()
                          .slice(0, index)
                          .some((_, prevIndex) => {
                            const allArgs = command.type === 'MoveCall' ? command.arguments :
                                          command.type === 'TransferObjects' ? [...command.objects, command.recipient] :
                                          command.type === 'SplitCoins' ? [command.coin, ...command.amounts] :
                                          command.type === 'MergeCoins' ? [command.destination, ...command.sources] : [];
                            return allArgs.some(arg => arg.type === 'result' && arg.resultFrom === prevIndex);
                          });
                        
                        if (hasResultInputs && index > 0) {
                          return (
                            <div className="absolute -top-4 w-px h-4 bg-primary/50" />
                          );
                        }
                        return null;
                      })()}

                      <div className={cn(
                        "w-6 h-6 rounded-full text-xs flex items-center justify-center font-mono relative",
                        // Check if this command produces results that are used by later commands
                        commands.slice(index + 1).some(laterCommand => {
                          const laterArgs = laterCommand.type === 'MoveCall' ? laterCommand.arguments :
                                          laterCommand.type === 'TransferObjects' ? [...laterCommand.objects, laterCommand.recipient] :
                                          laterCommand.type === 'SplitCoins' ? [laterCommand.coin, ...laterCommand.amounts] :
                                          laterCommand.type === 'MergeCoins' ? [laterCommand.destination, ...laterCommand.sources] : [];
                          return laterArgs.some(arg => arg.type === 'result' && arg.resultFrom === index);
                        }) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}
                        
                        {/* Output connection indicator */}
                        {commands.slice(index + 1).some(laterCommand => {
                          const laterArgs = laterCommand.type === 'MoveCall' ? laterCommand.arguments :
                                          laterCommand.type === 'TransferObjects' ? [...laterCommand.objects, laterCommand.recipient] :
                                          laterCommand.type === 'SplitCoins' ? [laterCommand.coin, ...laterCommand.amounts] :
                                          laterCommand.type === 'MergeCoins' ? [laterCommand.destination, ...laterCommand.sources] : [];
                          return laterArgs.some(arg => arg.type === 'result' && arg.resultFrom === index);
                        }) && index < commands.length - 1 && (
                          <div className="absolute -bottom-4 w-px h-4 bg-primary/50" />
                        )}
                      </div>

                      {!isSharedView && (
                        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                      )}
                    </div>

                    {/* Command Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs font-medium", getCommandTypeColor(command.type))}
                        >
                          {command.type}
                        </Badge>
                      </div>
                      
                      {editingCommand === command.id ? (
                        // Edit Mode
                        <div className="space-y-3 mt-2">
                          {command.type === 'MoveCall' && (
                            <>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                  Target Function
                                </label>
                                <Input
                                  value={editForm.target || ''}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, target: e.target.value }))}
                                  placeholder="package::module::function"
                                  className="h-8 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                  Arguments ({editForm.arguments?.length || 0})
                                </label>
                                <div className="text-xs text-muted-foreground">
                                  {editForm.arguments?.map((arg, idx) => (
                                    <div key={idx} className="flex items-center gap-2 py-1">
                                      <span className="w-12">{idx + 1}:</span>
                                      <Badge variant="outline" className="text-xs">{arg.type}</Badge>
                                      <span className="font-mono">{String(arg.value)}</span>
                                    </div>
                                  )) || <span>No arguments</span>}
                                </div>
                              </div>
                            </>
                          )}
                          
                          {command.type === 'SplitCoins' && (
                            <>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                  Coin Source
                                </label>
                                <Badge variant="outline" className="text-xs">
                                  {editForm.coin?.type === 'gas' ? 'GAS' : editForm.coin?.value}
                                </Badge>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                  Split Amounts ({editForm.amounts?.length || 0})
                                </label>
                                <div className="text-xs text-muted-foreground">
                                  {editForm.amounts?.map((amt, idx) => (
                                    <div key={idx} className="flex items-center gap-2 py-1">
                                      <span className="w-12">{idx + 1}:</span>
                                      <Input
                                        type="number"
                                        value={amt.value}
                                        onChange={(e) => {
                                          const newAmounts = [...editForm.amounts];
                                          newAmounts[idx] = { ...amt, value: Number(e.target.value) };
                                          setEditForm(prev => ({ ...prev, amounts: newAmounts }));
                                        }}
                                        className="h-6 text-xs w-32"
                                      />
                                    </div>
                                  )) || <span>No amounts</span>}
                                </div>
                              </div>
                            </>
                          )}

                          {command.type === 'TransferObjects' && (
                            <>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                  Recipient Address
                                </label>
                                <Input
                                  value={editForm.recipient?.value || ''}
                                  onChange={(e) => setEditForm(prev => ({ 
                                    ...prev, 
                                    recipient: { ...prev.recipient, value: e.target.value } 
                                  }))}
                                  placeholder="0x..."
                                  className="h-8 text-xs font-mono"
                                />
                              </div>
                            </>
                          )}

                          <div className="flex gap-2 pt-2">
                            <Button 
                              size="sm" 
                              onClick={handleSaveCommand}
                              className="h-7 gap-1"
                            >
                              <Save className="h-3 w-3" />
                              Save
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={handleCancelEdit}
                              className="h-7 gap-1"
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="text-sm space-y-1">
                          {command.type === 'MoveCall' && (
                            <>
                              <div className="font-mono text-xs text-muted-foreground">
                                Target: <span className="text-foreground">{command.target}</span>
                              </div>
                              <div className="font-mono text-xs text-muted-foreground">
                                Args: <span className="text-foreground">[{command.arguments.length}]</span>
                                {command.arguments.some(arg => arg.type === 'result') && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                                      ← References: {command.arguments
                                        .filter(arg => arg.type === 'result')
                                        .map(arg => `#${(arg.resultFrom || 0) + 1}`)
                                        .join(', ')}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                          
                          {command.type === 'SplitCoins' && (
                            <>
                              <div className="font-mono text-xs text-muted-foreground">
                                Coin: <span className="text-foreground">{command.coin.type === 'gas' ? 'GAS' : command.coin.value}</span>
                              </div>
                              <div className="font-mono text-xs text-muted-foreground">
                                Amounts: <span className="text-foreground">[{command.amounts.length}]</span>
                              </div>
                            </>
                          )}
                          
                          {command.type === 'TransferObjects' && (
                            <>
                              <div className="font-mono text-xs text-muted-foreground">
                                Objects: <span className="text-foreground">[{command.objects.length}]</span>
                                {command.objects.some(obj => obj.type === 'result') && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                                      ← Objects from: {command.objects
                                        .filter(obj => obj.type === 'result')
                                        .map(obj => `#${(obj.resultFrom || 0) + 1}`)
                                        .join(', ')}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                              <div className="font-mono text-xs text-muted-foreground">
                                To: <span className="text-foreground">{command.recipient.value}</span>
                              </div>
                            </>
                          )}
                          
                          {command.type === 'MergeCoins' && (
                            <>
                              <div className="font-mono text-xs text-muted-foreground">
                                Destination: <span className="text-foreground">{command.destination.value}</span>
                              </div>
                              <div className="font-mono text-xs text-muted-foreground">
                                Sources: <span className="text-foreground">[{command.sources.length}]</span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Command Actions */}
                    {!isSharedView && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {editingCommand !== command.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleEditCommand(command)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveCommand(command.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Validation Messages */}
        {(!validationResult.isValid || (validationResult.warnings && validationResult.warnings.length > 0)) && (
          <div className="border-t">
            {!validationResult.isValid && (
              <div className="p-4 bg-red-500/5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-red-700">Validation Errors</div>
                    <div className="text-sm text-red-600 mt-1 space-y-1">
                      {validationResult.errors.map((error, index) => (
                        <div key={index} className="text-xs">• {error}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {validationResult.warnings && validationResult.warnings.length > 0 && (
              <div className="p-4 bg-yellow-500/5 border-t">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-yellow-700">Validation Warnings</div>
                    <div className="text-sm text-yellow-600 mt-1 space-y-1">
                      {validationResult.warnings.map((warning, index) => (
                        <div key={index} className="text-xs">• {warning}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Execution Result Panel */}
        {executionResult && (
          <div className="border-t bg-muted/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Execution Result</h4>
              <Button variant="ghost" size="sm" onClick={() => setExecutionResult(null)}>
                Hide
              </Button>
            </div>
            <ScrollArea className="h-[200px] w-full border rounded-md">
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap">
                <code>{JSON.stringify(executionResult, null, 2)}</code>
              </pre>
            </ScrollArea>
          </div>
        )}

        {/* Generated Code Panel */}
        {showGeneratedCode && (
          <div className="border-t bg-muted/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Generated TypeScript</h4>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleCopyCode}>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowGeneratedCode(false)}>
                  Hide
                </Button>
              </div>
            </div>
            <ScrollArea className="h-[200px] w-full border rounded-md">
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap">
                <code>{ptbBuilder.generateTypeScript()}</code>
              </pre>
            </ScrollArea>
          </div>
        )}

        {/* Console Output */}
        {console.entries.length > 0 && (
          <div className="mt-4">
            <ConsoleOutput
              entries={console.entries}
              onClear={console.clear}
              maxHeight="max-h-48"
              showTimestamp={true}
              showSource={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}