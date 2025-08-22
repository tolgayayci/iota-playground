import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Eye, 
  Zap, 
  Clock, 
  Coins, 
  ArrowRight,
  Activity,
  Hash,
  Network
} from 'lucide-react';
import { PTBBuilder, PTBCommand } from '@/lib/ptb';
import { useWallet } from '@/contexts/WalletContext';

interface PTBPreviewDialogProps {
  ptbBuilder: PTBBuilder;
  children?: React.ReactNode;
  onExecute?: () => void;
}

export function PTBPreviewDialog({ ptbBuilder, children, onExecute }: PTBPreviewDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { network, currentWallet } = useWallet();
  const commands = ptbBuilder.getCommands();

  const getCommandTypeColor = (type: string) => {
    switch (type) {
      case 'MoveCall':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'SplitCoins':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'TransferObjects':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'MergeCoins':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'MakeMoveVec':
        return 'bg-pink-500/10 text-pink-600 border-pink-500/20';
      case 'Publish':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const renderCommandSummary = (command: PTBCommand, index: number) => {
    return (
      <div key={command.id} className="p-3 border rounded-md bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-6 h-6 rounded-full bg-muted text-xs flex items-center justify-center font-mono">
            {index + 1}
          </span>
          <Badge variant="outline" className={`text-xs ${getCommandTypeColor(command.type)}`}>
            {command.type}
          </Badge>
        </div>
        
        <div className="text-sm space-y-1">
          {command.type === 'MoveCall' && (
            <>
              <div className="font-mono text-xs">
                <span className="text-muted-foreground">Target:</span>
                <div className="text-foreground break-all">{command.target}</div>
              </div>
              <div className="font-mono text-xs">
                <span className="text-muted-foreground">Arguments:</span> {command.arguments.length}
              </div>
              {command.typeArguments && command.typeArguments.length > 0 && (
                <div className="font-mono text-xs">
                  <span className="text-muted-foreground">Type Args:</span> {command.typeArguments.length}
                </div>
              )}
            </>
          )}
          
          {command.type === 'SplitCoins' && (
            <>
              <div className="font-mono text-xs">
                <span className="text-muted-foreground">Coin:</span> {command.coin.type === 'gas' ? 'GAS' : command.coin.value}
              </div>
              <div className="font-mono text-xs">
                <span className="text-muted-foreground">Split into:</span> {command.amounts.length} parts
              </div>
            </>
          )}
          
          {command.type === 'TransferObjects' && (
            <>
              <div className="font-mono text-xs">
                <span className="text-muted-foreground">Objects:</span> {command.objects.length}
              </div>
              <div className="font-mono text-xs">
                <span className="text-muted-foreground">To:</span>
                <div className="text-foreground break-all">{command.recipient.value}</div>
              </div>
            </>
          )}
          
          {command.type === 'MergeCoins' && (
            <>
              <div className="font-mono text-xs">
                <span className="text-muted-foreground">Merge:</span> {command.sources.length} coins
              </div>
              <div className="font-mono text-xs">
                <span className="text-muted-foreground">Into:</span> {command.destination.value}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const estimatedGas = 1000000; // Mock gas estimation
  const estimatedTime = 3; // Mock time estimation in seconds

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            PTB Execution Preview
          </DialogTitle>
          <DialogDescription>
            Review your Programmable Transaction Block before execution
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction Overview */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Transaction Overview
            </h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Commands:</span>
                <Badge variant="secondary">{commands.length}</Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Network:</span>
                <Badge variant="secondary" className="capitalize">{network}</Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Est. Gas:</span>
                <Badge variant="secondary">{estimatedGas.toLocaleString()}</Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Est. Time:</span>
                <Badge variant="secondary">{estimatedTime}s</Badge>
              </div>
            </div>

            {currentWallet && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Signing with:</span>
                  <Badge variant="outline" className="font-mono">
                    {currentWallet.address.slice(0, 10)}...
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Command Flow */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Command Flow
            </h4>
            
            <ScrollArea className="max-h-[300px] pr-4">
              <div className="space-y-3">
                {commands.map((command, index) => renderCommandSummary(command, index))}
              </div>
            </ScrollArea>
          </div>

          {/* Gas Cost Breakdown */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Cost Breakdown
            </h4>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base transaction fee:</span>
                <span>500,000 gas</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Command execution:</span>
                <span>{(estimatedGas - 500000).toLocaleString()} gas</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between font-medium">
                  <span>Total estimated cost:</span>
                  <span>{estimatedGas.toLocaleString()} gas</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              onExecute?.();
              setIsOpen(false);
            }}
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            Execute PTB
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}