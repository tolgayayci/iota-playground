import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModuleFunction, Deployment, ModuleInterfaceData } from '@/lib/types';
import { ModuleFunctionCard } from '@/components/module-interface/ModuleFunctionCard';
import { ModuleEmptyState } from '@/components/module-interface/ModuleEmptyState';
import { ModulePackageSelector } from '@/components/module-interface/ModulePackageSelector';
import { PTBExecuteDialogV2 as PTBExecuteDialog } from '@/components/module-interface/PTBExecuteDialogV2';
import { ModuleExecutionHistory } from '@/components/module-interface/ModuleExecutionHistory';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { History, PlayCircle, Package, RefreshCw, AlertCircle, Wallet, Globe, User, ExternalLink } from 'lucide-react';
import { fetchModuleInterface, verifyPackageExists, clearModuleInterfaceCache, MODULE_INTERFACE_VERSION } from '@/lib/moduleInterface';

interface ModuleInterfaceViewProps {
  projectId: string;
  isSharedView?: boolean;
}

export function ModuleInterfaceView({ projectId, isSharedView = false }: ModuleInterfaceViewProps) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [isPackageVerified, setIsPackageVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFunction, setSelectedFunction] = useState<ModuleFunction | null>(null);
  const [activeView, setActiveView] = useState<'interface' | 'history'>('interface');
  const [isLoading, setIsLoading] = useState(true);
  const [moduleInterface, setModuleInterface] = useState<ModuleInterfaceData | null>(null);
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [isFetchingInterface, setIsFetchingInterface] = useState(false);
  const [deploymentMetadata, setDeploymentMetadata] = useState<{
    walletType?: 'playground' | 'external';
    deployerAddress?: string;
    network?: string;
  }>({});
  const { toast } = useToast();

  const fetchRealModuleInterface = async (packageId: string, network: 'testnet' | 'mainnet' = 'testnet') => {
    try {
      setIsFetchingInterface(true);
      setError(null);
      
      // Validate package ID format (must be 0x + 64 hex chars = 66 total)
      const isValidPackageId = packageId && 
                                packageId.startsWith('0x') && 
                                packageId.length === 66 &&
                                /^0x[a-f0-9]{64}$/i.test(packageId);
      
      if (!isValidPackageId) {
        if (packageId?.startsWith('tx_')) {
          throw new Error('Package deployment is still being processed. Please check the transaction in explorer.');
        } else if (packageId === 'unknown') {
          throw new Error('Package ID could not be determined. Please check the transaction in explorer.');
        } else {
          throw new Error(`Invalid package ID format: ${packageId?.slice(0, 20)}...`);
        }
      }
      
      // Clear cache for this package to get fresh data
      clearModuleInterfaceCache(packageId, network);
      
      // First verify package exists with retry logic
      console.log(`🔍 Verifying package ${packageId} on ${network}...`);
      let packageExists = false;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!packageExists && retryCount < maxRetries) {
        try {
          packageExists = await verifyPackageExists(packageId, network);
          if (!packageExists && retryCount < maxRetries - 1) {
            console.log(`⏳ Package not found, retrying in 2 seconds... (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`Error verifying package (attempt ${retryCount + 1}):`, error);
        }
        retryCount++;
      }
      
      if (!packageExists) {
        throw new Error(`Package ${packageId.slice(0, 10)}... not found on ${network}. It may still be processing.`);
      }
      
      // Fetch the module interface from blockchain
      console.log(`📦 Fetching module interface for ${packageId}...`);
      const interfaceData = await fetchModuleInterface(packageId, network);
      setModuleInterface(interfaceData);
      setIsPackageVerified(true);
      
      // Auto-select first module if available
      if (interfaceData.modules.length > 0) {
        setSelectedModule(interfaceData.modules[0].name);
      }
      
      return true;
    } catch (error) {
      console.error('Error fetching module interface:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch module interface';
      setError(errorMessage);
      setModuleInterface(null);
      setIsPackageVerified(false);
      
      // If it's a new deployment, suggest waiting
      if (errorMessage.includes('not found') || errorMessage.includes('processing')) {
        setError(errorMessage + ' Please wait a moment and try refreshing.');
      }
      
      return false;
    } finally {
      setIsFetchingInterface(false);
    }
  };

  const fetchDeployments = async () => {
    try {
      console.log('🔄 Fetching deployments for project:', projectId);
      setIsLoading(true);
      
      // Fetch deployments
      const deploymentsResponse = await supabase
        .from('deployed_contracts')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (deploymentsResponse.error) throw deploymentsResponse.error;

      console.log('📊 Deployments fetched:', deploymentsResponse.data);
      setDeployments(deploymentsResponse.data || []);
      
      // Select the most recent deployment by default
      if (deploymentsResponse.data && deploymentsResponse.data.length > 0) {
        const mostRecent = deploymentsResponse.data[0];
        console.log('📦 Most recent deployment:', mostRecent);
        setSelectedDeployment(mostRecent);
        
        // Determine wallet type from module_name field
        const walletType = mostRecent.module_name === 'playground_deployment' ? 'playground' : 'external';
        
        // Extract deployer address from abi metadata if available
        let deployerAddress = null;
        if (mostRecent.abi && typeof mostRecent.abi === 'object') {
          if ('deployerAddress' in mostRecent.abi) {
            deployerAddress = (mostRecent.abi as any).deployerAddress;
          }
        }
        
        setDeploymentMetadata({
          walletType: walletType,
          deployerAddress: deployerAddress,
          network: mostRecent.network || 'testnet'
        });
        
        // Fetch real module interface from blockchain
        console.log(`🌐 Fetching interface for package: ${mostRecent.package_id} on ${mostRecent.network || 'testnet'}`);
        await fetchRealModuleInterface(mostRecent.package_id, mostRecent.network || 'testnet');
      } else {
        console.log('⚠️ No deployments found for project');
        setSelectedDeployment(null);
        setModuleInterface(null);
        setDeploymentMetadata({});
      }
    } catch (error) {
      console.error('❌ Error fetching deployments:', error);
      toast({
        title: "Error",
        description: "Failed to load deployments",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch deployments when component mounts (this gets called every time the component is remounted due to key change)
  useEffect(() => {
    console.log('🔄 ModuleInterfaceView mounted/remounted - fetching deployments...');
    fetchDeployments();
  }, [projectId]);

  // Listen for deployment completion events to refresh the list
  useEffect(() => {
    const handleDeploymentCompleted = (event: CustomEvent) => {
      console.log('📦 Deployment completed event received:', event.detail);
      // Clear cache and refresh deployments
      clearModuleInterfaceCache();
      fetchDeployments();
    };

    window.addEventListener('deployment-completed', handleDeploymentCompleted as EventListener);
    
    return () => {
      window.removeEventListener('deployment-completed', handleDeploymentCompleted as EventListener);
    };
  }, [projectId]);

  const handlePackageChange = async (packageId: string) => {
    setError(null);
    setIsPackageVerified(false);
    setModuleInterface(null);
    setSelectedModule('');

    const deployment = deployments.find(d => d.package_id === packageId);
    if (!deployment) {
      setError('Deployment not found');
      return;
    }

    setSelectedDeployment(deployment);
    
    // Determine wallet type from module_name field
    const walletType = deployment.module_name === 'playground_deployment' ? 'playground' : 'external';
    
    // Extract deployer address from abi metadata if available
    let deployerAddress = null;
    if (deployment.abi && typeof deployment.abi === 'object') {
      if ('deployerAddress' in deployment.abi) {
        deployerAddress = (deployment.abi as any).deployerAddress;
      }
    }
    
    setDeploymentMetadata({
      walletType: walletType,
      deployerAddress: deployerAddress,
      network: deployment.network || 'testnet'
    });

    // Fetch real module interface from blockchain
    await fetchRealModuleInterface(packageId, deployment.network || 'testnet');
  };

  const handleExecute = (method: ModuleFunction) => {
    if (isSharedView) {
      toast({
        title: "Read-only View",
        description: "Contract execution is disabled in shared view",
      });
      return;
    }
    setSelectedFunction(method);
  };

  return (
    <div className="h-full flex flex-col bg-background border rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-md">
            <PlayCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Package Interface</h3>
            <p className="text-xs text-muted-foreground">
              {isSharedView 
                ? "View deployed Move modules and execution history"
                : "Execute functions from your deployed Move package on IOTA"
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              console.log('🔄 Manual refresh triggered, clearing cache');
              // Clear the module interface cache to force refetch
              clearModuleInterfaceCache();
              setModuleInterface(null);
              fetchDeployments();
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant={activeView === 'interface' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-2"
            onClick={() => setActiveView('interface')}
          >
            <PlayCircle className="h-4 w-4" />
            Interface
          </Button>
          <Button
            variant={activeView === 'history' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-2"
            onClick={() => setActiveView('history')}
          >
            <History className="h-4 w-4" />
            History
          </Button>
        </div>
      </div>

      {activeView === 'interface' ? (
        <>
          <ModulePackageSelector
            contractAddress={selectedDeployment?.package_id || ''}
            onAddressChange={handlePackageChange}
            error={error}
            deployments={deployments}
            isLoading={isLoading}
          />
          
          {/* Deployment Badges */}
          {selectedDeployment && (
            <div className="px-4 py-3 border-b bg-muted/20 flex items-center gap-2 flex-wrap">
              {/* Wallet Type Badge */}
              <Badge variant={deploymentMetadata.walletType === 'playground' ? 'default' : 'secondary'} className="gap-1">
                <Wallet className="h-3 w-3" />
                {deploymentMetadata.walletType === 'playground' ? 'Playground Wallet' : 'External Wallet'}
              </Badge>
              
              {/* Network Badge */}
              <Badge variant={selectedDeployment.network === 'mainnet' ? 'destructive' : 'outline'} className="gap-1">
                <Globe className="h-3 w-3" />
                {selectedDeployment.network || 'testnet'}
              </Badge>
              
              {/* Deployer Address Badge - Clickable */}
              {deploymentMetadata.deployerAddress && (
                <Badge 
                  variant="outline" 
                  className="gap-1 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => {
                    const explorerUrl = `https://explorer.iota.org/address/${deploymentMetadata.deployerAddress}?network=${selectedDeployment.network || 'testnet'}`;
                    window.open(explorerUrl, '_blank');
                  }}
                >
                  <User className="h-3 w-3" />
                  Deployer: {deploymentMetadata.deployerAddress.slice(0, 6)}...{deploymentMetadata.deployerAddress.slice(-4)}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Badge>
              )}
              
              {/* Package ID Badge - Clickable */}
              {selectedDeployment.package_id && (
                <Badge 
                  variant="outline" 
                  className="gap-1 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => {
                    const explorerUrl = `https://explorer.iota.org/object/${selectedDeployment.package_id}?network=${selectedDeployment.network || 'testnet'}`;
                    window.open(explorerUrl, '_blank');
                  }}
                >
                  <Package className="h-3 w-3" />
                  Package: {selectedDeployment.package_id.slice(0, 6)}...{selectedDeployment.package_id.slice(-4)}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Badge>
              )}
            </div>
          )}
          
          {selectedDeployment ? (
            <>
              {/* Module Interface Display */}
              {isFetchingInterface ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw className="h-6 w-6 text-primary animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Fetching module interface from IOTA...</p>
                  </div>
                </div>
              ) : moduleInterface && moduleInterface.modules.length > 0 ? (
                <>
                  {/* Module Selector */}
                  {moduleInterface.modules.length > 1 && (
                    <div className="p-4 border-b bg-muted/20">
                      <div className="flex items-center gap-3">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <label className="text-sm font-medium">Select Module</label>
                          <Select value={selectedModule} onValueChange={setSelectedModule}>
                            <SelectTrigger className="w-full mt-1">
                              <SelectValue placeholder="Choose a module..." />
                            </SelectTrigger>
                            <SelectContent>
                              {moduleInterface.modules.map((module) => (
                                <SelectItem key={module.name} value={module.name}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm">{module.name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {module.functions.length} functions
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Functions Display */}
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-2">
                      {(() => {
                        const currentModule = moduleInterface.modules.find(m => m.name === selectedModule) || 
                                            moduleInterface.modules[0];
                        
                        if (!currentModule) {
                          return (
                            <div className="p-8 text-center">
                              <div className="text-muted-foreground mb-2">Module not found</div>
                            </div>
                          );
                        }

                        const hasContent = currentModule.functions.length > 0;
                        
                        if (!hasContent) {
                          return (
                            <div className="p-8 text-center">
                              <div className="text-muted-foreground mb-2">No public functions</div>
                              <div className="text-sm text-muted-foreground">
                                This module doesn't expose any public functions.
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-6">
                            {/* Functions Section */}
                            {currentModule.functions.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-3 px-1 flex items-center gap-2">
                                  <PlayCircle className="h-4 w-4" />
                                  Functions ({currentModule.functions.length})
                                </h4>
                                <div className="space-y-2">
                                  {currentModule.functions.map((method, index) => (
                                    <ModuleFunctionCard
                                      key={`${currentModule.name}-${method.name}-${index}`}
                                      method={method}
                                      onExecute={handleExecute}
                                      isPackageVerified={isPackageVerified}
                                      isSharedView={isSharedView}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <AlertCircle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <div className="text-muted-foreground mb-2">No module interface available</div>
                    <div className="text-sm text-muted-foreground">
                      {error ? error : 'Unable to fetch module interface from the blockchain.'}
                    </div>
                    {selectedDeployment && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-3"
                        onClick={() => fetchRealModuleInterface(selectedDeployment.package_id, selectedDeployment.network || 'testnet')}
                        disabled={isFetchingInterface}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1">
              <ModuleEmptyState
                title={isSharedView ? "No package available" : "No deployed package"}
                description={isSharedView 
                  ? "This project doesn't have a deployed Move package to interact with."
                  : "Deploy your Move package to interact with it using this interface."
                }
              />
            </div>
          )}
        </>
      ) : (
        <ModuleExecutionHistory projectId={projectId} />
      )}

      {selectedFunction && selectedDeployment && !isSharedView && (
        <PTBExecuteDialog
          open={true}
          onOpenChange={(open) => !open && setSelectedFunction(null)}
          method={selectedFunction}
          packageId={selectedDeployment.package_id}
          projectId={projectId}
          onExecute={(result) => {
            toast({
              title: "Success",
              description: "Function executed successfully",
            });
          }}
        />
      )}
    </div>
  );
}