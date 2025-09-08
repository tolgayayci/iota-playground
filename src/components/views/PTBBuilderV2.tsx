import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Plus, 
  Trash2,
  Search,
  Package,
  FunctionSquare,
  AlertCircle,
  CheckCircle,
  Zap,
  Wallet,
  Copy,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Terminal,
  Eye,
  History,
  BookOpen,
  Target,
  ArrowRight,
  Coins,
  Send,
  Merge,
  Split,
  Grid,
  FileCode,
  Loader2,
  Info,
  X,
  Check,
  RefreshCw,
  Save,
  Upload,
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Transaction } from '@iota/iota-sdk/transactions';
import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';

// Command Types
type PTBCommandType = 'MoveCall' | 'TransferObjects' | 'SplitCoins' | 'MergeCoins' | 'MakeMoveVec' | 'Publish';

interface PTBArgument {
  type: 'pure' | 'object' | 'result' | 'gas';
  value?: any;
  resultFrom?: number;
  resultIndex?: number;
}

interface PTBCommand {
  id: string;
  type: PTBCommandType;
  description?: string;
  // Command-specific fields
  target?: string; // For MoveCall
  arguments?: PTBArgument[];
  typeArguments?: string[];
  objects?: PTBArgument[]; // For TransferObjects
  recipient?: PTBArgument;
  coin?: PTBArgument; // For SplitCoins
  amounts?: PTBArgument[];
  destination?: PTBArgument; // For MergeCoins
  sources?: PTBArgument[];
  elements?: PTBArgument[]; // For MakeMoveVec
  elementType?: string;
  modules?: string[]; // For Publish
  dependencies?: string[];
}

// Module/Function metadata
interface FunctionInfo {
  name: string;
  visibility: string;
  isEntry: boolean;
  typeParameters: any[];
  parameters: string[];
  returns: string[];
}

interface ModuleInfo {
  name: string;
  address: string;
  functions: FunctionInfo[];
}

interface PTBBuilderV2Props {
  projectId: string;
  deployedPackageId?: string;
}

// Pre-built templates
const PTB_TEMPLATES = {
  'token-transfer': {
    name: 'Token Transfer',
    description: 'Transfer tokens to another address',
    commands: [
      {
        type: 'SplitCoins' as PTBCommandType,
        coin: { type: 'gas' as const, value: 'gas' },
        amounts: [{ type: 'pure' as const, value: 1000000000 }],
        description: 'Split 1 IOTA from gas',
      },
      {
        type: 'TransferObjects' as PTBCommandType,
        objects: [{ type: 'result' as const, resultFrom: 0, resultIndex: 0 }],
        recipient: { type: 'pure' as const, value: '0x...' },
        description: 'Transfer split coin to recipient',
      },
    ],
  },
  'multi-transfer': {
    name: 'Multi Transfer',
    description: 'Send tokens to multiple recipients',
    commands: [
      {
        type: 'SplitCoins' as PTBCommandType,
        coin: { type: 'gas' as const, value: 'gas' },
        amounts: [
          { type: 'pure' as const, value: 1000000000 },
          { type: 'pure' as const, value: 2000000000 },
          { type: 'pure' as const, value: 3000000000 },
        ],
        description: 'Split gas into multiple amounts',
      },
      {
        type: 'TransferObjects' as PTBCommandType,
        objects: [{ type: 'result' as const, resultFrom: 0, resultIndex: 0 }],
        recipient: { type: 'pure' as const, value: '0xRecipient1...' },
        description: 'Transfer to first recipient',
      },
      {
        type: 'TransferObjects' as PTBCommandType,
        objects: [{ type: 'result' as const, resultFrom: 0, resultIndex: 1 }],
        recipient: { type: 'pure' as const, value: '0xRecipient2...' },
        description: 'Transfer to second recipient',
      },
    ],
  },
  'defi-swap': {
    name: 'DeFi Swap',
    description: 'Swap tokens using a DEX',
    commands: [
      {
        type: 'MoveCall' as PTBCommandType,
        target: '0xDEX::pool::swap',
        arguments: [
          { type: 'object' as const, value: '0xPoolObject' },
          { type: 'pure' as const, value: 1000000000 },
          { type: 'pure' as const, value: 900000000 }, // Min output
        ],
        typeArguments: ['0x2::iota::IOTA', '0xToken::token::TOKEN'],
        description: 'Swap IOTA for TOKEN',
      },
    ],
  },
};

export function PTBBuilderV2({ projectId, deployedPackageId }: PTBBuilderV2Props) {
  // State
  const [commands, setCommands] = useState<PTBCommand[]>([]);
  const [selectedCommandType, setSelectedCommandType] = useState<PTBCommandType>('MoveCall');
  const [searchPackageId, setSearchPackageId] = useState(deployedPackageId || '');
  const [loadingModules, setLoadingModules] = useState(false);
  const [availableModules, setAvailableModules] = useState<ModuleInfo[]>([]);
  const [selectedModule, setSelectedModule] = useState<ModuleInfo | null>(null);
  const [selectedFunction, setSelectedFunction] = useState<FunctionInfo | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'build' | 'simulate' | 'history'>('build');
  const [ptbHistory, setPtbHistory] = useState<any[]>([]);
  const [expandedCommand, setExpandedCommand] = useState<string | null>(null);
  
  const { currentWallet, network, isConnected } = useWallet();
  const { user } = useAuth();
  const { toast } = useToast();

  // Load deployed package modules on mount
  useEffect(() => {
    if (deployedPackageId) {
      setSearchPackageId(deployedPackageId);
      fetchModules(deployedPackageId);
    }
  }, [deployedPackageId]);

  // Load PTB history
  useEffect(() => {
    if (user && projectId) {
      loadPTBHistory();
    }
  }, [user, projectId]);

  const loadPTBHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('ptb_history')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setPtbHistory(data);
      }
    } catch (error) {
      console.error('Failed to load PTB history:', error);
    }
  };

  // Fetch module metadata from package
  const fetchModules = async (packageId: string) => {
    if (!packageId || !packageId.startsWith('0x')) return;

    setLoadingModules(true);
    try {
      const client = new IotaClient({ url: getFullnodeUrl(network) });
      const modules = await client.getNormalizedMoveModulesByPackage({
        package: packageId,
      });

      const moduleInfos: ModuleInfo[] = Object.entries(modules).map(([moduleName, moduleData]: [string, any]) => {
        const functions: FunctionInfo[] = Object.entries(moduleData.exposedFunctions || {}).map(
          ([funcName, funcData]: [string, any]) => ({
            name: funcName,
            visibility: funcData.visibility,
            isEntry: funcData.isEntry,
            typeParameters: funcData.typeParameters || [],
            parameters: funcData.parameters || [],
            returns: funcData.return || [],
          })
        );

        return {
          name: moduleName,
          address: packageId,
          functions,
        };
      });

      setAvailableModules(moduleInfos);
      if (moduleInfos.length > 0) {
        setSelectedModule(moduleInfos[0]);
      }

      toast({
        title: "Modules Loaded",
        description: `Found ${moduleInfos.length} module(s) in package`,
      });
    } catch (error) {
      console.error('Failed to fetch modules:', error);
      toast({
        title: "Failed to Load Modules",
        description: "Check if the package ID is correct and deployed on " + network,
        variant: "destructive",
      });
    } finally {
      setLoadingModules(false);
    }
  };

  // Add command
  const addCommand = (type: PTBCommandType) => {
    const newCommand: PTBCommand = {
      id: `cmd-${Date.now()}`,
      type,
      description: '',
    };

    // Set default values based on type
    switch (type) {
      case 'MoveCall':
        newCommand.target = selectedFunction 
          ? `${selectedModule?.address}::${selectedModule?.name}::${selectedFunction.name}`
          : '';
        newCommand.arguments = selectedFunction?.parameters.map(() => ({
          type: 'pure' as const,
          value: '',
        })) || [];
        newCommand.typeArguments = [];
        break;
      case 'TransferObjects':
        newCommand.objects = [];
        newCommand.recipient = { type: 'pure', value: currentWallet?.address || '' };
        break;
      case 'SplitCoins':
        newCommand.coin = { type: 'gas', value: 'gas' };
        newCommand.amounts = [{ type: 'pure', value: 1000000000 }];
        break;
      case 'MergeCoins':
        newCommand.destination = { type: 'gas', value: 'gas' };
        newCommand.sources = [];
        break;
      case 'MakeMoveVec':
        newCommand.elements = [];
        newCommand.elementType = 'address';
        break;
      case 'Publish':
        newCommand.modules = [];
        newCommand.dependencies = [];
        break;
    }

    setCommands([...commands, newCommand]);
    setExpandedCommand(newCommand.id);
  };

  // Remove command
  const removeCommand = (id: string) => {
    setCommands(commands.filter(cmd => cmd.id !== id));
  };

  // Update command
  const updateCommand = (id: string, updates: Partial<PTBCommand>) => {
    setCommands(commands.map(cmd => 
      cmd.id === id ? { ...cmd, ...updates } : cmd
    ));
  };

  // Load template
  const loadTemplate = (templateKey: string) => {
    const template = PTB_TEMPLATES[templateKey as keyof typeof PTB_TEMPLATES];
    if (template) {
      const newCommands = template.commands.map((cmd, index) => ({
        ...cmd,
        id: `cmd-${Date.now()}-${index}`,
      }));
      setCommands(newCommands);
      toast({
        title: "Template Loaded",
        description: template.name,
      });
    }
  };

  // Build transaction
  const buildTransaction = useCallback(() => {
    const tx = new Transaction();

    commands.forEach((command, index) => {
      switch (command.type) {
        case 'MoveCall':
          if (command.target) {
            const args = command.arguments?.map(arg => {
              if (arg.type === 'pure') return tx.pure(arg.value);
              if (arg.type === 'object') return tx.object(arg.value);
              if (arg.type === 'gas') return tx.gas;
              if (arg.type === 'result' && arg.resultFrom !== undefined) {
                // Reference result from previous command
                return arg.resultIndex !== undefined 
                  ? tx.object(`${arg.resultFrom}[${arg.resultIndex}]`)
                  : tx.object(`${arg.resultFrom}`);
              }
              return tx.pure(arg.value);
            }) || [];

            tx.moveCall({
              target: command.target,
              arguments: args,
              typeArguments: command.typeArguments || [],
            });
          }
          break;

        case 'TransferObjects':
          if (command.objects && command.recipient) {
            const objects = command.objects.map(obj => {
              if (obj.type === 'result' && obj.resultFrom !== undefined) {
                return obj.resultIndex !== undefined 
                  ? tx.object(`${obj.resultFrom}[${obj.resultIndex}]`)
                  : tx.object(`${obj.resultFrom}`);
              }
              return tx.object(obj.value);
            });

            const recipient = command.recipient.type === 'pure' 
              ? command.recipient.value 
              : tx.object(command.recipient.value);

            tx.transferObjects(objects, recipient);
          }
          break;

        case 'SplitCoins':
          if (command.coin && command.amounts) {
            const coin = command.coin.type === 'gas' 
              ? tx.gas 
              : tx.object(command.coin.value);

            const amounts = command.amounts.map(amt =>
              amt.type === 'pure' ? tx.pure.u64(amt.value) : tx.object(amt.value)
            );

            tx.splitCoins(coin, amounts);
          }
          break;

        case 'MergeCoins':
          if (command.destination && command.sources) {
            const destination = command.destination.type === 'gas' 
              ? tx.gas 
              : tx.object(command.destination.value);

            const sources = command.sources.map(src => {
              if (src.type === 'result' && src.resultFrom !== undefined) {
                return src.resultIndex !== undefined 
                  ? tx.object(`${src.resultFrom}[${src.resultIndex}]`)
                  : tx.object(`${src.resultFrom}`);
              }
              return tx.object(src.value);
            });

            tx.mergeCoins(destination, sources);
          }
          break;

        case 'MakeMoveVec':
          if (command.elements && command.elementType) {
            const elements = command.elements.map(el => {
              if (el.type === 'result' && el.resultFrom !== undefined) {
                return el.resultIndex !== undefined 
                  ? tx.object(`${el.resultFrom}[${el.resultIndex}]`)
                  : tx.object(`${el.resultFrom}`);
              }
              return tx.object(el.value);
            });

            tx.makeMoveVec({
              type: command.elementType,
              elements,
            });
          }
          break;
      }
    });

    return tx;
  }, [commands]);

  // Simulate PTB
  const handleSimulate = async () => {
    if (commands.length === 0) {
      toast({
        title: "No Commands",
        description: "Add commands to simulate",
        variant: "destructive",
      });
      return;
    }

    setIsSimulating(true);
    try {
      const tx = buildTransaction();
      const client = new IotaClient({ url: getFullnodeUrl(network) });
      
      // Dry run the transaction
      const result = await client.dryRunTransactionBlock({
        transactionBlock: await tx.build({ client }),
      });

      setExecutionResult(result);
      toast({
        title: "Simulation Complete",
        description: "Check the results below",
      });
    } catch (error) {
      console.error('Simulation failed:', error);
      toast({
        title: "Simulation Failed",
        description: error instanceof Error ? error.message : "Failed to simulate",
        variant: "destructive",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  // Execute PTB
  const handleExecute = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Connect your wallet to execute PTB",
        variant: "destructive",
      });
      return;
    }

    if (commands.length === 0) {
      toast({
        title: "No Commands",
        description: "Add commands to execute",
        variant: "destructive",
      });
      return;
    }

    setIsExecuting(true);
    try {
      const tx = buildTransaction();
      
      // Save to history
      const ptbConfig = {
        commands,
        network,
        timestamp: new Date().toISOString(),
      };

      if (user) {
        await supabase
          .from('ptb_history')
          .insert({
            user_id: user.id,
            project_id: projectId,
            ptb_config: ptbConfig,
            network,
            status: 'pending',
          });
      }

      // Execute transaction
      const result = await currentWallet?.signAndExecuteTransaction(tx);
      
      setExecutionResult(result);
      
      // Update history with result
      if (user && result?.digest) {
        await supabase
          .from('ptb_history')
          .update({
            status: 'success',
            execution_result: result,
            transaction_hash: result.digest,
          })
          .eq('user_id', user.id)
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(1);
      }

      toast({
        title: "PTB Executed",
        description: `Transaction: ${result.digest}`,
      });

      // Reload history
      loadPTBHistory();
    } catch (error) {
      console.error('Execution failed:', error);
      toast({
        title: "Execution Failed",
        description: error instanceof Error ? error.message : "Failed to execute",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Export PTB as JSON
  const exportPTB = () => {
    const data = {
      commands,
      network,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ptb-${Date.now()}.json`;
    a.click();
  };

  // Import PTB from JSON
  const importPTB = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.commands && Array.isArray(data.commands)) {
          setCommands(data.commands);
          toast({
            title: "PTB Imported",
            description: `Loaded ${data.commands.length} command(s)`,
          });
        }
      } catch (error) {
        toast({
          title: "Import Failed",
          description: "Invalid PTB file format",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">PTB Builder</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Build and execute Programmable Transaction Blocks
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Wallet Status */}
            {isConnected ? (
              <Badge variant="outline" className="gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                {currentWallet?.address.slice(0, 6)}...
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                No Wallet
              </Badge>
            )}

            {/* Network */}
            <Badge variant="secondary">
              {network}
            </Badge>

            {/* Actions */}
            <Button variant="outline" size="sm" onClick={exportPTB}>
              <Upload className="h-4 w-4 mr-2" />
              Export
            </Button>
            
            <label>
              <input
                type="file"
                accept=".json"
                onChange={importPTB}
                style={{ display: 'none' }}
              />
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Save className="h-4 w-4 mr-2" />
                  Import
                </span>
              </Button>
            </label>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1">
        <TabsList className="mx-4 mt-4">
          <TabsTrigger value="build" className="gap-2">
            <Target className="h-4 w-4" />
            Build
          </TabsTrigger>
          <TabsTrigger value="simulate" className="gap-2">
            <Eye className="h-4 w-4" />
            Simulate
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="build" className="flex-1 p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4 h-full">
            {/* Left Panel - Package Discovery */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Package Discovery</CardTitle>
                  <CardDescription>
                    Search for deployed packages and their functions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Package ID (0x...)"
                      value={searchPackageId}
                      onChange={(e) => setSearchPackageId(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => fetchModules(searchPackageId)}
                      disabled={loadingModules}
                    >
                      {loadingModules ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Templates */}
                  <div>
                    <p className="text-xs font-medium mb-2">Quick Templates</p>
                    <div className="space-y-1">
                      {Object.entries(PTB_TEMPLATES).map(([key, template]) => (
                        <Button
                          key={key}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-xs"
                          onClick={() => loadTemplate(key)}
                        >
                          <BookOpen className="h-3.5 w-3.5 mr-2" />
                          {template.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Modules */}
                  {availableModules.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-2">Available Modules</p>
                      <ScrollArea className="h-64">
                        <div className="space-y-1">
                          {availableModules.map((module) => (
                            <div
                              key={module.name}
                              className={cn(
                                "p-2 rounded cursor-pointer transition-colors",
                                selectedModule?.name === module.name
                                  ? "bg-primary/10 border border-primary/20"
                                  : "hover:bg-muted"
                              )}
                              onClick={() => setSelectedModule(module)}
                            >
                              <div className="flex items-center gap-2">
                                <Package className="h-3.5 w-3.5" />
                                <span className="text-xs font-mono">{module.name}</span>
                              </div>
                              <p className="text-xs text-muted-foreground ml-5">
                                {module.functions.length} functions
                              </p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Functions */}
                  {selectedModule && (
                    <div>
                      <p className="text-xs font-medium mb-2">Functions</p>
                      <ScrollArea className="h-48">
                        <div className="space-y-1">
                          {selectedModule.functions.map((func) => (
                            <div
                              key={func.name}
                              className={cn(
                                "p-2 rounded cursor-pointer transition-colors",
                                selectedFunction?.name === func.name
                                  ? "bg-primary/10 border border-primary/20"
                                  : "hover:bg-muted"
                              )}
                              onClick={() => setSelectedFunction(func)}
                            >
                              <div className="flex items-center gap-2">
                                <FunctionSquare className="h-3.5 w-3.5" />
                                <span className="text-xs font-mono">{func.name}</span>
                                {func.isEntry && (
                                  <Badge variant="secondary" className="text-xs px-1 py-0">
                                    entry
                                  </Badge>
                                )}
                              </div>
                              {func.parameters.length > 0 && (
                                <p className="text-xs text-muted-foreground ml-5">
                                  {func.parameters.length} params
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Middle Panel - Command Builder */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Commands</CardTitle>
                  <CardDescription>
                    Build your transaction with multiple commands
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Add Command */}
                  <div className="flex gap-2 mb-4">
                    <Select value={selectedCommandType} onValueChange={(v) => setSelectedCommandType(v as PTBCommandType)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MoveCall">
                          <div className="flex items-center gap-2">
                            <Target className="h-3.5 w-3.5" />
                            MoveCall
                          </div>
                        </SelectItem>
                        <SelectItem value="TransferObjects">
                          <div className="flex items-center gap-2">
                            <Send className="h-3.5 w-3.5" />
                            Transfer
                          </div>
                        </SelectItem>
                        <SelectItem value="SplitCoins">
                          <div className="flex items-center gap-2">
                            <Split className="h-3.5 w-3.5" />
                            Split
                          </div>
                        </SelectItem>
                        <SelectItem value="MergeCoins">
                          <div className="flex items-center gap-2">
                            <Merge className="h-3.5 w-3.5" />
                            Merge
                          </div>
                        </SelectItem>
                        <SelectItem value="MakeMoveVec">
                          <div className="flex items-center gap-2">
                            <Grid className="h-3.5 w-3.5" />
                            Vector
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button
                      size="sm"
                      onClick={() => addCommand(selectedCommandType)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>

                  {/* Commands List */}
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {commands.length === 0 ? (
                        <div className="text-center py-8">
                          <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            No commands yet. Add your first command above.
                          </p>
                        </div>
                      ) : (
                        commands.map((command, index) => (
                          <Card key={command.id} className="relative">
                            <CardContent className="p-3">
                              <div
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => setExpandedCommand(
                                  expandedCommand === command.id ? null : command.id
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-mono">
                                    {index + 1}
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {command.type}
                                  </Badge>
                                  {command.description && (
                                    <span className="text-xs text-muted-foreground">
                                      {command.description}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {expandedCommand === command.id ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeCommand(command.id);
                                    }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>

                              {/* Expanded Command Editor */}
                              {expandedCommand === command.id && (
                                <div className="mt-4 space-y-3 pl-9">
                                  {/* Description */}
                                  <div>
                                    <label className="text-xs font-medium">Description</label>
                                    <Input
                                      placeholder="Optional description"
                                      value={command.description || ''}
                                      onChange={(e) => updateCommand(command.id, { description: e.target.value })}
                                      className="mt-1"
                                    />
                                  </div>

                                  {/* Command-specific fields */}
                                  {command.type === 'MoveCall' && (
                                    <>
                                      <div>
                                        <label className="text-xs font-medium">Target Function</label>
                                        <Input
                                          placeholder="package::module::function"
                                          value={command.target || ''}
                                          onChange={(e) => updateCommand(command.id, { target: e.target.value })}
                                          className="mt-1 font-mono text-xs"
                                        />
                                      </div>
                                      {selectedFunction && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => updateCommand(command.id, {
                                            target: `${selectedModule?.address}::${selectedModule?.name}::${selectedFunction.name}`,
                                            arguments: selectedFunction.parameters.map(() => ({
                                              type: 'pure' as const,
                                              value: '',
                                            })),
                                          })}
                                        >
                                          Use Selected Function
                                        </Button>
                                      )}
                                    </>
                                  )}

                                  {command.type === 'TransferObjects' && (
                                    <>
                                      <div>
                                        <label className="text-xs font-medium">Recipient</label>
                                        <Input
                                          placeholder="0x..."
                                          value={command.recipient?.value || ''}
                                          onChange={(e) => updateCommand(command.id, {
                                            recipient: { type: 'pure', value: e.target.value }
                                          })}
                                          className="mt-1 font-mono text-xs"
                                        />
                                      </div>
                                    </>
                                  )}

                                  {command.type === 'SplitCoins' && (
                                    <>
                                      <div>
                                        <label className="text-xs font-medium">Amounts</label>
                                        {command.amounts?.map((amt, idx) => (
                                          <div key={idx} className="flex gap-2 mt-1">
                                            <Input
                                              type="number"
                                              placeholder="Amount in nanoIOTA"
                                              value={amt.value || ''}
                                              onChange={(e) => {
                                                const amounts = [...(command.amounts || [])];
                                                amounts[idx] = { type: 'pure', value: parseInt(e.target.value) };
                                                updateCommand(command.id, { amounts });
                                              }}
                                              className="font-mono text-xs"
                                            />
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8"
                                              onClick={() => {
                                                const amounts = command.amounts?.filter((_, i) => i !== idx);
                                                updateCommand(command.id, { amounts });
                                              }}
                                            >
                                              <X className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        ))}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="mt-2"
                                          onClick={() => {
                                            const amounts = [...(command.amounts || []), { type: 'pure' as const, value: 1000000000 }];
                                            updateCommand(command.id, { amounts });
                                          }}
                                        >
                                          <Plus className="h-3.5 w-3.5 mr-1" />
                                          Add Amount
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel - Execution */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Execute</CardTitle>
                  <CardDescription>
                    Run your PTB on the blockchain
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status */}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      {commands.length === 0
                        ? "Add commands to build your PTB"
                        : `${commands.length} command(s) ready`}
                    </AlertDescription>
                  </Alert>

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleSimulate}
                      disabled={commands.length === 0 || isSimulating}
                    >
                      {isSimulating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4 mr-2" />
                      )}
                      Simulate (Dry Run)
                    </Button>

                    <Button
                      className="w-full"
                      onClick={handleExecute}
                      disabled={commands.length === 0 || !isConnected || isExecuting}
                    >
                      {isExecuting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Execute on {network}
                    </Button>
                  </div>

                  {/* Result */}
                  {executionResult && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Result</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExecutionResult(null)}
                        >
                          Clear
                        </Button>
                      </div>
                      <ScrollArea className="h-64 border rounded p-2">
                        <pre className="text-xs">
                          {JSON.stringify(executionResult, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Generated Code */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">TypeScript Code</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48 border rounded p-2">
                    <pre className="text-xs">
{`const tx = new Transaction();

${commands.map((cmd, idx) => {
  if (cmd.type === 'MoveCall') {
    return `// Command ${idx + 1}: ${cmd.description || 'MoveCall'}
tx.moveCall({
  target: '${cmd.target || 'package::module::function'}',
  arguments: [${cmd.arguments?.map(a => `tx.pure('${a.value}')`).join(', ') || ''}],
  typeArguments: [${cmd.typeArguments?.map(t => `'${t}'`).join(', ') || ''}]
});`;
  }
  if (cmd.type === 'SplitCoins') {
    return `// Command ${idx + 1}: ${cmd.description || 'SplitCoins'}
tx.splitCoins(tx.gas, [
  ${cmd.amounts?.map(a => `tx.pure.u64(${a.value})`).join(',\n  ') || ''}
]);`;
  }
  if (cmd.type === 'TransferObjects') {
    return `// Command ${idx + 1}: ${cmd.description || 'TransferObjects'}
tx.transferObjects(
  [...], // objects
  '${cmd.recipient?.value || '0x...'}'
);`;
  }
  return `// Command ${idx + 1}: ${cmd.type}`;
}).join('\n\n')}

// Execute
await wallet.signAndExecuteTransaction(tx);`}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="simulate" className="p-4">
          <Card>
            <CardHeader>
              <CardTitle>Simulation Results</CardTitle>
              <CardDescription>
                Test your PTB without spending gas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {executionResult ? (
                <ScrollArea className="h-96">
                  <pre className="text-xs">
                    {JSON.stringify(executionResult, null, 2)}
                  </pre>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <Eye className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Run a simulation to see results here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="p-4">
          <Card>
            <CardHeader>
              <CardTitle>PTB History</CardTitle>
              <CardDescription>
                Your recent PTB executions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {ptbHistory.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {item.ptb_config?.commands?.length || 0} commands
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(item.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={item.status === 'success' ? 'default' : 'destructive'}>
                              {item.status}
                            </Badge>
                            {item.transaction_hash && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => window.open(
                                  `https://explorer.iota.org/txblock/${item.transaction_hash}?network=${item.network}`,
                                  '_blank'
                                )}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}