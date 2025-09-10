import { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  Copy, 
  Hash,
  Coins,
  Download,
  FileJson,
  AlertCircle,
  Activity,
  Info,
  Package,
  ChevronDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
  walletType?: 'playground' | 'external';
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
  showCodeGeneration = false
}: ExecutionResultDisplayProps) {
  const { toast } = useToast();

  const copyToClipboard = async (content: string, label: string = 'Content') => {
    await navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  const formatGasAmount = (amount: string | number | undefined): string => {
    console.log('🔍 formatGasAmount - input:', amount, 'type:', typeof amount);
    if (!amount || amount === '0') return '0.0000 IOTA';
    const num = typeof amount === 'string' ? parseInt(amount) : amount;
    console.log('🔍 formatGasAmount - parsed num:', num);
    if (isNaN(num) || num === 0) return '0.0000 IOTA';
    const iota = num / 1_000_000_000;
    console.log('🔍 formatGasAmount - iota:', iota);
    return `${iota.toFixed(4)} IOTA`;
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
      {/* Clean Status Section */}
      <div className={cn(
        "border rounded-lg p-4",
        result.status === 'success' 
          ? "bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-800"
          : "bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-800"
      )}>
        <div className="flex items-start gap-3">
          {result.status === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
          )}
          
          <div className="flex-1 space-y-3">
            {/* Status Text */}
            <div>
              <p className={cn(
                "text-sm font-medium",
                result.status === 'success' 
                  ? "text-green-900 dark:text-green-100"
                  : "text-red-900 dark:text-red-100"
              )}>
                {result.status === 'success' 
                  ? 'Transaction executed successfully'
                  : result.error || 'Transaction failed'
                }
              </p>
            </div>

            {/* Transaction Details */}
            {result.status === 'success' && result.txHash && (
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    <code className="font-mono text-xs">
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
                  
                  {result.gasUsed && (
                    <div className="flex items-center gap-2">
                      <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatGasAmount(result.gasUsed)}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(
                      `https://explorer.iota.org/txblock/${result.txHash}?network=${result.network || 'testnet'}`,
                      '_blank'
                    )}
                    className="h-7"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    View on Explorer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportResults}
                    className="h-7"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Export
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Return Values */}
      {result.returnValues && result.returnValues.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Return Values
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {result.returnValues.map((value, index) => (
                <div key={index} className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Value {index + 1}</span>
                    {typeof value === 'object' && value.type && (
                      <Badge variant="outline" className="text-xs h-5">
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

      {/* Object Changes - Only show for external wallet */}
      {result.walletType !== 'playground' && result.objectChanges && result.objectChanges.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Object Changes
              </span>
              <Badge variant="secondary" className="text-xs">{result.objectChanges.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {result.objectChanges.map((change: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      change.type === 'created' ? 'default' :
                      change.type === 'mutated' ? 'secondary' :
                      change.type === 'deleted' ? 'destructive' : 'outline'
                    } className="text-xs">
                      {change.type}
                    </Badge>
                    <code className="text-xs font-mono text-muted-foreground">
                      {change.objectId?.slice(0, 8)}...
                    </code>
                  </div>
                  {change.objectType && (
                    <span className="text-xs text-muted-foreground">
                      {change.objectType.split('::').pop()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw Data Accordion - Same style as history */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="raw-data" className="border rounded-lg">
          <AccordionTrigger className="hover:no-underline px-4">
            <div className="flex items-center gap-2">
              <FileJson className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Raw Transaction Data</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="border-t">
              <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                <span className="text-xs text-muted-foreground">Complete transaction response</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => copyToClipboard(JSON.stringify(result, null, 2), 'Raw data')}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={exportResults}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export
                  </Button>
                </div>
              </div>
              <div className="p-4 bg-muted/10">
                <pre className="text-xs font-mono overflow-x-auto max-h-[300px] overflow-y-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* History Reference - Subtle */}
      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          This transaction has been saved to your history for future reference.
        </p>
      </div>
    </div>
  );
}