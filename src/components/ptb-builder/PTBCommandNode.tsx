import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle,
  ArrowUpDown,
  FunctionSquare,
  Link,
} from 'lucide-react';
import { PTBCommand } from '@/components/views/PTBBuilderV3';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface PTBCommandNodeProps {
  command: PTBCommand;
  index: number;
  isExpanded: boolean;
  validationErrors: string[];
  previousCommands: PTBCommand[];
  onToggleExpand: () => void;
  onUpdate: (command: PTBCommand) => void;
  onDelete: () => void;
  onMove: (direction: 'up' | 'down') => void;
  modules: any[];
  selectedPackage: string;
}

export function PTBCommandNode({
  command,
  index,
  isExpanded,
  validationErrors,
  previousCommands,
  onToggleExpand,
  onUpdate,
  onDelete,
  onMove,
  modules,
  selectedPackage,
}: PTBCommandNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const hasErrors = validationErrors.length > 0;

  const getCommandIcon = () => {
    return <FunctionSquare className="h-4 w-4" />;
  };

  const getCommandColor = () => {
    return 'bg-blue-500/10 text-blue-600 border-blue-200/50';
  };

  const getCommandSummary = () => {
    return `${command.module}::${command.function}`;
  };

  const formatArgument = (arg: any): string => {
    if (!arg) return 'Not set';
    if (typeof arg === 'string') return arg;
    
    // Handle different argument types with better formatting
    if (arg.type === 'gas') {
      return '⛽ Gas Coin';
    }
    
    if (arg.type === 'result') {
      if (arg.resultFrom !== undefined) {
        const stepNum = arg.resultFrom + 1;
        if (arg.resultIndex !== undefined) {
          return `📤 Result from Step ${stepNum}[${arg.resultIndex}]`;
        }
        return `📤 Result from Step ${stepNum}`;
      }
      return `📤 ${arg.value || 'Result'}`;
    }
    
    if (arg.type === 'object') {
      if (arg.value) {
        // Shorten long object IDs
        const displayValue = arg.value.length > 20 
          ? `${arg.value.slice(0, 10)}...${arg.value.slice(-8)}` 
          : arg.value;
        return `🔷 Object: ${displayValue}`;
      }
      return '🔷 Object (not set)';
    }
    
    if (arg.type === 'input') {
      if (!arg.value) return 'Empty value';
      
      // Format based on parameter type
      if (arg.paramType === 'address') {
        const addr = arg.value.length > 20 
          ? `${arg.value.slice(0, 10)}...${arg.value.slice(-8)}` 
          : arg.value;
        return `📍 Address: ${addr}`;
      }
      if (arg.paramType === 'bool') {
        return arg.value === 'true' ? '✅ True' : '❌ False';
      }
      if (arg.paramType && arg.paramType.match(/^u\d+$/)) {
        return `🔢 ${arg.value}`;
      }
      
      return arg.value;
    }
    
    // Fallback for unknown types - avoid [object Object]
    if (typeof arg === 'object') {
      return 'Complex value';
    }
    
    return String(arg);
  };

  const getOutputDescription = () => {
    const resultRef = `Result(${index})`;
    return `${resultRef} - Function return value`;
  };

  return (
    <Collapsible open={isExpanded}>
      <div
        className={cn(
          "relative rounded-lg border transition-all",
          hasErrors ? "border-red-500/50 bg-red-50/5" : "border-border",
          isExpanded ? "shadow-sm" : ""
        )}
      >
        {/* Command Header */}
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 flex-1">
              {/* Command Number & Icon */}
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground font-mono">
                  #{index + 1}
                </div>
                <div className={cn("p-1.5 rounded-md", getCommandColor())}>
                  {getCommandIcon()}
                </div>
              </div>

              {/* Command Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">
                    {command.type}
                  </Badge>
                  <span className="text-sm font-medium truncate">
                    {getCommandSummary()}
                  </span>
                  {hasErrors && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  {!hasErrors && command.description && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </div>
                {command.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {command.description}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              {index > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onMove('up')}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
              )}
              {index < previousCommands.length && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onMove('down')}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={onToggleExpand}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </div>

        {/* Expandable Details */}
        <CollapsibleContent>
          <div className="px-4 pb-3 space-y-3 border-t">
            {/* Input Parameters */}
            <div className="pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Link className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Inputs</span>
              </div>
              <div className="space-y-1.5 pl-5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Target:</span>
                  <code className="px-1.5 py-0.5 bg-muted rounded font-mono">
                    {command.target || 'Not set'}
                  </code>
                </div>
                {command.arguments?.map((arg, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">arg{i}:</span>
                    <code className="px-1.5 py-0.5 bg-muted rounded">
                      {formatArgument(arg)}
                    </code>
                  </div>
                ))}
                {command.typeArguments?.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Types:</span>
                    <div className="flex gap-1">
                      {command.typeArguments.map((type, i) => (
                        <code key={i} className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">
                          {type}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Output Reference */}
            {getOutputDescription() && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Output</span>
                </div>
                <div className="pl-5">
                  <code className="text-xs px-1.5 py-0.5 bg-green-500/10 text-green-700 rounded">
                    {getOutputDescription()}
                  </code>
                </div>
              </div>
            )}

            {/* Validation Errors */}
            {hasErrors && (
              <div className="bg-red-50/50 dark:bg-red-950/20 rounded-md p-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    {validationErrors.map((error, i) => (
                      <p key={i} className="text-xs text-red-600 dark:text-red-400">
                        {error}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}