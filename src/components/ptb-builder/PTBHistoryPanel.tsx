import { useState, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  Trash2,
  Copy,
  RefreshCw,
  Loader2,
  History,
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FunctionSquare,
  Send,
  Split,
  Merge,
  Code2,
  FileJson,
  Package,
  Hash,
  User,
  Network,
  ArrowRight,
  AlertCircle,
  Eye,
  Play,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface PTBHistoryPanelProps {
  projectId: string;
  selectedPackage?: string;
  refreshKey?: number;
  onReplay?: (commands: any[]) => void;
}

interface PTBHistoryItem {
  id: string;
  created_at: string;
  status: 'success' | 'failed';
  network: string;
  transaction_hash?: string;
  gas_used?: number;
  ptb_config: {
    commands?: any[];
    packageId?: string;
    mode?: string;
    walletAddress?: string;
    walletType?: string;
    functionName?: string;
    moduleName?: string;
    timestamp?: string;
  };
  execution_result?: {
    success?: boolean;
    transactionDigest?: string;
    gasUsed?: string;
    error?: string;
    returnValues?: any[];
    objectChanges?: any[];
    events?: any[];
    effects?: any;
    senderAddress?: string;
  };
}

export function PTBHistoryPanel({ projectId, selectedPackage, refreshKey, onReplay }: PTBHistoryPanelProps) {
  const [history, setHistory] = useState<PTBHistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<PTBHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PTBHistoryItem | null>(null);
  const [activeTab, setActiveTab] = useState<string>('details');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['commands']));
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed'>('all');
  const { user } = useAuth();
  const { toast } = useToast();

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchHistory();
  }, [projectId, selectedPackage, refreshKey]);

  useEffect(() => {
    // Apply filtering
    let filtered = [...history];
    
    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => item.status === filterStatus);
    }
    
    // Filter by selected package if provided
    if (selectedPackage) {
      filtered = filtered.filter(item => 
        item.ptb_config?.packageId === selectedPackage ||
        // Check if any MoveCall commands use this package
        item.ptb_config?.commands?.some((cmd: any) => 
          cmd.type === 'MoveCall' && cmd.target?.startsWith(selectedPackage)
        )
      );
    }
    
    setFilteredHistory(filtered);
    setCurrentPage(1);
  }, [history, selectedPackage, filterStatus]);

  const fetchHistory = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('ptb_history')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      // IMPORTANT: Filter to only show PTB Builder executions (those with commands array)
      const ptbExecutions = (data || []).filter(item => 
        item.ptb_config?.commands && Array.isArray(item.ptb_config.commands)
      );
      
      setHistory(ptbExecutions);
    } catch (error) {
      console.error('Failed to fetch PTB history:', error);
      toast({
        title: "Failed to load history",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHistory();
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ptb_history')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setHistory(history.filter(item => item.id !== id));
      toast({
        title: "Deleted",
        description: "PTB history item removed",
      });
    } catch (error) {
      toast({
        title: "Failed to delete",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  const openExplorer = (hash: string, network: string) => {
    window.open(
      `https://explorer.iota.org/txblock/${hash}?network=${network}`,
      '_blank'
    );
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Invalid date';
    }
  };

  const formatGas = (gas?: number) => {
    if (!gas) return 'N/A';
    const iota = gas / 1000000000;
    return `${iota.toFixed(4)} IOTA`;
  };

  const getCommandIcon = (type: string) => {
    switch (type) {
      case 'MoveCall': return <FunctionSquare className="h-3 w-3" />;
      case 'TransferObjects': return <Send className="h-3 w-3" />;
      case 'SplitCoins': return <Split className="h-3 w-3" />;
      case 'MergeCoins': return <Merge className="h-3 w-3" />;
      default: return <Code2 className="h-3 w-3" />;
    }
  };

  const getCommandColor = (type: string) => {
    switch (type) {
      case 'MoveCall': return 'text-blue-500';
      case 'TransferObjects': return 'text-green-500';
      case 'SplitCoins': return 'text-purple-500';
      case 'MergeCoins': return 'text-orange-500';
      default: return 'text-gray-500';
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const generateSDKCode = (item: PTBHistoryItem) => {
    const commands = item.ptb_config?.commands || [];
    
    let code = `import { Transaction } from '@iota/iota-sdk/transactions';\n`;
    code += `import { IotaClient } from '@iota/iota-sdk/client';\n\n`;
    code += `// Initialize client and transaction\n`;
    code += `const client = new IotaClient({ url: 'https://api.${item.network}.iota.cafe' });\n`;
    code += `const tx = new Transaction();\n\n`;
    code += `// Add commands\n`;
    
    commands.forEach((cmd: any, index: number) => {
      code += `// Command ${index + 1}: ${cmd.type}\n`;
      
      if (cmd.type === 'MoveCall') {
        code += `tx.moveCall({\n`;
        code += `  target: '${cmd.target}',\n`;
        if (cmd.arguments?.length > 0) {
          code += `  arguments: [\n`;
          cmd.arguments.forEach((arg: any) => {
            if (arg.type === 'object') {
              code += `    tx.object('${arg.value}'),\n`;
            } else if (arg.type === 'gas') {
              code += `    tx.gas,\n`;
            } else {
              code += `    tx.pure('${arg.value}'),\n`;
            }
          });
          code += `  ],\n`;
        }
        if (cmd.typeArguments?.length > 0) {
          code += `  typeArguments: ${JSON.stringify(cmd.typeArguments)},\n`;
        }
        code += `});\n\n`;
      } else {
        code += `// ${cmd.type} implementation\n`;
        code += `// ${JSON.stringify(cmd, null, 2)}\n\n`;
      }
    });
    
    code += `// Execute transaction\n`;
    code += `const result = await client.signAndExecuteTransaction({\n`;
    code += `  signer: keypair,\n`;
    code += `  transaction: tx,\n`;
    code += `});\n`;
    
    return code;
  };

  // Pagination
  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <div className="p-4 bg-muted rounded-full mb-4">
          <History className="h-8 w-8 text-muted-foreground" />
        </div>
        <h4 className="font-semibold mb-2">No PTB History Yet</h4>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your executed Programmable Transaction Blocks will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header with filters */}
      <div className="px-4 py-3 border-b bg-muted/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant={filterStatus === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilterStatus('all')}
            >
              All
              {filterStatus === 'all' && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1">
                  {history.length}
                </Badge>
              )}
            </Button>
            <Button
              variant={filterStatus === 'success' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilterStatus('success')}
            >
              <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
              Success
              {filterStatus === 'success' && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1">
                  {filteredHistory.length}
                </Badge>
              )}
            </Button>
            <Button
              variant={filterStatus === 'failed' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilterStatus('failed')}
            >
              <XCircle className="h-3 w-3 mr-1 text-red-500" />
              Failed
              {filterStatus === 'failed' && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1">
                  {filteredHistory.length}
                </Badge>
              )}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn(
              "h-3.5 w-3.5",
              isRefreshing && "animate-spin"
            )} />
          </Button>
        </div>
      </div>
      
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Compact Cards - Same style as Module Interface */}
        <div className="divide-y">
        {paginatedHistory.map((item) => {
          const commands = item.ptb_config?.commands || [];
          const firstMoveCall = commands.find((c: any) => c.type === 'MoveCall');
          const commandSummary = firstMoveCall 
            ? `${firstMoveCall.module || 'module'}::${firstMoveCall.function || 'function'}`
            : commands[0]?.type || 'PTB';
          
          return (
            <div
              key={item.id}
              onClick={() => {
                setSelectedItem(item);
                setActiveTab('details');
              }}
              className={cn(
                "group px-4 py-3.5 hover:bg-muted/50 transition-colors cursor-pointer",
                "border-l-2",
                item.status === 'success' && "border-l-green-500",
                item.status === 'failed' && "border-l-red-500"
              )}
            >
              <div className="flex items-center justify-between">
                {/* Left side - PTB info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    {/* Status Icon */}
                    {item.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                    
                    {/* Command Summary */}
                    <span className="font-mono text-sm font-medium truncate">
                      {commandSummary}
                    </span>
                    
                    {/* Command count badge */}
                    <Badge variant="outline" className="text-xs">
                      {commands.length} {commands.length === 1 ? 'command' : 'commands'}
                    </Badge>
                    
                    {/* Dry run badge */}
                    {item.ptb_config?.mode === 'dry-run' && (
                      <Badge variant="secondary" className="text-xs">
                        <Eye className="h-3 w-3 mr-1" />
                        Dry Run
                      </Badge>
                    )}
                  </div>
                  
                  {/* Metadata on second line */}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-1 cursor-help">
                            <Clock className="h-3 w-3" />
                            {formatTime(item.created_at)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{format(new Date(item.created_at), 'PPpp')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    {/* Separator */}
                    <span className="text-muted-foreground">|</span>
                    
                    {/* Gas with icon */}
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-yellow-500" />
                      <span>Gas: {formatGas(item.gas_used)}</span>
                    </span>
                    
                    {/* Network */}
                    <span className="text-muted-foreground">|</span>
                    <Badge variant="outline" className="text-xs h-4">
                      {item.network}
                    </Badge>
                    
                    {/* Wallet Type */}
                    {item.ptb_config?.walletType && (
                      <>
                        <span className="text-muted-foreground">|</span>
                        <span className="text-xs">
                          {item.ptb_config.walletType}
                        </span>
                      </>
                    )}
                    
                    {/* Transaction hash */}
                    {item.transaction_hash && (
                      <>
                        <span className="text-muted-foreground">|</span>
                        <span 
                          className="font-mono cursor-pointer hover:text-primary transition-colors flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            openExplorer(item.transaction_hash!, item.network);
                          }}
                        >
                          {item.transaction_hash.slice(0, 8)}...
                          <ExternalLink className="h-2.5 w-2.5" />
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right side - Actions */}
                <div className="flex items-center gap-2 ml-4">
                  {/* Command type icons */}
                  <div className="flex items-center gap-0.5">
                    {Array.from(new Set(commands.map((c: any) => c.type))).map((type: any) => (
                      <div key={type} className={cn("p-1", getCommandColor(type))}>
                        {getCommandIcon(type)}
                      </div>
                    ))}
                  </div>
                  
                  {/* Replay button */}
                  {onReplay && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReplay(commands);
                            }}
                          >
                            <Play className="h-3.5 w-3.5 text-primary" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Replay in Builder</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Pagination - Fixed at bottom */}
      {totalPages > 1 && (
        <div className="mt-auto p-3 border-t bg-muted/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      {selectedItem && (
        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  PTB Execution Details
                  {selectedItem.status === 'success' ? (
                    <Badge variant="default">Success</Badge>
                  ) : (
                    <Badge variant="destructive">Failed</Badge>
                  )}
                </div>
                {onReplay && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onReplay(selectedItem.ptb_config?.commands || []);
                      setSelectedItem(null);
                    }}
                    className="gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Replay in Builder
                  </Button>
                )}
              </DialogTitle>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="raw">Raw Transaction</TabsTrigger>
                <TabsTrigger value="sdk">SDK Code</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4 pr-4">
                    {/* Commands Section */}
                    <Collapsible open={expandedSections.has('commands')}>
                      <CollapsibleTrigger
                        className="flex items-center gap-2 w-full p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                        onClick={() => toggleSection('commands')}
                      >
                        <Code2 className="h-4 w-4" />
                        <span className="font-medium">Commands</span>
                        <Badge variant="outline" className="ml-2">
                          {selectedItem.ptb_config?.commands?.length || 0}
                        </Badge>
                        {expandedSections.has('commands') ? (
                          <ChevronUp className="h-4 w-4 ml-auto" />
                        ) : (
                          <ChevronDown className="h-4 w-4 ml-auto" />
                        )}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-2">
                        {selectedItem.ptb_config?.commands?.map((cmd: any, idx: number) => (
                          <div 
                            key={idx} 
                            className="p-3 bg-background rounded-lg border"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="font-mono">
                                {idx + 1}
                              </Badge>
                              <div className={cn("flex items-center gap-1", getCommandColor(cmd.type))}>
                                {getCommandIcon(cmd.type)}
                                <span className="text-sm font-medium text-foreground">
                                  {cmd.type}
                                </span>
                              </div>
                            </div>
                            <pre className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(cmd, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Transaction Info */}
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        Transaction Information
                      </h4>
                      <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                        {selectedItem.transaction_hash && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Hash:</span>
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono">
                                {selectedItem.transaction_hash}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(selectedItem.transaction_hash!, 'Transaction hash')}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Network:</span>
                          <Badge variant="outline">{selectedItem.network}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Gas Used:</span>
                          <span className="text-sm font-mono">{formatGas(selectedItem.gas_used)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Time:</span>
                          <span className="text-sm">{formatTime(selectedItem.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Error Message */}
                    {selectedItem.execution_result?.error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {selectedItem.execution_result.error}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Return Values */}
                    {selectedItem.execution_result?.returnValues && 
                     selectedItem.execution_result.returnValues.length > 0 && (
                      <Collapsible open={expandedSections.has('returns')}>
                        <CollapsibleTrigger
                          className="flex items-center gap-2 w-full p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                          onClick={() => toggleSection('returns')}
                        >
                          <ArrowRight className="h-4 w-4" />
                          <span className="font-medium">Return Values</span>
                          {expandedSections.has('returns') ? (
                            <ChevronUp className="h-4 w-4 ml-auto" />
                          ) : (
                            <ChevronDown className="h-4 w-4 ml-auto" />
                          )}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <pre className="text-xs font-mono bg-muted p-3 rounded overflow-x-auto">
                            {JSON.stringify(selectedItem.execution_result.returnValues, null, 2)}
                          </pre>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="raw" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <pre className="text-xs font-mono whitespace-pre overflow-x-auto">
                      {JSON.stringify(selectedItem, null, 2)}
                    </pre>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="sdk" className="mt-4">
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Beta Feature: This SDK code generation is in beta and may have issues.
                    Please review all generated code carefully before using in production.
                  </AlertDescription>
                </Alert>
                <ScrollArea className="h-[400px]">
                  <SyntaxHighlighter
                    language="typescript"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                    }}
                  >
                    {generateSDKCode(selectedItem)}
                  </SyntaxHighlighter>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}