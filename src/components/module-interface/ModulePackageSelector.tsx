import { Info, Clock, Wallet, Globe, User, Package } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Deployment } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface ModulePackageSelectorProps {
  contractAddress: string;
  onAddressChange: (address: string) => void;
  error?: string | null;
  deployments: Deployment[];
  isLoading?: boolean;
  deploymentMetadata?: {
    walletType?: 'playground' | 'external';
    deployerAddress?: string;
    network?: string;
  };
  selectedDeployment?: Deployment | null;
}

export function ModulePackageSelector({ 
  contractAddress, 
  onAddressChange,
  error,
  deployments,
  isLoading,
  deploymentMetadata,
  selectedDeployment
}: ModulePackageSelectorProps) {
  const currentDeployment = selectedDeployment || deployments.find(d => d.package_id === contractAddress);

  const formatDeploymentTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return 'Invalid date';
    }
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
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <label className="text-sm font-medium flex-shrink-0 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Package Address
            </label>
            {/* Deployment Badges - Wrap on small screens */}
            {currentDeployment && deploymentMetadata && (
              <div className="flex flex-wrap items-center gap-2 justify-end">
                {/* Wallet Type Badge - Clickable */}
                <Badge 
                  variant={deploymentMetadata.walletType === 'playground' ? 'default' : 'secondary'} 
                  className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted transition-colors flex-shrink-0"
                  onClick={() => {
                    if (deploymentMetadata.deployerAddress) {
                      const explorerUrl = `https://explorer.iota.org/address/${deploymentMetadata.deployerAddress}?network=${currentDeployment.network || 'testnet'}`;
                      window.open(explorerUrl, '_blank');
                    }
                  }}
                >
                  <Wallet className="h-3 w-3 flex-shrink-0" />
                  {deploymentMetadata.walletType === 'playground' ? 'Playground' : 'IOTA'}
                </Badge>
                
                {/* Network Badge */}
                <Badge variant={currentDeployment.network === 'mainnet' ? 'destructive' : 'outline'} className="gap-1 h-5 text-xs flex-shrink-0">
                  <Globe className="h-3 w-3 flex-shrink-0" />
                  {currentDeployment.network || 'testnet'}
                </Badge>
                
                {/* Package ID Badge - Clickable with better truncation */}
                <Badge 
                  variant="outline" 
                  className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted transition-colors max-w-[150px] sm:max-w-none"
                  onClick={() => {
                    const explorerUrl = `https://explorer.iota.org/object/${currentDeployment.package_id}?network=${currentDeployment.network || 'testnet'}`;
                    window.open(explorerUrl, '_blank');
                  }}
                  title={currentDeployment.package_id}
                >
                  <Package className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">
                    {currentDeployment.package_id.slice(0, 6)}...{currentDeployment.package_id.slice(-4)}
                  </span>
                </Badge>
              </div>
            )}
          </div>
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
          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <Info className="h-4 w-4" />
              {error}
            </p>
          )}
        </div>
      </div>
    </>
  );
}