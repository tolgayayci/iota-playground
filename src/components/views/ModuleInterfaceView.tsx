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
import { History, PlayCircle, Package, RefreshCw, AlertCircle } from 'lucide-react';
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
  const { toast } = useToast();

  const fetchRealModuleInterface = async (packageId: string, network: 'testnet' | 'mainnet' = 'testnet') => {
    try {
      setIsFetchingInterface(true);
      setError(null);
      
      // Validate package ID format
      if (!packageId || packageId === 'unknown' || packageId.length < 10 || packageId.startsWith('tx_')) {
        throw new Error('Package deployment is still being processed. Please check the transaction in explorer.');
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
      const { data, error } = await supabase
        .from('deployed_contracts')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('📊 Deployments fetched:', data);
      setDeployments(data || []);
      
      // Select the most recent deployment by default
      if (data && data.length > 0) {
        const mostRecent = data[0];
        console.log('📦 Most recent deployment:', mostRecent);
        setSelectedDeployment(mostRecent);
        // Fetch real module interface from blockchain
        console.log(`🌐 Fetching interface for package: ${mostRecent.package_id} on ${mostRecent.network || 'testnet'}`);
        await fetchRealModuleInterface(mostRecent.package_id, mostRecent.network || 'testnet');
      } else {
        console.log('⚠️ No deployments found for project');
        setSelectedDeployment(null);
        setModuleInterface(null);
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

                        const hasContent = currentModule.functions.length > 0 || currentModule.structs.length > 0;
                        
                        if (!hasContent) {
                          return (
                            <div className="p-8 text-center">
                              <div className="text-muted-foreground mb-2">No public interface</div>
                              <div className="text-sm text-muted-foreground">
                                This module doesn't expose any public functions or structs.
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
                            
                            {/* Structs Section */}
                            {currentModule.structs.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-3 px-1 flex items-center gap-2">
                                  <Package className="h-4 w-4" />
                                  Structs ({currentModule.structs.length})
                                </h4>
                                <div className="space-y-2">
                                  {currentModule.structs.map((struct, index) => (
                                    <div key={`${currentModule.name}-${struct.name}-${index}`} className="border rounded-lg p-3">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="font-mono text-sm font-medium">{struct.name}</span>
                                        {struct.abilities && struct.abilities.length > 0 && (
                                          <div className="flex gap-1">
                                            {struct.abilities.map((ability) => (
                                              <Badge key={ability} variant="outline" className="text-xs">
                                                {ability}
                                              </Badge>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      {struct.fields.length > 0 ? (
                                        <div className="space-y-1 text-xs">
                                          {struct.fields.map((field) => (
                                            <div key={field.name} className="flex items-center gap-2 text-muted-foreground font-mono">
                                              <span>{field.name}:</span>
                                              <span className="text-foreground">{field.type}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-xs text-muted-foreground">No fields</div>
                                      )}
                                    </div>
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