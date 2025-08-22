import { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ModuleFunction } from '@/lib/types';

interface ModuleFunctionTooltipProps {
  method: ModuleFunction;
  children: ReactNode;
}

export function ModuleFunctionTooltip({ method, children }: ModuleFunctionTooltipProps) {
  const getMethodDescription = () => {
    if (method.is_entry === true) {
      return 'Entry function that modifies state and costs gas';
    }
    if (method.visibility === 'public') {
      return 'View function that reads state without modifying it (no gas cost)';
    }
    if (method.visibility === 'private') {
      return 'Private function only accessible within this module';
    }
    return 'Move module function';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent>
          <p>{getMethodDescription()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}