import { useState, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { 
  Clock, 
  CheckCircle, 
  XCircle,
  History,
  Zap,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  User,
  ExternalLink,
  Copy,
  Code2,
  FileJson,
  Package,
  Hash,
  ChevronDown,
  ChevronUp,
  Network,
  ArrowRight,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface EnhancedExecutionHistoryProps {
  projectId: string;
  selectedDeployment?: any;
  onReplayFunction?: (functionName: string, parameters: any[]) => void;
  filterStatus?: 'all' | 'success' | 'failed';
}

interface ExecutionHistory {
  id: string;
  user_id: string;
  project_id: string;
  ptb_config: {
    functionName?: string;
    moduleName?: string;
    packageId?: string;
    parameters?: any[];
    deploymentId?: string;
    signerAddress?: string; // Add signer address
  };
  execution_result: {
    success?: boolean;
    transactionDigest?: string;
    gasUsed?: string;
    error?: string;
    returnValues?: any[];
    signerAddress?: string; // Also check here
  };
  network: string;
  transaction_hash?: string;
  gas_used?: number;
  status: 'pending' | 'success' | 'failed';
  created_at: string;
  signer_address?: string; // Top level signer
}

export function EnhancedExecutionHistory({ 
  projectId, 
  selectedDeployment,
  onReplayFunction,
  filterStatus = 'all'
}: EnhancedExecutionHistoryProps) {
  const [calls, setCalls] = useState<ExecutionHistory[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<ExecutionHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<ExecutionHistory | null>(null);
  const [activeTab, setActiveTab] = useState<string>('details');
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchCalls();
  }, [projectId, selectedDeployment]);

  useEffect(() => {
    // Apply filters
    let filtered = [...calls];
    
    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(call => 
        filterStatus === 'success' ? call.status === 'success' : call.status === 'failed'
      );
    }
    
    setFilteredCalls(filtered);
  }, [calls, filterStatus]);

  const fetchCalls = async () => {
    try {
      setIsLoading(true);
      
      console.log('Fetching execution history for project:', projectId);
      
      const { data, error } = await supabase
        .from('ptb_history')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error fetching execution history:', error);
        // Don't throw the error, just handle it gracefully
        setCalls([]);
        return;
      }
      
      // Filter by deployment package_id on the client side
      let filteredData = data || [];
      if (selectedDeployment?.package_id) {
        filteredData = filteredData.filter(call => 
          call.ptb_config?.packageId === selectedDeployment.package_id ||
          call.ptb_config?.deploymentId === selectedDeployment.package_id
        );
      }
      
      setCalls(filteredData);
    } catch (error) {
      console.error('Error fetching execution history:', error);
      // Silently handle the error - don't show toast
      setCalls([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string, detailed = false) => {
    if (detailed) {
      return format(new Date(dateString), 'PPpp');
    }
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const formatGasAmount = (gas?: number): string => {
    if (!gas || gas === 0) return '0 IOTA';
    const iota = gas / 1_000_000_000;
    // Format with 4 decimal places for non-zero values
    return `${iota.toFixed(4)} IOTA`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
  };

  const generateTypeScriptCode = (call: ExecutionHistory) => {
    const params = call.ptb_config.parameters || [];
    const paramString = params.map(p => JSON.stringify(p)).join(', ');
    
    // Break the target string into parts for better readability
    const packageId = call.ptb_config.packageId || '0x...';
    const moduleName = call.ptb_config.moduleName || 'module';
    const functionName = call.ptb_config.functionName || 'function';
    
    return `import { IotaClient } from '@iota/iota-sdk/client';
import { TransactionBlock } from '@iota/iota-sdk/transactions';
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';

// ==========================================
// Initialize IOTA Client
// ==========================================

const client = new IotaClient({ 
  url: 'https://api.${call.network || 'testnet'}.iota.cafe' 
});

// ==========================================
// Create Transaction Block
// ==========================================

const tx = new TransactionBlock();

// Define the target function
const packageId = '${packageId}';
const moduleName = '${moduleName}';
const functionName = '${functionName}';

// Call the Move function
tx.moveCall({
  target: \`\${packageId}::\${moduleName}::\${functionName}\`,
  arguments: [${paramString ? `\n    ${paramString.replace(/,/g, ',\n    ')}\n  ` : ''}],
});

// ==========================================
// Sign and Execute Transaction
// ==========================================

// Initialize your keypair (replace with your actual private key)
const keypair = Ed25519Keypair.fromSecretKey('YOUR_PRIVATE_KEY');

// Execute the transaction
const result = await client.signAndExecuteTransactionBlock({
  transactionBlock: tx,
  signer: keypair,
});

// Log the transaction digest
console.log('Transaction digest:', result.digest);
console.log('View on explorer: https://explorer.iota.org/tx/' + result.digest);`;
  };



  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-6 w-6 text-primary animate-spin mx-auto mb-2" />
          <h3 className="font-medium mb-1">Loading History</h3>
          <p className="text-sm text-muted-foreground">
            Fetching execution history...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">

      {filteredCalls.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-flex p-3 bg-primary/10 rounded-lg mb-4">
              <History className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium mb-1">No Execution History</h3>
            <p className="text-sm text-muted-foreground">
              {filterStatus !== 'all'
                ? "No executions match your filters"
                : "Execute some functions to see them here"
              }
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Compact Cards */}
          <div className="divide-y">
            {filteredCalls
              .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
              .map((call) => (
              <div
                key={call.id}
                onClick={() => {
                  setSelectedCall(call);
                  setActiveTab('details');
                }}
                className={cn(
                  "group px-4 py-3.5 hover:bg-muted/50 transition-colors cursor-pointer",
                  "border-l-2",
                  call.status === 'success' && "border-l-green-500",
                  call.status === 'failed' && "border-l-red-500",
                  call.status === 'pending' && "border-l-yellow-500"
                )}
              >
                <div className="flex items-center justify-between">
                  {/* Left side - Function info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      {/* Status Icon */}
                      {getStatusIcon(call.status)}
                      
                      {/* Function and Module */}
                      <span className="font-mono text-sm font-medium">
                        {call.ptb_config.functionName || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        in {call.ptb_config.moduleName || 'unknown'}
                      </span>
                    </div>
                    
                    {/* Metadata on second line */}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 cursor-help">
                              <Clock className="h-3 w-3" />
                              {formatDate(call.created_at)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{formatDate(call.created_at, true)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      {/* Separator */}
                      <span className="text-muted-foreground">|</span>
                      
                      {/* Gas with icon */}
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-yellow-500" />
                        <span>Gas: {formatGasAmount(call.gas_used)}</span>
                      </span>
                      
                      {/* Signer/Wallet Address */}
                      {(call.signer_address || call.ptb_config?.signerAddress || call.execution_result?.signerAddress) && (
                        <>
                          <span className="text-muted-foreground">|</span>
                          <span 
                            className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              const address = call.signer_address || call.ptb_config?.signerAddress || call.execution_result?.signerAddress;
                              const explorerUrl = `https://explorer.iota.org/address/${address}?network=${call.network || 'testnet'}`;
                              window.open(explorerUrl, '_blank');
                            }}
                          >
                            <User className="h-3 w-3" />
                            <span className="font-mono">
                              {(call.signer_address || call.ptb_config?.signerAddress || call.execution_result?.signerAddress || '').slice(0, 6)}...
                            </span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </span>
                        </>
                      )}
                      
                      {call.transaction_hash && (
                        <>
                          <span className="text-muted-foreground">|</span>
                          <span className="font-mono">
                            {call.transaction_hash.slice(0, 8)}...
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Right side - View Details */}
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
          
          {/* Simplified Pagination */}
          {filteredCalls.length > ITEMS_PER_PAGE && (
            <div className="border-t px-4 py-2 flex items-center justify-between bg-muted/10">
              <span className="text-xs text-muted-foreground">
                {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredCalls.length)} of {filteredCalls.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs px-2">
                  {currentPage} / {Math.ceil(filteredCalls.length / ITEMS_PER_PAGE)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredCalls.length / ITEMS_PER_PAGE), p + 1))}
                  disabled={currentPage === Math.ceil(filteredCalls.length / ITEMS_PER_PAGE)}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Professional Execution Detail Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={(open) => !open && setSelectedCall(null)}>
        <DialogContent className="max-w-[720px] max-h-[85vh] overflow-hidden">
          {selectedCall && (
            <div className="flex flex-col h-full">
              {/* Professional Header */}
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      selectedCall.status === 'success' ? 'bg-green-500/10' : 'bg-red-500/10'
                    )}>
                      {getStatusIcon(selectedCall.status)}
                    </div>
                    <div>
                      <p className="font-semibold text-base">
                        {selectedCall.ptb_config.functionName || 'Unknown Function'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedCall.ptb_config.moduleName || 'Unknown Module'} • {formatDate(selectedCall.created_at)}
                      </p>
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col mt-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details">Execution Details</TabsTrigger>
                  <TabsTrigger value="code">SDK Code</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="flex-1 overflow-y-auto mt-3">
                  <div className="space-y-4">
                    {/* Compact Metrics Bar */}
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <Badge 
                        variant={selectedCall.status === 'success' ? 'default' : 'destructive'}
                        className="gap-1"
                      >
                        {selectedCall.status === 'success' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {selectedCall.status}
                      </Badge>
                      
                      <div className="flex items-center gap-1 text-sm">
                        <Zap className="h-3.5 w-3.5 text-orange-500" />
                        <span className="font-mono text-xs">{formatGasAmount(selectedCall.gas_used)}</span>
                      </div>
                      
                      <div className="flex items-center gap-1 text-sm">
                        <Network className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-xs capitalize">{selectedCall.network || 'testnet'}</span>
                      </div>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 text-sm ml-auto cursor-help">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{formatDate(selectedCall.created_at)}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{formatDate(selectedCall.created_at, true)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {/* Transaction Detail Cards */}
                    <div className="grid gap-3">
                      {/* Combined Package & Signer Card */}
                      <div className="border rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <Package className="h-4 w-4 text-purple-500 mt-0.5" />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">Package & Execution Info</span>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => window.open(`https://explorer.iota.org/object/${selectedCall.ptb_config.packageId}?network=${selectedCall.network}`, '_blank')}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Explorer
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => {
                                    navigator.clipboard.writeText(selectedCall.ptb_config.packageId || '');
                                    toast({ description: "Package ID copied" });
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            
                            {/* Package ID */}
                            <div className="space-y-1">
                              <code className="text-xs font-mono text-muted-foreground block cursor-pointer hover:text-primary"
                                    onClick={() => window.open(`https://explorer.iota.org/object/${selectedCall.ptb_config.packageId}?network=${selectedCall.network}`, '_blank')}>
                                {selectedCall.ptb_config.packageId ? 
                                  `${selectedCall.ptb_config.packageId.slice(0, 10)}...${selectedCall.ptb_config.packageId.slice(-8)}` : 
                                  'N/A'}
                              </code>
                              <div className="text-xs text-primary font-mono">
                                {selectedCall.ptb_config.moduleName}::{selectedCall.ptb_config.functionName}
                              </div>
                            </div>

                            {/* Signer Info */}
                            {(selectedCall.signer_address || selectedCall.ptb_config?.signerAddress) && (
                              <div className="pt-2 border-t">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <User className="h-3.5 w-3.5 text-blue-500" />
                                    <span className="text-xs text-muted-foreground">Triggered by</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1 text-xs"
                                    onClick={() => {
                                      const address = selectedCall.signer_address || selectedCall.ptb_config?.signerAddress;
                                      window.open(`https://explorer.iota.org/address/${address}?network=${selectedCall.network}`, '_blank');
                                    }}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </div>
                                <code className="text-xs font-mono text-muted-foreground mt-1 block">
                                  {(selectedCall.signer_address || selectedCall.ptb_config?.signerAddress || '').slice(0, 12)}...{(selectedCall.signer_address || selectedCall.ptb_config?.signerAddress || '').slice(-10)}
                                </code>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Transaction Hash Card */}
                      {selectedCall.transaction_hash && (
                        <div className="border rounded-lg p-3">
                          <div className="flex items-start gap-3">
                            <Hash className="h-4 w-4 text-green-500 mt-0.5" />
                            <div className="flex-1 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium">Transaction Digest</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => window.open(`https://explorer.iota.org/tx/${selectedCall.transaction_hash}?network=${selectedCall.network}`, '_blank')}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Explorer
                                </Button>
                              </div>
                              <code className="text-xs font-mono text-muted-foreground">
                                {selectedCall.transaction_hash.slice(0, 12)}...{selectedCall.transaction_hash.slice(-10)}
                              </code>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Input Parameters Card */}
                    {selectedCall.ptb_config.parameters && selectedCall.ptb_config.parameters.length > 0 && (
                      <div className="border rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <Code2 className="h-4 w-4 text-yellow-500 mt-0.5" />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">Input Parameters</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  navigator.clipboard.writeText(JSON.stringify(selectedCall.ptb_config.parameters, null, 2));
                                  toast({ description: "Parameters copied" });
                                }}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {selectedCall.ptb_config.parameters.map((param: any, index: number) => {
                                // Detect type based on value
                                let paramType = 'value';
                                let displayValue = param;
                                
                                if (typeof param === 'string' && param.startsWith('0x') && param.length > 40) {
                                  paramType = 'address';
                                  displayValue = `${param.slice(0, 10)}...${param.slice(-8)}`;
                                } else if (typeof param === 'number' || !isNaN(Number(param))) {
                                  paramType = 'number';
                                } else if (typeof param === 'string') {
                                  paramType = 'string';
                                } else if (typeof param === 'boolean') {
                                  paramType = 'boolean';
                                } else if (typeof param === 'object') {
                                  paramType = 'object';
                                  displayValue = JSON.stringify(param, null, 2);
                                }

                                return (
                                  <div key={index} className="flex items-start gap-2 p-2 bg-muted/30 rounded">
                                    <span className="text-xs font-medium text-muted-foreground min-w-[60px]">
                                      Input {index + 1}
                                    </span>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <code className="text-xs font-mono text-primary">
                                          {displayValue}
                                        </code>
                                        {paramType === 'address' && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 w-5 p-0"
                                            onClick={() => window.open(`https://explorer.iota.org/address/${param}?network=${selectedCall.network}`, '_blank')}
                                          >
                                            <ExternalLink className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                      <span className="text-xs text-muted-foreground">
                                        Type: {paramType}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Execution Result Card - Only show if there's an error or return values */}
                    {(selectedCall.execution_result.error || selectedCall.execution_result.returnValues) && (
                      <div className={cn(
                        "border rounded-lg p-3",
                        selectedCall.execution_result.error ? "border-red-500/30 bg-red-500/5" : "border-green-500/30 bg-green-500/5"
                      )}>
                        <div className="flex items-start gap-3">
                          {selectedCall.execution_result.error ? (
                            <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          )}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-xs font-medium",
                                selectedCall.execution_result.error ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                              )}>
                                {selectedCall.execution_result.error ? "Execution Failed" : "Return Values"}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  const content = selectedCall.execution_result.error || 
                                    JSON.stringify(selectedCall.execution_result.returnValues, null, 2);
                                  navigator.clipboard.writeText(content);
                                  toast({ description: "Result copied" });
                                }}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </Button>
                            </div>
                            {selectedCall.execution_result.error ? (
                              <pre className="text-xs font-mono text-red-600/80 dark:text-red-400/80 whitespace-pre-wrap max-h-32 overflow-auto">
                                {selectedCall.execution_result.error}
                              </pre>
                            ) : (
                              <div className="bg-green-500/10 rounded p-2 max-h-32 overflow-auto">
                                <pre className="text-xs font-mono">
                                  <code>{JSON.stringify(selectedCall.execution_result.returnValues, null, 2)}</code>
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Raw Output Section */}
                    <Collapsible>
                      <CollapsibleTrigger className="w-full">
                        <div className="border rounded-lg p-3 hover:bg-muted/30 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            <FileJson className="h-4 w-4 text-orange-500" />
                            <span className="text-xs font-medium flex-1 text-left">Raw Transaction Data</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                JSON
                              </Badge>
                              <ChevronDown className="h-4 w-4 transition-transform [&[data-state=open]]:rotate-180" />
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="border rounded-lg overflow-hidden">
                          <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center justify-between">
                            <span className="text-xs font-mono text-slate-400">transaction.json</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-slate-400 hover:text-slate-200"
                              onClick={() => {
                                const rawData = {
                                  id: selectedCall.id,
                                  status: selectedCall.status,
                                  network: selectedCall.network,
                                  gas_used: selectedCall.gas_used,
                                  transaction_hash: selectedCall.transaction_hash,
                                  signer_address: selectedCall.signer_address,
                                  created_at: selectedCall.created_at,
                                  ptb_config: selectedCall.ptb_config,
                                  execution_result: selectedCall.execution_result
                                };
                                navigator.clipboard.writeText(JSON.stringify(rawData, null, 2));
                                toast({ description: "Raw data copied" });
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <div className="max-h-64 overflow-y-auto overflow-x-auto bg-slate-900">
                            <SyntaxHighlighter 
                              language="json"
                              style={vscDarkPlus}
                              wrapLongLines={true}
                              customStyle={{
                                margin: 0,
                                background: 'transparent',
                                fontSize: '11px',
                                lineHeight: '1.5',
                                padding: '12px',
                              }}
                            >
                              {JSON.stringify({
                                id: selectedCall.id,
                                status: selectedCall.status,
                                network: selectedCall.network,
                                gas_used: selectedCall.gas_used,
                                transaction_hash: selectedCall.transaction_hash,
                                signer_address: selectedCall.signer_address,
                                created_at: selectedCall.created_at,
                                ptb_config: selectedCall.ptb_config,
                                execution_result: selectedCall.execution_result
                              }, null, 2)}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Call to Action Footer */}
                    <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Reproduce this transaction</p>
                          <p className="text-xs text-muted-foreground">
                            Get the SDK code to run this transaction in your application
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setActiveTab('code');
                          }}
                        >
                          View SDK Code
                          <ArrowRight className="h-3.5 w-3.5 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="code" className="mt-3 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">SDK Integration Code</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          const code = generateTypeScriptCode(selectedCall);
                          navigator.clipboard.writeText(code);
                          toast({ description: "Code copied to clipboard" });
                        }}
                      >
                        <Copy className="h-3.5 w-3.5 mr-2" />
                        Copy
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-2">
                      <p>
                        Use this TypeScript code to reproduce the same transaction in your application.
                      </p>
                      <p>
                        Install the required dependencies with <code className="px-1 py-0.5 bg-muted rounded">npm install @iota/iota-sdk</code> and replace 'YOUR_PRIVATE_KEY' with your actual private key.
                      </p>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg bg-slate-50 dark:bg-slate-900/50 overflow-hidden">
                    <div className="border-b bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5">
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-400">index.ts</span>
                    </div>
                    <div className="max-h-96 overflow-x-auto overflow-y-auto">
                      <pre className="p-4 text-xs min-w-0">
                        <code className="text-slate-800 dark:text-slate-200 whitespace-pre break-words">{generateTypeScriptCode(selectedCall)}</code>
                      </pre>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}