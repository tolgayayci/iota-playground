import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ModuleFunction } from '@/lib/types';
import {
  PlayCircle,
  Lock,
  Unlock,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompactFunctionListProps {
  module: {
    name: string;
    functions: ModuleFunction[];
  };
  onExecute: (method: ModuleFunction) => void;
  onView?: (method: ModuleFunction) => void;
  isPackageVerified: boolean;
  isSharedView?: boolean;
  selectedVisibility?: string;
}

export function CompactFunctionList({
  module,
  onExecute,
  onView,
  isPackageVerified,
  isSharedView = false,
  selectedVisibility = 'all',
}: CompactFunctionListProps) {
  const [hoveredFunction, setHoveredFunction] = useState<string | null>(null);

  // Filter functions based on visibility
  const filteredFunctions = module.functions.filter(func => {
    if (selectedVisibility === 'all') return true;
    if (selectedVisibility === 'entry') return func.is_entry || func.visibility === 'entry';
    if (selectedVisibility === 'public') return func.visibility === 'public' && !func.is_entry;
    if (selectedVisibility === 'private') return func.visibility === 'private';
    return true;
  });


  const getVisibilityIcon = (visibility?: string, isEntry?: boolean) => {
    if (isEntry || visibility === 'entry') return <PlayCircle className="h-3.5 w-3.5" />;
    if (visibility === 'private') return <Lock className="h-3.5 w-3.5" />;
    if (visibility === 'friend') return <Eye className="h-3.5 w-3.5" />;
    return <Unlock className="h-3.5 w-3.5" />;
  };

  const getVisibilityColor = (visibility?: string, isEntry?: boolean) => {
    if (isEntry || visibility === 'entry') return 'text-green-600 dark:text-green-500';
    if (visibility === 'private') return 'text-red-600 dark:text-red-500';
    if (visibility === 'friend') return 'text-yellow-600 dark:text-yellow-500';
    return 'text-blue-600 dark:text-blue-500';
  };

  const formatType = (type: string) => {
    // Simplify common types for display
    return type
      .replace(/0x[a-fA-F0-9]+::/g, '')
      .replace(/std::/g, '')
      .replace(/iota::/g, '')
      .replace(/string::String/g, 'String')
      .replace(/vector<u8>/g, 'Bytes')
      .replace(/&mut\s+/g, '&mut ')
      .replace(/&\s+/g, '& ');
  };

  const formatParameters = (params?: any[]): string => {
    if (!params || params.length === 0) return '()';
    
    const formatted = params
      .filter(p => !p.type?.toLowerCase().includes('txcontext'))
      .map(p => {
        const type = formatType(p.type);
        return p.name ? `${p.name}: ${type}` : type;
      })
      .join(', ');
    
    return `(${formatted})`;
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {filteredFunctions.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No functions available
        </div>
      ) : (
        <div className="divide-y">
            {filteredFunctions.map((func, index) => {
              const isEntry = func.is_entry || func.visibility === 'entry';
              const canExecute = isEntry && !isSharedView && isPackageVerified;
              const isViewFunction = !isEntry && func.visibility === 'public' && func.returnType && func.returnType !== 'void';
              const canView = isViewFunction && !isSharedView && isPackageVerified && onView;
              const funcId = `${func.name}-${index}`;
              
              return (
                <div
                  key={funcId}
                  onMouseEnter={() => setHoveredFunction(funcId)}
                  onMouseLeave={() => setHoveredFunction(null)}
                  className={cn(
                    "group px-4 py-3.5 hover:bg-muted/50 transition-colors",
                    "border-l-2",
                    isEntry && "border-l-green-500",
                    func.visibility === 'private' && "border-l-red-500",
                    func.visibility === 'friend' && "border-l-yellow-500",
                    func.visibility === 'public' && !isEntry && "border-l-blue-500"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Function Info */}
                    <div className="flex-1 min-w-0">
                      {/* Function Name and Visibility */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "inline-flex items-center",
                          getVisibilityColor(func.visibility, func.is_entry)
                        )}>
                          {getVisibilityIcon(func.visibility, func.is_entry)}
                        </span>
                        <span className="font-mono text-sm font-medium">
                          {func.name}
                        </span>
                        {/* Type Parameters */}
                        {func.typeParameters && func.typeParameters.length > 0 && (
                          <span className="text-xs text-purple-600 dark:text-purple-400">
                            {'<'}{func.typeParameters.join(', ')}{'>'}
                          </span>
                        )}
                        {/* Badges */}
                        {func.isMut && (
                          <Badge variant="outline" className="text-xs h-5 px-1">
                            mut
                          </Badge>
                        )}
                      </div>
                      
                      {/* Parameters - Compact inline display */}
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-muted-foreground font-mono">
                          {formatParameters(func.parameters)}
                        </code>
                        {func.returnType && func.returnType !== 'void' && (
                          <>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <code className="text-xs text-green-600 dark:text-green-500 font-mono">
                              {formatType(func.returnType)}
                            </code>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons - Execute for entry, View for public view functions */}
                    <div className="flex gap-1">
                      {canExecute && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant={hoveredFunction === funcId ? "default" : "ghost"}
                                className={cn(
                                  "h-7 px-2 transition-all",
                                  hoveredFunction !== funcId && "opacity-0 group-hover:opacity-100"
                                )}
                                onClick={() => onExecute({ ...func, module: module.name })}
                              >
                                <PlayCircle className="h-3.5 w-3.5 mr-1" />
                                Execute
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Execute this entry function</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      
                      {canView && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant={hoveredFunction === funcId ? "secondary" : "ghost"}
                                className={cn(
                                  "h-7 px-2 transition-all",
                                  hoveredFunction !== funcId && "opacity-0 group-hover:opacity-100"
                                )}
                                onClick={() => onView({ ...func, module: module.name })}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                View
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">View return value of this function</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </div>
              );
          })}
        </div>
      )}

    </div>
  );
}