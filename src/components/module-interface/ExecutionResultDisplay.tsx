import { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  Copy, 
  ChevronDown,
  ChevronRight,
  Zap,
  Package,
  Calendar,
  Hash,
  Coins,
  FileJson,
  Download,
  Code2,
  AlertCircle,
  Activity
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface ExecutionResult {
  status: 'success' | 'error' | 'pending';
  // Transaction info
  txHash?: string;
  digest?: string;
  network?: 'testnet' | 'mainnet';
  timestamp?: string;
  
  // Gas info
  gasUsed?: string;
  gasBudget?: string;
  gasPrice?: string;
  computationCost?: string;
  storageCost?: string;
  storageRebate?: string;
  
  // Results
  returnValues?: any[];
  objectChanges?: any[];
  events?: any[];
  balanceChanges?: any[];
  effects?: any;
  
  // Error info
  error?: string;
  errorDetails?: any;
  
  // Metadata
  functionName?: string;
  moduleName?: string;
  packageId?: string;
  parameters?: any[];
  executionTime?: number;
}

interface ExecutionResultDisplayProps {
  result: ExecutionResult;
  className?: string;
  onClose?: () => void;
  showCodeGeneration?: boolean;
}

export function ExecutionResultDisplay({ 
  result, 
  className,
  onClose,
  showCodeGeneration = true
}: ExecutionResultDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
  const { toast } = useToast();

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (content: string, label: string = 'Content') => {
    await navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  const formatGasAmount = (amount: string | number | undefined): string => {
    if (!amount) return '0';
    const num = typeof amount === 'string' ? parseInt(amount) : amount;
    const iota = num / 1_000_000_000;
    return `${iota.toFixed(4)} IOTA`;
  };

  const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return new Date().toISOString();
    return new Date(timestamp).toLocaleString();
  };

  const generateSDKCode = (): string => {
    if (!result.functionName || !result.packageId) return '';
    
    const params = result.parameters?.map((p, i) => `  args[${i}], // ${JSON.stringify(p)}`).join('\n') || '';
    
    return `import { Transaction } from '@iota/iota-sdk/transactions';
import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';

const client = new IotaClient({ url: getFullnodeUrl('${result.network || 'testnet'}') });
const tx = new Transaction();

// Add the move call
tx.moveCall({
  target: '${result.packageId}::${result.moduleName || 'module'}::${result.functionName}',
  arguments: [
${params}
  ],
});

// Execute transaction
const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
  options: {
    showEffects: true,
    showObjectChanges: true,
  }
});`;
  };

  const exportResults = () => {
    const exportData = {
      execution: {
        status: result.status,
        timestamp: result.timestamp || new Date().toISOString(),
        network: result.network,
        function: `${result.packageId}::${result.moduleName}::${result.functionName}`,
        parameters: result.parameters,
      },
      transaction: result.txHash ? {
        digest: result.txHash,
        gasUsed: result.gasUsed,
        computationCost: result.computationCost,
        storageCost: result.storageCost,
      } : undefined,
      results: {
        returnValues: result.returnValues,
        objectChanges: result.objectChanges,
        events: result.events,
        balanceChanges: result.balanceChanges,
      },
      error: result.error,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-${result.txHash?.slice(0, 8) || 'result'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (result.status === 'pending') {
    return (
      <div className={cn("space-y-4", className)}>
        <Alert>
          <Activity className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Transaction is being executed...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Status Alert */}
      {result.status === 'success' ? (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-900 dark:text-green-200">
            Transaction executed successfully
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {result.error || 'Transaction failed'}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="raw">Raw Data</TabsTrigger>
          {showCodeGeneration && <TabsTrigger value="code">Code</TabsTrigger>}
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          {/* Transaction Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Transaction Overview
                </span>
                {result.txHash && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(
                      `https://explorer.iota.org/txblock/${result.txHash}?network=${result.network || 'testnet'}`,
                      '_blank'
                    )}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Explorer
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.txHash && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Transaction Hash</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                      {result.txHash.slice(0, 8)}...{result.txHash.slice(-6)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(result.txHash!, 'Transaction hash')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
              
              {result.timestamp && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Timestamp</span>
                  <span className="text-sm">{formatTimestamp(result.timestamp)}</span>
                </div>
              )}

              {result.network && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Network</span>
                  <Badge variant={result.network === 'mainnet' ? 'destructive' : 'secondary'}>
                    {result.network}
                  </Badge>
                </div>
              )}

              {result.executionTime && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Execution Time</span>
                  <span className="text-sm">{result.executionTime}ms</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gas Information */}
          {(result.gasUsed || result.computationCost) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Gas Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.gasUsed && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Gas Used</span>
                    <span className="text-sm font-medium">{formatGasAmount(result.gasUsed)}</span>
                  </div>
                )}
                
                {result.computationCost && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Computation Cost</span>
                    <span className="text-sm">{formatGasAmount(result.computationCost)}</span>
                  </div>
                )}
                
                {result.storageCost && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Storage Cost</span>
                    <span className="text-sm">{formatGasAmount(result.storageCost)}</span>
                  </div>
                )}
                
                {result.storageRebate && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Storage Rebate</span>
                    <span className="text-sm text-green-600">{formatGasAmount(result.storageRebate)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Return Values */}
          {result.returnValues && result.returnValues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Return Values
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.returnValues.map((value, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium">Value {index + 1}</span>
                        {typeof value === 'object' && value.type && (
                          <Badge variant="outline" className="text-xs">
                            {value.type}
                          </Badge>
                        )}
                      </div>
                      <pre className="text-xs font-mono overflow-x-auto">
                        {typeof value === 'object' && value.value !== undefined
                          ? JSON.stringify(value.value, null, 2)
                          : JSON.stringify(value, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Object Changes */}
          {result.objectChanges && result.objectChanges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Object Changes
                  </span>
                  <Badge variant="secondary">{result.objectChanges.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {result.objectChanges.map((change: any, index: number) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant={
                          change.type === 'created' ? 'default' :
                          change.type === 'mutated' ? 'secondary' :
                          change.type === 'deleted' ? 'destructive' : 'outline'
                        }>
                          {change.type}
                        </Badge>
                        {change.objectType && (
                          <span className="text-xs font-mono text-muted-foreground">
                            {change.objectType.split('::').pop()}
                          </span>
                        )}
                      </div>
                      {change.objectId && (
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-background px-2 py-1 rounded flex-1 overflow-x-auto">
                            {change.objectId}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(change.objectId, 'Object ID')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Events */}
          {result.events && result.events.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Events
                  </span>
                  <Badge variant="secondary">{result.events.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {result.events.map((event: any, index: number) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg">
                      <div className="mb-2">
                        <span className="text-xs font-medium">{event.type || `Event ${index + 1}`}</span>
                      </div>
                      <pre className="text-xs font-mono overflow-x-auto">
                        {JSON.stringify(event.parsedJson || event, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Balance Changes */}
          {result.balanceChanges && result.balanceChanges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    Balance Changes
                  </span>
                  <Badge variant="secondary">{result.balanceChanges.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.balanceChanges.map((change: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <div className="text-sm font-medium">{change.coinType?.split('::').pop() || 'IOTA'}</div>
                        <code className="text-xs text-muted-foreground">{change.owner}</code>
                      </div>
                      <span className={cn(
                        "text-sm font-medium",
                        parseInt(change.amount) > 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {parseInt(change.amount) > 0 ? '+' : ''}{formatGasAmount(change.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="raw" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Raw Transaction Data</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(result, null, 2), 'Raw data')}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportResults}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="text-xs font-mono p-4 bg-muted/50 rounded-lg overflow-x-auto max-h-[500px] overflow-y-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {showCodeGeneration && (
          <TabsContent value="code" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Code2 className="h-4 w-4" />
                  TypeScript SDK Code
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(generateSDKCode(), 'SDK code')}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="text-xs font-mono p-4 bg-muted/50 rounded-lg overflow-x-auto">
                  <code>{generateSDKCode()}</code>
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}