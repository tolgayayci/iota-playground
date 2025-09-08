import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Package, 
  Clock,
  ExternalLink,
  ChevronDown,
  Loader2,
  Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';

interface Deployment {
  id: string;
  package_id: string;
  created_at: string;
  network: string;
  module_name?: string;
  isExternal?: boolean; // To distinguish external packages
}

interface PTBPackageSelectorProps {
  selectedPackage: string;
  onPackageChange: (packageId: string) => void;
  projectId: string;
  deployedPackageId?: string;
  isLoading?: boolean;
}

export function PTBPackageSelector({
  selectedPackage,
  onPackageChange,
  projectId,
  deployedPackageId,
  isLoading,
}: PTBPackageSelectorProps) {
  const [allPackages, setAllPackages] = useState<Deployment[]>([]);
  const [isLoadingDeployments, setIsLoadingDeployments] = useState(true);
  const [open, setOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showExternalPackageDialog, setShowExternalPackageDialog] = useState(false);
  const [externalPackageId, setExternalPackageId] = useState('');
  const [externalPackageNetwork, setExternalPackageNetwork] = useState<'testnet' | 'mainnet'>('testnet');
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchDeployments();
  }, [projectId, deployedPackageId]); // Refetch when deployedPackageId changes (after new deployment)


  const fetchDeployments = async () => {
    try {
      setIsLoadingDeployments(true);
      
      // Fetch deployed contracts
      const { data: deployedContracts, error: deployError } = await supabase
        .from('deployed_contracts')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (deployError) throw deployError;
      
      // Fetch external packages
      const { data: externalPackages, error: externalError } = await supabase
        .from('external_packages')
        .select('*')
        .eq('project_id', projectId)
        .order('added_at', { ascending: false });

      if (externalError && externalError.code !== 'PGRST116') { // Ignore table not found error
        console.warn('External packages table might not exist yet:', externalError);
      }
      
      // Combine both sources
      const deployedPackages = (deployedContracts || []).map(d => ({
        ...d,
        isExternal: false,
        created_at: d.created_at,
      }));
      
      const external = (externalPackages || []).map(e => ({
        id: e.id,
        package_id: e.package_id,
        network: e.network,
        created_at: e.added_at,
        module_name: 'external_package',
        isExternal: true,
      }));
      
      const combined = [...deployedPackages, ...external].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setAllPackages(combined);
      
      // Auto-select the deployed package if provided or if it changed
      if (deployedPackageId && deployedPackageId !== selectedPackage) {
        onPackageChange(deployedPackageId);
      }
    } catch (error) {
      console.error('Failed to fetch deployments:', error);
    } finally {
      setIsLoadingDeployments(false);
    }
  };

  const formatDeploymentTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Invalid date';
    }
  };

  const isValidPackageId = (packageId: string): boolean => {
    // Check if it's a valid package ID format (0x + 64 hex chars)
    return /^0x[a-f0-9]{64}$/i.test(packageId);
  };

  const checkPackageOnNetwork = async (packageId: string, network: 'testnet' | 'mainnet'): Promise<boolean> => {
    try {
      const client = new IotaClient({ url: getFullnodeUrl(network) });
      const result = await client.getObject({
        id: packageId,
        options: { showContent: true }
      });
      return result.data?.content?.dataType === 'package';
    } catch {
      return false;
    }
  };

  const handleAddExternalPackage = async () => {
    setValidationError(null);
    
    // Validate format
    if (!isValidPackageId(externalPackageId)) {
      setValidationError("Package ID must be 0x followed by 64 hexadecimal characters");
      return;
    }

    // Check if it's already in our packages
    const existingPackage = allPackages.find(d => 
      d.package_id === externalPackageId && d.network === externalPackageNetwork
    );
    if (existingPackage) {
      setValidationError(`This package is already in your list on ${externalPackageNetwork}`);
      return;
    }

    // Validate on blockchain
    setIsValidating(true);
    
    try {
      const exists = await checkPackageOnNetwork(externalPackageId, externalPackageNetwork);
      
      if (!exists) {
        setValidationError(`This package doesn't exist on ${externalPackageNetwork}`);
        setIsValidating(false);
        return;
      }

      // Save the external package
      await saveExternalPackage(externalPackageId, externalPackageNetwork);
      setShowExternalPackageDialog(false);
      setExternalPackageId('');
      setValidationError(null);
    } catch (error) {
      console.error('Failed to validate package:', error);
      setValidationError("Failed to check package existence on blockchain");
    } finally {
      setIsValidating(false);
    }
  };

  const saveExternalPackage = async (packageId: string, network: 'testnet' | 'mainnet') => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('external_packages')
        .insert({
          project_id: projectId,
          user_id: user.id,
          package_id: packageId,
          network: network,
          package_name: null, // Can be updated later if needed
          description: `External package added for PTB`,
          metadata: {},
        })
        .select()
        .single();

      if (error) throw error;

      // Add to packages list
      const newPackage: Deployment = {
        id: data.id,
        package_id: data.package_id,
        network: data.network,
        created_at: data.added_at,
        module_name: 'external_package',
        isExternal: true,
      };
      
      setAllPackages(prev => [newPackage, ...prev]);
      
      // Select the package
      onPackageChange(packageId);
      setOpen(false);
      
      toast({
        title: "External Package Added",
        description: `Package added from ${network}`,
      });
    } catch (error) {
      console.error('Failed to save external package:', error);
      toast({
        title: "Failed to Save",
        description: error instanceof Error ? error.message : "Could not save the external package",
        variant: "destructive",
      });
    }
  };


  const handleOpenExplorer = () => {
    if (selectedPackage) {
      const pkg = allPackages.find(d => d.package_id === selectedPackage);
      const network = pkg?.network || 'testnet';
      window.open(
        `https://explorer.iota.org/object/${selectedPackage}?network=${network}`,
        '_blank'
      );
    }
  };

  const getPackageDisplay = () => {
    if (!selectedPackage) return null;
    
    const pkg = allPackages.find(d => d.package_id === selectedPackage);
    const isExternal = pkg?.isExternal || pkg?.module_name === 'external_package';
    
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <code className="text-xs font-mono truncate">
          {selectedPackage}
        </code>
        {isExternal && (
          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 shrink-0">
            External
          </Badge>
        )}
        {pkg && (
          <Badge variant="outline" className="text-xs shrink-0">
            {pkg.network}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="p-4 border-b bg-muted/20">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Package Selection
              </label>
              {selectedPackage && isLoading && (
                <Badge variant="secondary" className="text-xs">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Loading modules...
                </Badge>
              )}
            </div>
            {selectedPackage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenExplorer}
                className="h-6 gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Explorer
              </Button>
            )}
          </div>

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-mono text-xs overflow-hidden"
                disabled={isLoadingDeployments}
              >
                {selectedPackage ? (
                  getPackageDisplay()
                ) : (
                  <span className="text-muted-foreground">
                    {isLoadingDeployments 
                      ? "Loading packages..." 
                      : "Select a package"}
                  </span>
                )}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
              <Command>
                <CommandList>
                  <CommandEmpty>
                    <div className="text-center py-6">
                      <p className="text-sm text-muted-foreground mb-3">
                        No packages deployed yet
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOpen(false);
                          setShowExternalPackageDialog(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add External Package
                      </Button>
                    </div>
                  </CommandEmpty>
                  {allPackages.length > 0 && (
                    <CommandGroup heading="Available Packages">
                      {allPackages.map((deployment) => {
                          const isExternal = deployment.module_name === 'external_package';
                          return (
                            <CommandItem
                              key={deployment.id}
                              value={deployment.package_id}
                              onSelect={(value) => {
                                onPackageChange(value);
                                setOpen(false);
                              }}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <code className="text-xs font-mono truncate">
                                  {deployment.package_id}
                                </code>
                              </div>
                              <div className="flex items-center gap-2">
                                {isExternal && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-700 border-purple-200">
                                    External
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {deployment.network}
                                </Badge>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {formatDeploymentTime(deployment.created_at)}
                                </div>
                              </div>
                            </CommandItem>
                          );
                        })}
                    </CommandGroup>
                  )}
                  {allPackages.length > 0 && (
                    <div className="p-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setOpen(false);
                          setShowExternalPackageDialog(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add External Package
                      </Button>
                    </div>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

        </div>
      </div>

      {/* Add External Package Dialog */}
      <Dialog open={showExternalPackageDialog} onOpenChange={setShowExternalPackageDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add External Package</DialogTitle>
            <DialogDescription>
              Enter a package ID from the IOTA blockchain to use in your PTB
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="packageId">Package ID</Label>
              <Input
                id="packageId"
                placeholder="0x..."
                value={externalPackageId}
                onChange={(e) => {
                  setExternalPackageId(e.target.value);
                  setValidationError(null);
                }}
                className="font-mono text-xs"
              />
              {externalPackageId && !isValidPackageId(externalPackageId) && (
                <p className="text-xs text-red-500">
                  Package ID must be 0x followed by 64 hexadecimal characters
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Network</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={externalPackageNetwork === 'testnet' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setExternalPackageNetwork('testnet')}
                >
                  Testnet
                </Button>
                <Button
                  type="button"
                  variant={externalPackageNetwork === 'mainnet' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setExternalPackageNetwork('mainnet')}
                >
                  Mainnet
                </Button>
              </div>
            </div>
            
            {validationError && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {validationError}
                </p>
              </div>
            )}
            
            {isValidating && (
              <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking package on {externalPackageNetwork}...
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowExternalPackageDialog(false);
                setExternalPackageId('');
                setValidationError(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddExternalPackage}
              disabled={!externalPackageId || !isValidPackageId(externalPackageId) || isValidating}
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                'Add Package'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}