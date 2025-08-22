import { ModuleFunction } from '@/lib/types';
import { ModuleFunctionParameterTooltip } from './ModuleFunctionParameterTooltip';

interface ModuleFunctionSignatureProps {
  method: ModuleFunction;
}

export function ModuleFunctionSignature({ method }: ModuleFunctionSignatureProps) {
  // Handle Move function parameters (different format than Ethereum ABI)
  const parameters = method.parameters || method.inputs || [];
  const returnType = method.return_type || (method.outputs && method.outputs[0]?.type) || 'void';

  return (
    <div className="text-xs text-muted-foreground font-mono">
      {method.name || 'constructor'}(
      {parameters.map((param, i) => (
        <span key={i}>
          {i > 0 && ', '}
          <ModuleFunctionParameterTooltip parameter={param}>
            <span className="text-muted-foreground">{param.name}</span>
            {': '}
            <span className="text-foreground">{param.type}</span>
          </ModuleFunctionParameterTooltip>
        </span>
      ))}
      )
      {returnType && returnType !== 'void' && (
        <>
          {' → '}
          <span className="text-foreground">{returnType}</span>
        </>
      )}
    </div>
  );
}