import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Zap,
  Plus,
  History,
  BookOpen,
  AlertCircle,
  Play,
  Eye,
  Loader2,
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';
import { Transaction } from '@iota/iota-sdk/transactions';

// Import child components
import { PTBPackageSelector } from '@/components/ptb-builder/PTBPackageSelector';
import { PTBCommandFlow } from '@/components/ptb-builder/PTBCommandFlow';
import { PTBExecutionDialog } from '@/components/ptb-builder/PTBExecutionDialog';
import { PTBTemplateDialog } from '@/components/ptb-builder/PTBTemplateDialog';
import { PTBHistoryPanel } from '@/components/ptb-builder/PTBHistoryPanel';

interface PTBBuilderV3Props {
  projectId: string;
  deployedPackageId?: string;
  isSharedView?: boolean;
}

export interface PTBCommand {
  id: string;
  type: 'MoveCall';
  target: string;
  module: string;
  function: string;
  arguments?: any[];
  typeArguments?: string[];
  description?: string;
}

interface ModuleInfo {
  name: string;
  address: string;
  functions: FunctionInfo[];
}

interface FunctionInfo {
  name: string;
  visibility: string;
  isEntry: boolean;
  parameters: Array<{
    name: string;
    type: string;
  }>;
  returnTypes: string[];
}

export function PTBBuilderV3({ projectId, deployedPackageId, isSharedView = false }: PTBBuilderV3Props) {
  // Core state
  const [activeView, setActiveView] = useState<'builder' | 'history'>('builder');
  const [commands, setCommands] = useState<PTBCommand[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>(deployedPackageId || '');
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showExecution, setShowExecution] = useState(false);
  const [executionMode, setExecutionMode] = useState<'dry-run' | 'execute'>('dry-run');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [packageNetwork, setPackageNetwork] = useState<'testnet' | 'mainnet'>('testnet');
  
  // Hooks
  const { user } = useAuth();
  const { network, isConnected, currentWallet } = useWallet();
  const { toast } = useToast();

  // Update selectedPackage when deployedPackageId prop changes (after new deployment)
  useEffect(() => {
    if (deployedPackageId && deployedPackageId !== selectedPackage) {
      setSelectedPackage(deployedPackageId);
    }
  }, [deployedPackageId]);

  // Fetch modules when package changes
  useEffect(() => {
    if (selectedPackage && selectedPackage.startsWith('0x')) {
      fetchModulesWithNetwork(selectedPackage);
    }
  }, [selectedPackage]);

  const fetchModulesWithNetwork = async (packageId: string) => {
    // First check if this package is in our deployed contracts
    const { data: deployments } = await supabase
      .from('deployed_contracts')
      .select('network')
      .eq('package_id', packageId)
      .eq('project_id', projectId)
      .limit(1);
    
    let detectedNetwork = deployments?.[0]?.network;
    
    // If not found in deployed contracts, check external packages
    if (!detectedNetwork) {
      const { data: externalPackages } = await supabase
        .from('external_packages')
        .select('network')
        .eq('package_id', packageId)
        .eq('project_id', projectId)
        .limit(1);
      
      detectedNetwork = externalPackages?.[0]?.network;
    }
    
    // Use detected network or fall back to current network
    const targetNetwork = detectedNetwork || network;
    setPackageNetwork(targetNetwork as 'testnet' | 'mainnet');
    
    await fetchModules(packageId, targetNetwork as 'testnet' | 'mainnet');
  };

  const fetchModules = async (packageId: string, targetNetwork: 'testnet' | 'mainnet' = 'testnet') => {
    try {
      setIsLoadingModules(true);
      const client = new IotaClient({ url: getFullnodeUrl(targetNetwork) });
      
      const normalizedModules = await client.getNormalizedMoveModulesByPackage({
        package: packageId,
      });

      const moduleList: ModuleInfo[] = [];
      
      for (const [moduleName, moduleData] of Object.entries(normalizedModules)) {
        const functions: FunctionInfo[] = [];
        
        // Process exposed functions
        if (moduleData.exposedFunctions) {
          for (const [funcName, funcData] of Object.entries(moduleData.exposedFunctions)) {
            functions.push({
              name: funcName,
              visibility: funcData.visibility,
              isEntry: funcData.isEntry || false,
              parameters: funcData.parameters?.map((param, idx) => {
                let typeStr = '';
                
                if (typeof param === 'string') {
                  typeStr = param;
                } else if (typeof param === 'object') {
                  if ('Reference' in param) {
                    const ref = param.Reference;
                    if (ref.Struct) {
                      typeStr = `&${ref.Struct.address}::${ref.Struct.module}::${ref.Struct.name}`;
                    } else {
                      typeStr = '&unknown';
                    }
                  } else if ('MutableReference' in param) {
                    const ref = param.MutableReference;
                    if (ref.Struct) {
                      typeStr = `&mut ${ref.Struct.address}::${ref.Struct.module}::${ref.Struct.name}`;
                    } else {
                      typeStr = '&mut unknown';
                    }
                  } else if ('Struct' in param) {
                    const struct = param.Struct;
                    typeStr = `${struct.address}::${struct.module}::${struct.name}`;
                  } else if ('Vector' in param) {
                    typeStr = 'vector';
                  } else {
                    // Fallback: try to stringify the object
                    typeStr = JSON.stringify(param);
                  }
                } else {
                  typeStr = String(param);
                }
                
                return {
                  name: `arg${idx}`,
                  type: typeStr
                };
              }) || [],
              returnTypes: funcData.return_ || [],
            });
          }
        }
        
        moduleList.push({
          name: moduleName,
          address: packageId,
          functions,
        });
      }
      
      setModules(moduleList);
    } catch (error) {
      console.error('Failed to fetch modules:', error);
      setModules([]);
      // Only show toast for non-404 errors (package not found is expected for external packages sometimes)
      if (error instanceof Error && !error.message.includes('does not exist')) {
        toast({
          title: "Failed to fetch modules",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoadingModules(false);
    }
  };


  const handleApplyTemplate = (templateCommands: PTBCommand[]) => {
    const commandsWithIds = templateCommands.map(cmd => ({
      ...cmd,
      id: Date.now().toString() + Math.random(),
    }));
    setCommands(commandsWithIds);
    setShowTemplates(false);
    toast({
      title: "Template Applied",
      description: "PTB template has been loaded",
    });
  };

  const handleDryRun = () => {
    if (commands.length === 0) {
      toast({
        title: "No commands",
        description: "Add at least one command to dry run",
        variant: "destructive",
      });
      return;
    }
    setExecutionMode('dry-run');
    setShowExecution(true);
  };

  const handleExecute = () => {
    if (commands.length === 0) {
      toast({
        title: "No commands",
        description: "Add at least one command to execute",
        variant: "destructive",
      });
      return;
    }
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Connect your wallet to execute PTB",
        variant: "destructive",
      });
      return;
    }
    setExecutionMode('execute');
    setShowExecution(true);
  };

  const handleExecutionComplete = () => {
    setHistoryRefreshKey(prev => prev + 1);
  };

  return (
    <div className="h-full flex flex-col bg-background border rounded-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-md">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">PTB Builder</h3>
            <p className="text-xs text-muted-foreground">
              Build and execute Programmable Transaction Blocks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={activeView === 'builder' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('builder')}
          >
            Builder
          </Button>
          <Button
            variant={activeView === 'history' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('history')}
          >
            <History className="h-4 w-4 mr-1" />
            History
          </Button>
        </div>
      </div>

      {activeView === 'builder' ? (
        <>
          {/* Package Selector */}
          <PTBPackageSelector
            selectedPackage={selectedPackage}
            onPackageChange={setSelectedPackage}
            projectId={projectId}
            deployedPackageId={deployedPackageId}
            isLoading={isLoadingModules}
          />

          {/* Commands Area with new Flow Interface */}
          <div className="flex-1 flex flex-col">
            <PTBCommandFlow
              commands={commands}
              onCommandsChange={setCommands}
              modules={modules}
              selectedPackage={selectedPackage}
              isLoading={isLoadingModules}
              onShowTemplates={() => setShowTemplates(true)}
            />
          </div>

          {/* Execution Controls */}
          <div className="border-t p-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="outline">
                  {packageNetwork === 'testnet' ? 'Testnet' : 'Mainnet'}
                </Badge>
                {isConnected ? (
                  <Badge variant="secondary" className="gap-1">
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Not Connected
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDryRun}
                  disabled={commands.length === 0}
                  className="gap-1.5"
                >
                  <Eye className="h-4 w-4" />
                  Dry Run
                </Button>
                <Button
                  size="sm"
                  onClick={handleExecute}
                  disabled={commands.length === 0 || !isConnected}
                  className="gap-1.5"
                >
                  <Play className="h-4 w-4" />
                  Execute
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Package Selector for History Tab */}
          <PTBPackageSelector
            selectedPackage={selectedPackage}
            onPackageChange={setSelectedPackage}
            projectId={projectId}
            deployedPackageId={deployedPackageId}
            isLoading={isLoadingModules}
          />
          
          <PTBHistoryPanel 
            projectId={projectId} 
            selectedPackage={selectedPackage}
            refreshKey={historyRefreshKey}
          />
        </>
      )}

      {/* Modals */}
      <PTBTemplateDialog
        open={showTemplates}
        onOpenChange={setShowTemplates}
        onApply={handleApplyTemplate}
      />

      <PTBExecutionDialog
        open={showExecution}
        onOpenChange={setShowExecution}
        commands={commands}
        mode={executionMode}
        network={packageNetwork}
        projectId={projectId}
        selectedPackage={selectedPackage}
        onExecutionComplete={handleExecutionComplete}
      />
    </div>
  );
}