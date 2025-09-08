import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ModuleFunction } from '@/lib/types';
import { ModuleFunctionCard } from './ModuleFunctionCard';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Code,
  FunctionSquare,
  PlayCircle,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GroupedModuleFunctionsProps {
  module: {
    name: string;
    functions: ModuleFunction[];
  };
  onExecute: (method: ModuleFunction) => void;
  isPackageVerified: boolean;
  isSharedView?: boolean;
}

// Type to color mapping for better visual distinction
const TYPE_COLORS: Record<string, string> = {
  'u8': 'text-blue-500',
  'u16': 'text-blue-500',
  'u32': 'text-blue-500',
  'u64': 'text-blue-500',
  'u128': 'text-blue-500',
  'u256': 'text-blue-500',
  'bool': 'text-green-500',
  'address': 'text-purple-500',
  'vector': 'text-orange-500',
  'string': 'text-yellow-500',
  'object': 'text-pink-500',
  'signer': 'text-red-500',
};

export function GroupedModuleFunctions({
  module,
  onExecute,
  isPackageVerified,
  isSharedView = false,
}: GroupedModuleFunctionsProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['entry', 'public'])
  );

  // Group functions by visibility
  const groupedFunctions = module.functions.reduce((acc, func) => {
    const visibility = func.visibility || 'public';
    if (!acc[visibility]) {
      acc[visibility] = [];
    }
    acc[visibility].push(func);
    return acc;
  }, {} as Record<string, ModuleFunction[]>);

  // Sort groups: entry -> public -> private -> friend
  const sortedGroups = Object.entries(groupedFunctions).sort(([a], [b]) => {
    const order = ['entry', 'public', 'private', 'friend'];
    return order.indexOf(a) - order.indexOf(b);
  });

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(group)) {
        newSet.delete(group);
      } else {
        newSet.add(group);
      }
      return newSet;
    });
  };

  const getGroupIcon = (visibility: string) => {
    switch (visibility) {
      case 'entry':
        return <PlayCircle className="h-4 w-4" />;
      case 'public':
        return <Unlock className="h-4 w-4" />;
      case 'private':
        return <Lock className="h-4 w-4" />;
      case 'friend':
        return <Eye className="h-4 w-4" />;
      default:
        return <FunctionSquare className="h-4 w-4" />;
    }
  };

  const getGroupColor = (visibility: string) => {
    switch (visibility) {
      case 'entry':
        return 'text-green-500 border-green-500/20 bg-green-500/5';
      case 'public':
        return 'text-blue-500 border-blue-500/20 bg-blue-500/5';
      case 'private':
        return 'text-red-500 border-red-500/20 bg-red-500/5';
      case 'friend':
        return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5';
      default:
        return 'text-muted-foreground';
    }
  };

  const formatType = (type: string): JSX.Element => {
    // Remove any extra whitespace
    type = type.trim();
    
    // Get base color for the type
    let colorClass = 'text-muted-foreground';
    Object.keys(TYPE_COLORS).forEach(key => {
      if (type.toLowerCase().includes(key)) {
        colorClass = TYPE_COLORS[key];
      }
    });

    return <span className={cn('font-mono text-xs', colorClass)}>{type}</span>;
  };

  const formatFunctionSignature = (func: ModuleFunction) => {
    const params = func.parameters
      .map(p => {
        const paramName = p.name || `arg${func.parameters.indexOf(p)}`;
        return `${paramName}: ${p.type}`;
      })
      .join(', ');

    const returnType = func.returnType && func.returnType !== 'void' 
      ? ` → ${func.returnType}` 
      : '';

    return (
      <div className="font-mono text-xs text-muted-foreground">
        <span className="text-primary">{func.name}</span>
        <span>(</span>
        {func.parameters.map((p, idx) => (
          <span key={idx}>
            {idx > 0 && <span>, </span>}
            <span className="text-foreground/70">{p.name || `arg${idx}`}</span>
            <span>: </span>
            {formatType(p.type)}
          </span>
        ))}
        <span>)</span>
        {returnType && (
          <span className="text-green-500/80">{returnType}</span>
        )}
      </div>
    );
  };

  if (sortedGroups.length === 0) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <div className="text-muted-foreground mb-2">No functions available</div>
        <div className="text-sm text-muted-foreground">
          This module doesn't expose any functions.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Module Header */}
      <div className="px-4 py-3 border-b bg-muted/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{module.name}</span>
            <Badge variant="outline" className="text-xs">
              {module.functions.length} function{module.functions.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setExpandedGroups(new Set(['entry', 'public', 'private', 'friend']))}
            >
              Expand All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setExpandedGroups(new Set())}
            >
              Collapse All
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 pb-4 space-y-3">
          {sortedGroups.map(([visibility, functions]) => (
            <Collapsible
              key={visibility}
              open={expandedGroups.has(visibility)}
              onOpenChange={() => toggleGroup(visibility)}
            >
              <CollapsibleTrigger className="w-full group">
                <div className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-colors",
                  "hover:bg-muted/50 cursor-pointer",
                  getGroupColor(visibility)
                )}>
                  <div className="flex items-center gap-3">
                    {expandedGroups.has(visibility) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {getGroupIcon(visibility)}
                    <span className="font-medium capitalize">{visibility} Functions</span>
                    <Badge variant="secondary" className="text-xs">
                      {functions.length}
                    </Badge>
                  </div>
                  {visibility === 'entry' && (
                    <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">
                      Executable
                    </Badge>
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {functions.map((func, index) => (
                  <div
                    key={`${module.name}-${func.name}-${index}`}
                    className="relative"
                  >
                    {/* Function Card with Signature */}
                    <div className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                      {/* Function Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          {/* Function Signature */}
                          {formatFunctionSignature(func)}
                          
                          {/* Generic Type Parameters */}
                          {func.typeParameters && func.typeParameters.length > 0 && (
                            <div className="mt-1">
                              <span className="text-xs text-muted-foreground">
                                Generics: {func.typeParameters.map((tp, i) => (
                                  <span key={i}>
                                    {i > 0 && ', '}
                                    <span className="font-mono text-purple-500">&lt;{tp}&gt;</span>
                                  </span>
                                ))}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Execute Button */}
                        {visibility === 'entry' && !isSharedView && (
                          <Button
                            size="sm"
                            className="h-7"
                            onClick={() => onExecute({ ...func, module: module.name })}
                            disabled={!isPackageVerified}
                          >
                            <PlayCircle className="h-3 w-3 mr-1" />
                            Execute
                          </Button>
                        )}
                      </div>

                      {/* Parameter Details */}
                      {func.parameters.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs text-muted-foreground mb-2">Parameters:</div>
                          <div className="space-y-1">
                            {func.parameters.map((param, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <Code className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono">
                                  {param.name || `arg${idx}`}
                                </span>
                                <span className="text-muted-foreground">:</span>
                                {formatType(param.type)}
                                {param.isOptional && (
                                  <Badge variant="outline" className="text-xs">
                                    Optional
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Return Type */}
                      {func.returnType && func.returnType !== 'void' && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="text-xs text-muted-foreground">
                            Returns: {formatType(func.returnType)}
                          </div>
                        </div>
                      )}

                      {/* Visibility Badge */}
                      <div className="mt-3 flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", getGroupColor(visibility))}
                        >
                          {getGroupIcon(visibility)}
                          <span className="ml-1">{visibility}</span>
                        </Badge>
                        {func.isMut && (
                          <Badge variant="outline" className="text-xs">
                            Mutable
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}