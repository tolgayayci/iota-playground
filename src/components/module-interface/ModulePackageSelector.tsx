import { Info, Clock, Code2, Copy, FileCode2, ExternalLink } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Deployment } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { BLOCKCHAIN_CONFIG } from '@/lib/config';
import { supabase } from '@/lib/supabase';

interface ModulePackageSelectorProps {
  contractAddress: string;
  onAddressChange: (address: string) => void;
  error?: string | null;
  deployments: Deployment[];
  isLoading?: boolean;
}

export function ModulePackageSelector({ 
  contractAddress, 
  onAddressChange,
  error,
  deployments,
  isLoading
}: ModulePackageSelectorProps) {
  const { toast } = useToast();
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const selectedDeployment = deployments.find(d => d.package_id === contractAddress);

  const formatDeploymentTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const handleCopyCode = async () => {
    if (!selectedDeployment?.source_code) return;
    await navigator.clipboard.writeText(selectedDeployment.source_code);
    toast({
      title: "Copied",
      description: "Module code copied to clipboard",
    });
  };

  const handleOpenExplorer = (packageId: string) => {
    // Use IOTA Explorer for packages
    const explorerUrl = 'https://explorer.iota.org'; // IOTA official explorer
    window.open(`${explorerUrl}/object/${packageId}?network=testnet`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="p-4 border-b bg-muted/20">
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-4 w-4 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-10 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 border-b bg-muted/20">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Package Address</label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select a deployed package address on IOTA Testnet</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={contractAddress}
              onValueChange={onAddressChange}
              disabled={deployments.length === 0}
            >
              <SelectTrigger className="w-full font-mono text-xs">
                <SelectValue placeholder={
                  deployments.length === 0 
                    ? "No deployments found" 
                    : "Select a deployed package"
                } />
              </SelectTrigger>
              <SelectContent>
                {deployments.map((deployment) => (
                  <SelectItem 
                    key={deployment.package_id} 
                    value={deployment.package_id}
                    className="font-mono text-xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>{deployment.package_id}</span>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground whitespace-nowrap">
                        <Clock className="h-3 w-3" />
                        <span>{formatDeploymentTime(deployment.created_at)}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDeployment && (
              <Button
                variant="ghost"
                size="sm"
                className="h-10 gap-1.5 flex-none"
                onClick={() => setShowCodeDialog(true)}
              >
                <Code2 className="h-4 w-4" />
                <span className="text-xs">View Code</span>
              </Button>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <Info className="h-4 w-4" />
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Code Dialog */}
      <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5" />
              Module Source Code
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 mt-4">
            {/* File Header */}
            <div className="flex items-center justify-between p-3 bg-muted/50 border rounded-t-lg">
              <div className="flex items-center gap-2">
                <FileCode2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Module.move</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleCopyCode}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
            </div>

            {/* Code Content */}
            <div className="border-x border-b rounded-b-lg">
              <ScrollArea className="h-[500px] w-full">
                <pre className={cn(
                  "p-4 text-sm font-mono leading-relaxed",
                  "bg-muted/20 dark:bg-muted/5"
                )}>
                  <code>{selectedDeployment?.source_code || 'No source code available for this deployment.'}</code>
                </pre>
              </ScrollArea>
            </div>

            {/* Contract Info */}
            <div className="mt-4 p-4 border rounded-lg space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Package ID</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-xs bg-muted/50 px-2 py-1 rounded">
                    {selectedDeployment?.package_id}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => selectedDeployment && handleOpenExplorer(selectedDeployment.package_id)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Deployed</span>
                <span className="text-xs">
                  {selectedDeployment && formatDeploymentTime(selectedDeployment.created_at)}
                </span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}