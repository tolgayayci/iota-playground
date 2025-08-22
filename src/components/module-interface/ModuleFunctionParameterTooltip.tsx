import { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ModuleFunctionInput } from '@/lib/types';

interface ModuleFunctionParameterTooltipProps {
  parameter: ModuleFunctionInput;
  children: ReactNode;
}

export function ModuleFunctionParameterTooltip({ parameter, children }: ModuleFunctionParameterTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{children}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Type: {parameter.type}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}