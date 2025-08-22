import React from 'react';
import { ChevronRight, Zap, Eye } from 'lucide-react';
import { ModuleFunction } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ModuleFunctionCardProps {
  method: ModuleFunction;
  onExecute: (method: ModuleFunction) => void;
  isPackageVerified: boolean;
  isSharedView?: boolean;
}

export function ModuleFunctionCard({ 
  method, 
  onExecute, 
  isPackageVerified,
  isSharedView = false,
}: ModuleFunctionCardProps) {
  // Determine if this is an entry function (modifies state)
  const isEntry = method.is_entry === true;
  
  // Count user parameters (exclude TxContext)
  const getParameterCount = () => {
    const params = method.parameters || method.inputs || [];
    return params.filter(param => !param.type.includes('TxContext')).length;
  };

  const paramCount = getParameterCount();

  return (
    <button
      onClick={() => isPackageVerified && onExecute(method)}
      disabled={!isPackageVerified || isSharedView}
      className={cn(
        "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
        "hover:bg-accent hover:border-primary/30",
        "focus:outline-none focus:ring-2 focus:ring-primary/30",
        "group cursor-pointer",
        !isPackageVerified && "opacity-50 cursor-not-allowed",
        isSharedView && "cursor-not-allowed"
      )}
    >
      {/* Left side: Icon + Name + Params */}
      <div className="flex items-center gap-3">
        {/* Type indicator icon */}
        <div className={cn(
          "w-1.5 h-1.5 rounded-full",
          isEntry ? "bg-orange-500" : "bg-green-500"
        )}>
          <span className="sr-only">{isEntry ? 'Entry function' : 'View function'}</span>
        </div>
        
        {/* Function name */}
        <span className="font-mono text-sm">
          {method.name}
        </span>
        
        {/* Parameter count */}
        {paramCount > 0 && (
          <span className="text-xs text-muted-foreground">
            ({paramCount})
          </span>
        )}
      </div>

      {/* Right side: Chevron arrow */}
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </button>
  );
}