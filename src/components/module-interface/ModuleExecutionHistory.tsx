import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  History,
  ArrowUpDown,
  Eye,
  Copy,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ModuleExecutionHistoryProps {
  projectId: string;
  selectedDeployment?: any;
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
  };
  execution_result: {
    success?: boolean;
    transactionDigest?: string;
    gasUsed?: string;
    error?: string;
    returnValues?: any[];
  };
  network: string;
  transaction_hash?: string;
  gas_used?: number;
  status: 'pending' | 'success' | 'failed';
  created_at: string;
}

export function ModuleExecutionHistory({ projectId, selectedDeployment }: ModuleExecutionHistoryProps) {
  const [calls, setCalls] = useState<ExecutionHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedCall, setSelectedCall] = useState<ExecutionHistory | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCalls();
  }, [projectId, selectedDeployment, sortOrder]);

  const fetchCalls = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching execution history for project:', projectId, 'deployment:', selectedDeployment?.package_id);
      
      const { data, error } = await supabase
        .from('ptb_history')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: sortOrder === 'asc' });

      if (error) {
        console.error('Database error fetching execution history:', error);
        throw error;
      }
      
      // Filter by deployment package_id on the client side
      let filteredData = data || [];
      if (selectedDeployment?.package_id) {
        console.log('Filtering by packageId:', selectedDeployment.package_id);
        filteredData = filteredData.filter(call => 
          call.ptb_config?.packageId === selectedDeployment.package_id ||
          call.ptb_config?.deploymentId === selectedDeployment.package_id
        );
      }
      
      console.log('Fetched execution history:', filteredData.length, 'records');
      if (filteredData.length > 0) {
        console.log('Sample ptb_config:', filteredData[0].ptb_config);
      }
      
      setCalls(filteredData);
    } catch (error) {
      console.error('Error fetching execution history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/10 text-green-500';
      case 'error':
        return 'bg-red-500/10 text-red-500';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: "Content copied to clipboard",
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex p-3 bg-primary/10 rounded-lg mb-4">
            <Clock className="h-6 w-6 text-primary animate-spin" />
          </div>
          <h3 className="font-medium mb-1">Loading History</h3>
          <p className="text-sm text-muted-foreground">
            Please wait while we fetch the execution history
          </p>
        </div>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/40">
        <div className="text-center">
          <div className="inline-flex p-3 bg-primary/10 rounded-lg mb-6">
            <History className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <h3 className="font-medium mb-3">No Execution History</h3>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Start executing functions from your deployed module
            </p>
            <p className="text-sm text-muted-foreground">
              to see your transaction history here
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-none px-4 py-3 border-b bg-muted/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {calls.length} {calls.length === 1 ? 'execution' : 'executions'} recorded
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 h-7"
              onClick={() => fetchCalls()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="text-xs">Refresh</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 h-7"
              onClick={() => setSortOrder(order => order === 'desc' ? 'asc' : 'desc')}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="text-xs">{sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}</span>
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 bg-muted/40">
        <div className="divide-y">
          {calls.map((call) => {
            const functionName = call.ptb_config?.functionName || 'unknown';
            const moduleName = call.ptb_config?.moduleName || 'module';
            const packageId = call.ptb_config?.packageId || call.transaction_hash || '';
            const txHash = call.execution_result?.transactionDigest || call.transaction_hash || '';
            
            return (
              <div
                key={call.id}
                onClick={() => setSelectedCall(call)}
                className={cn(
                  "group relative flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
                )}
              >
                <div className="flex-none">
                  {call.status === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : call.status === 'failed' ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-yellow-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{moduleName}::{functionName}</span>
                    <Badge variant="outline" className={cn("text-[10px]", getStatusColor(call.status))}>
                      {call.status}
                    </Badge>
                    {call.network && (
                      <Badge variant="outline" className="text-[10px]">
                        {call.network}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {txHash && (
                      <>
                        <code className="font-mono">
                          {txHash.slice(0, 8)}...{txHash.slice(-6)}
                        </code>
                        <span>•</span>
                      </>
                    )}
                    <span>{formatDate(call.created_at)}</span>
                    {call.gas_used && (
                      <>
                        <span>•</span>
                        <span>{(call.gas_used / 1e9).toFixed(3)} IOTA</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCall(call);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {txHash && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(
                          `https://explorer.iota.org/txblock/${txHash}?network=${call.network || 'testnet'}`,
                          '_blank'
                        );
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <Dialog open={selectedCall !== null} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          {selectedCall && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>
                    {selectedCall.ptb_config?.moduleName}::{selectedCall.ptb_config?.functionName || 'Function Execution'}
                  </span>
                  <Badge variant="outline" className={cn(getStatusColor(selectedCall.status))}>
                    {selectedCall.status}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-4">
                  {/* Transaction Hash */}
                  {(selectedCall.execution_result?.transactionDigest || selectedCall.transaction_hash) && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 pt-4">Transaction Hash</h4>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <Terminal className="h-4 w-4 text-muted-foreground" />
                          <code className="font-mono text-sm">
                            {(() => {
                              const txHash = selectedCall.execution_result?.transactionDigest || selectedCall.transaction_hash || '';
                              return txHash.slice(0, 12) + '...' + txHash.slice(-8);
                            })()}
                          </code>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleCopy(selectedCall.execution_result?.transactionDigest || selectedCall.transaction_hash || '')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const txHash = selectedCall.execution_result?.transactionDigest || selectedCall.transaction_hash || '';
                              window.open(
                                `https://explorer.iota.org/txblock/${txHash}?network=${selectedCall.network || 'testnet'}`,
                                '_blank'
                              );
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Input Parameters */}
                  {selectedCall.ptb_config?.parameters && selectedCall.ptb_config.parameters.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Input Parameters</h4>
                      <div className="space-y-2">
                        {selectedCall.ptb_config.parameters.map((param: any, index: number) => (
                          <div key={index} className="p-3 bg-muted rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-sm text-muted-foreground">
                                Parameter {index + 1}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleCopy(JSON.stringify(param))}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                              {JSON.stringify(param, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Output/Results */}
                  {selectedCall.status === 'success' && selectedCall.execution_result?.returnValues && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">Return Values</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5"
                          onClick={() => handleCopy(JSON.stringify(selectedCall.execution_result.returnValues, null, 2))}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span className="text-xs">Copy</span>
                        </Button>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                          {JSON.stringify(selectedCall.execution_result.returnValues, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {selectedCall.status === 'failed' && selectedCall.execution_result?.error && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">Error</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5"
                          onClick={() => handleCopy(selectedCall.execution_result?.error || '')}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span className="text-xs">Copy</span>
                        </Button>
                      </div>
                      <div className="p-3 bg-red-500/10 text-red-500 rounded-lg">
                        <pre className="text-sm whitespace-pre-wrap break-all">
                          {selectedCall.execution_result?.error}
                        </pre>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Executed {formatDate(selectedCall.created_at)}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}