import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Edit2,
  Trash2,
  GripVertical,
  ArrowRight,
  FunctionSquare,
  Send,
  Split,
  Merge,
  Grid,
  Upload,
  Link,
} from 'lucide-react';
import { PTBCommand } from '@/components/views/PTBBuilderV3';
import { cn } from '@/lib/utils';

interface PTBCommandCardProps {
  command: PTBCommand;
  index: number;
  onEdit: (command: PTBCommand) => void;
  onDelete: (id: string) => void;
  previousCommands: PTBCommand[];
}

export function PTBCommandCard({
  command,
  index,
  onEdit,
  onDelete,
  previousCommands,
}: PTBCommandCardProps) {
  const getCommandIcon = () => {
    switch (command.type) {
      case 'MoveCall':
        return <FunctionSquare className="h-4 w-4" />;
      case 'TransferObjects':
        return <Send className="h-4 w-4" />;
      case 'SplitCoins':
        return <Split className="h-4 w-4" />;
      case 'MergeCoins':
        return <Merge className="h-4 w-4" />;
      case 'MakeMoveVec':
        return <Grid className="h-4 w-4" />;
      case 'Publish':
        return <Upload className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getCommandTypeColor = () => {
    switch (command.type) {
      case 'MoveCall':
        return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'TransferObjects':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'SplitCoins':
        return 'bg-orange-500/10 text-orange-700 border-orange-200';
      case 'MergeCoins':
        return 'bg-purple-500/10 text-purple-700 border-purple-200';
      case 'MakeMoveVec':
        return 'bg-pink-500/10 text-pink-700 border-pink-200';
      case 'Publish':
        return 'bg-indigo-500/10 text-indigo-700 border-indigo-200';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const formatCommandDetails = () => {
    switch (command.type) {
      case 'MoveCall':
        return (
          <div className="space-y-1">
            {command.target && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Target:</span>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {command.module}::{command.function}
                </code>
              </div>
            )}
            {command.arguments && command.arguments.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Args:</span>
                <div className="flex gap-1">
                  {command.arguments.map((arg, i) => (
                    <Badge key={i} variant="outline" className="text-xs px-1 py-0">
                      {arg.type === 'result' ? `Result[${arg.resultFrom}]` : 
                       arg.type === 'input' ? `Input ${i}` : 
                       arg.type}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      
      case 'TransferObjects':
        return (
          <div className="space-y-1">
            {command.objects && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Objects:</span>
                <Badge variant="outline" className="text-xs px-1 py-0">
                  {command.objects.length} object(s)
                </Badge>
              </div>
            )}
            {command.recipient && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">To:</span>
                <code className="text-xs bg-muted px-1 py-0.5 rounded truncate max-w-[200px]">
                  {command.recipient.value || 'Address'}
                </code>
              </div>
            )}
          </div>
        );

      case 'SplitCoins':
        return (
          <div className="space-y-1">
            {command.coin && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Coin:</span>
                <Badge variant="outline" className="text-xs px-1 py-0">
                  {command.coin.type === 'gas' ? 'Gas' : command.coin.type}
                </Badge>
              </div>
            )}
            {command.amounts && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Amounts:</span>
                <div className="flex gap-1">
                  {command.amounts.map((amount, i) => (
                    <Badge key={i} variant="outline" className="text-xs px-1 py-0">
                      {amount.value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'MergeCoins':
        return (
          <div className="space-y-1">
            {command.destination && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Into:</span>
                <Badge variant="outline" className="text-xs px-1 py-0">
                  {command.destination.type === 'gas' ? 'Gas' : command.destination.type}
                </Badge>
              </div>
            )}
            {command.sources && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sources:</span>
                <Badge variant="outline" className="text-xs px-1 py-0">
                  {command.sources.length} coin(s)
                </Badge>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Check for references to previous commands
  const hasReferences = () => {
    if (command.type === 'MoveCall' && command.arguments) {
      return command.arguments.some(arg => arg.type === 'result');
    }
    if (command.type === 'TransferObjects' && command.objects) {
      return command.objects.some(obj => obj.type === 'result');
    }
    if (command.type === 'SplitCoins' && command.amounts) {
      return command.amounts.some(amt => amt.type === 'result');
    }
    if (command.type === 'MergeCoins' && command.sources) {
      return command.sources.some(src => src.type === 'result');
    }
    return false;
  };

  return (
    <Card className={cn(
      "relative group transition-all",
      "hover:shadow-md"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          <div className="pt-1 opacity-50 cursor-move">
            <GripVertical className="h-4 w-4" />
          </div>

          {/* Command Number */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <span className="text-xs font-semibold">{index + 1}</span>
          </div>

          {/* Command Content */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={cn("gap-1", getCommandTypeColor())}
              >
                {getCommandIcon()}
                {command.type}
              </Badge>
              
              {hasReferences() && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Link className="h-3 w-3" />
                  Uses Result
                </Badge>
              )}

              {command.description && (
                <span className="text-xs text-muted-foreground">
                  {command.description}
                </span>
              )}
            </div>

            {formatCommandDetails()}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(command)}
              className="h-8 w-8 p-0"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(command.id)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Reference Indicator */}
        {index > 0 && hasReferences() && (
          <div className="absolute -top-3 left-12 flex items-center gap-1">
            <ArrowRight className="h-3 w-3 text-muted-foreground rotate-90" />
            <span className="text-[10px] text-muted-foreground">
              Uses output from above
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}