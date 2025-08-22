import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Gauge,
  Zap,
  FileCode,
  Target,
  Layers,
  Clock
} from 'lucide-react';
import { 
  parseBytecodeModules, 
  analyzeBytecode,
  validateBytecode,
  formatFileSize,
  formatGasToIota,
  BytecodeAnalysis
} from '@/lib/bytecodeUtils';
import { CompilationResult } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BytecodeVerificationProps {
  lastCompilation: CompilationResult | null;
}

export function BytecodeVerification({ lastCompilation }: BytecodeVerificationProps) {
  const [analysis, setAnalysis] = useState<BytecodeAnalysis | null>(null);
  const [validation, setValidation] = useState<{
    isValid: boolean;
    warnings: string[];
    errors: string[];
  } | null>(null);

  useEffect(() => {
    if (lastCompilation?.success && lastCompilation.modules?.length) {
      const modules = parseBytecodeModules(lastCompilation.modules);
      
      // Analyze bytecode
      const bytecodeAnalysis = analyzeBytecode(modules);
      setAnalysis(bytecodeAnalysis);
      
      // Validate bytecode
      const bytecodeValidation = validateBytecode(modules);
      setValidation(bytecodeValidation);
    } else {
      setAnalysis(null);
      setValidation(null);
    }
  }, [lastCompilation]);

  if (!lastCompilation?.success || !lastCompilation.modules?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="rounded-full bg-muted/20 p-6 mb-6">
          <Shield className="h-12 w-12 text-muted-foreground/40" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="font-semibold text-lg">No bytecode to verify</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Compile your Move contract to see verification results and deployment readiness.
          </p>
        </div>
      </div>
    );
  }

  const overallStatus = validation?.isValid ? 'valid' : validation?.errors.length ? 'error' : 'warning';

  return (
    <div className="space-y-6">
      {/* Header with Status Badge */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Bytecode Verification</h2>
            </div>
            <Badge 
              variant={overallStatus === 'valid' ? 'default' : overallStatus === 'error' ? 'destructive' : 'secondary'}
              className={cn(
                "text-xs font-medium",
                overallStatus === 'valid' && "bg-green-100 text-green-800 hover:bg-green-200 border-green-200",
                overallStatus === 'warning' && "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200"
              )}
            >
              {overallStatus === 'valid' && <CheckCircle className="h-3 w-3 mr-1" />}
              {overallStatus === 'warning' && <AlertTriangle className="h-3 w-3 mr-1" />}
              {overallStatus === 'error' && <XCircle className="h-3 w-3 mr-1" />}
              {overallStatus === 'valid' ? 'Verified' : overallStatus === 'error' ? 'Failed' : 'Warnings'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Contract validation results and deployment readiness analysis
          </p>
        </div>
      </div>

      {/* Main Verification Results */}
      <div className="space-y-4">
        {/* Errors */}
        {validation?.errors && validation.errors.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-red-700">
              <XCircle className="h-4 w-4" />
              Validation Errors ({validation.errors.length})
            </div>
            <div className="space-y-2">
              {validation.errors.map((error, index) => (
                <div key={`error-${index}`} className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-md">
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-red-700 leading-relaxed">{error}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {validation?.warnings && validation.warnings.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-yellow-700">
              <AlertTriangle className="h-4 w-4" />
              Validation Warnings ({validation.warnings.length})
            </div>
            <div className="space-y-2">
              {validation.warnings.map((warning, index) => (
                <div key={`warning-${index}`} className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-100 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-yellow-700 leading-relaxed">{warning}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success State */}
        {validation?.isValid && validation.warnings.length === 0 && (
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-100 rounded-md">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <div className="text-sm font-medium text-green-800">Validation Successful</div>
              <div className="text-sm text-green-700">
                All bytecode validation checks passed. Your contract is ready for deployment.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      {analysis && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-primary" />
            Deployment Metrics
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Module Count */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-md">
                  <Layers className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-xl font-semibold">{lastCompilation.modules?.length || 0}</div>
                  <div className="text-xs text-muted-foreground">Module{(lastCompilation.modules?.length || 0) !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </div>

            {/* Total Size */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-md">
                  <FileCode className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <div className="text-xl font-semibold">{formatFileSize(analysis.totalSize)}</div>
                  <div className="text-xs text-muted-foreground">Total Size</div>
                </div>
              </div>
            </div>

            {/* Gas Estimate */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-md">
                  <Zap className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <div className="text-xl font-semibold">{formatGasToIota(analysis.estimatedGas)}</div>
                  <div className="text-xs text-muted-foreground">Est. IOTA Cost</div>
                </div>
              </div>
            </div>
          </div>

          {/* Complexity Analysis */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Gauge className="h-4 w-4 text-primary" />
                  Complexity Analysis
                </div>
                <span className="text-sm font-medium">
                  {analysis.complexityScore}/100
                </span>
              </div>
              
              <Progress 
                value={analysis.complexityScore} 
                className={cn(
                  "h-2",
                  analysis.complexityScore <= 30 && "[&>div]:bg-green-500",
                  analysis.complexityScore > 30 && analysis.complexityScore <= 70 && "[&>div]:bg-yellow-500",
                  analysis.complexityScore > 70 && "[&>div]:bg-red-500"
                )}
              />
              
              <p className="text-xs text-muted-foreground">
                {analysis.complexityScore <= 30 ? "Low complexity contract with optimized gas usage" :
                 analysis.complexityScore <= 70 ? "Medium complexity contract with moderate gas costs" :
                 "High complexity contract - consider optimization for lower gas costs"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Checklist */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle className="h-4 w-4 text-primary" />
          Deployment Checklist
        </div>
        
        <div className="bg-slate-50 border border-slate-200 rounded-md p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2 h-2 rounded-full",
                validation?.isValid ? "bg-green-500" : "bg-red-500"
              )}></div>
              <span className={cn(
                "text-sm",
                validation?.isValid ? "text-green-700 font-medium" : "text-red-700"
              )}>
                Bytecode validation {validation?.isValid ? 'passed' : 'failed'}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2 h-2 rounded-full",
                lastCompilation.digest ? "bg-green-500" : "bg-yellow-500"
              )}></div>
              <span className={cn(
                "text-sm",
                lastCompilation.digest ? "text-green-700 font-medium" : "text-yellow-700"
              )}>
                Package digest {lastCompilation.digest ? 'generated' : 'pending'}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2 h-2 rounded-full",
                analysis && analysis.complexityScore <= 80 ? "bg-green-500" : "bg-yellow-500"
              )}></div>
              <span className={cn(
                "text-sm",
                analysis && analysis.complexityScore <= 80 ? "text-green-700 font-medium" : "text-yellow-700"
              )}>
                Complexity check {analysis && analysis.complexityScore <= 80 ? 'passed' : 'review recommended'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}