import { CompilationResult } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Terminal, Loader2, Clock, History, Blocks, Copy, CheckCircle, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseAnsiOutput } from '@/lib/ansi';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CompilerOutputDialog } from './CompilerOutputDialog';

interface CompilerViewProps {
  result?: CompilationResult | null;
  isCompiling?: boolean;
  projectId?: string;
  projectName?: string;
  isSharedView?: boolean;
}

export function CompilerView({
  result,
  isCompiling,
  projectId,
  projectName,
  isSharedView = false,
}: CompilerViewProps) {
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  if (!result && !isCompiling) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/40">
        <div className="text-center">
          <div className="inline-flex p-3 bg-primary/10 rounded-lg mb-6">
            <Blocks className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <h3 className="font-medium mb-3">
            {isSharedView ? "No Compilation Data" : "Ready to Compile"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isSharedView 
              ? "This project has no compilation history"
              : "Click the Compile button to build your Move smart contract"
            }
          </p>
        </div>
      </div>
    );
  }

  const displayResult = result;
  const compilationTime = displayResult?.details?.compilation_time 
    ? new Date(displayResult.details.compilation_time * 1000).toLocaleTimeString()
    : new Date().toLocaleTimeString();

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 2000);
      toast({
        title: "Copied",
        description: "Compiler output copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-background border rounded-md overflow-hidden">
      {/* Status Header */}
      <div className="flex-none flex items-center justify-between px-3 py-1.5 border-b bg-muted/40">
        <div className="flex items-center gap-2">
          {isCompiling ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              <span className="text-xs font-medium text-yellow-500">
                Compiling...
              </span>
            </>
          ) : displayResult && (
            <>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                displayResult.success ? "bg-green-500" : "bg-red-500"
              )} />
              <span className={cn(
                "text-xs font-medium",
                displayResult.success ? "text-green-500" : "text-red-500"
              )}>
                {displayResult.success ? "Build succeeded" : "Build failed"}
              </span>
              {!result && !isSharedView && (
                <Badge variant="outline" className="ml-2 bg-blue-500/10 text-blue-500 text-[10px]">
                  <History className="h-3 w-3 mr-1" />
                  Last Build
                </Badge>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isCompiling && displayResult && (
            <>
              <Badge variant="outline" className={cn(
                "text-[10px] font-medium px-1.5 h-5",
                displayResult.success ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
              )}>
                Exit: {displayResult.exit_code}
              </Badge>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {compilationTime}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Unified Terminal Output */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-none flex items-center justify-between px-4 py-2 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-md",
              displayResult?.success ? "bg-green-500/10" : "bg-blue-500/10"
            )}>
              <Terminal className={cn(
                "h-4 w-4",
                displayResult?.success ? "text-green-500" : "text-blue-500"
              )} />
            </div>
            <h3 className="text-sm font-medium">Compiler Output</h3>
          </div>
          {displayResult?.stdout && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5"
                onClick={() => setDialogOpen(true)}
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="text-xs">View Details</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5"
                onClick={() => handleCopy(displayResult.stdout)}
              >
                {copiedOutput ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span className="text-xs">
                  {copiedOutput ? 'Copied!' : 'Copy'}
                </span>
              </Button>
            </div>
          )}
        </div>
        <ScrollArea className="flex-1 h-full">
          <div className="p-4 bg-muted/5">
            {isCompiling ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Compiling project...</span>
              </div>
            ) : displayResult?.stdout ? (
              <pre className="font-mono text-xs whitespace-pre-wrap break-all text-foreground/90">
                {parseAnsiOutput(displayResult.stdout).map((part, i) => (
                  <span key={i} className={cn(
                    part.className,
                    "dark:text-foreground/90 dark:[&.text-muted-foreground]:text-foreground/70"
                  )}>
                    {part.text}
                  </span>
                ))}
              </pre>
            ) : (
              <div className="text-xs text-muted-foreground">
                No output to display
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Detailed Output Dialog */}
      <CompilerOutputDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        result={displayResult}
      />
    </div>
  );
}