import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  Trash2,
  Copy,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface PTBHistoryPanelProps {
  projectId: string;
  selectedPackage?: string;
  refreshKey?: number;
}

interface PTBHistoryItem {
  id: string;
  created_at: string;
  status: 'success' | 'failed';
  network: string;
  transaction_hash?: string;
  gas_used?: number;
  ptb_config: {
    commands: any[];
  };
  execution_result?: any;
}

export function PTBHistoryPanel({ projectId, selectedPackage, refreshKey }: PTBHistoryPanelProps) {
  const [history, setHistory] = useState<PTBHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchHistory();
  }, [projectId, selectedPackage, refreshKey]);

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
        .limit(50);

      if (error) throw error;
      
      // Filter by selected package if provided
      let filteredData = data || [];
      if (selectedPackage) {
        filteredData = filteredData.filter(item => 
          item.ptb_config?.packageId === selectedPackage ||
          // Also check if any MoveCall commands use this package
          item.ptb_config?.commands?.some((cmd: any) => 
            cmd.type === 'MoveCall' && cmd.target?.startsWith(selectedPackage)
          )
        );
      }
      
      setHistory(filteredData);
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

  const copyTransactionHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast({
      title: "Copied",
      description: "Transaction hash copied to clipboard",
    });
  };

  const openExplorer = (hash: string, network: string) => {
    window.open(
      `https://explorer.iota.org/transaction/${hash}?network=${network}`,
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
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h4 className="font-semibold mb-2">No History Yet</h4>
        <p className="text-sm text-muted-foreground max-w-sm">
          {selectedPackage 
            ? 'No PTBs executed for this package yet'
            : 'Your executed PTBs will appear here'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Execution History</span>
            <Badge variant="outline">{history.length} items</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn(
              "h-4 w-4",
              isRefreshing && "animate-spin"
            )} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {history.map((item) => (
            <Card key={item.id} className="relative group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      {item.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <Badge variant={item.status === 'success' ? 'default' : 'destructive'}>
                        {item.status}
                      </Badge>
                      <Badge variant="outline">
                        {item.network}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(item.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Commands:</span>
                        <Badge variant="secondary" className="px-1 py-0">
                          {item.ptb_config?.commands?.length || 0}
                        </Badge>
                      </div>
                      
                      {item.gas_used && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Gas:</span>
                          <Badge variant="secondary" className="px-1 py-0">
                            {formatGas(item.gas_used)}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {item.transaction_hash && (
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[300px]">
                          {item.transaction_hash}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyTransactionHash(item.transaction_hash!)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => openExplorer(item.transaction_hash!, item.network)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {item.ptb_config?.commands && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.ptb_config.commands.map((cmd: any, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {cmd.type}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}