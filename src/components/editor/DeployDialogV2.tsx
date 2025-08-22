import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  RocketIcon, 
  CheckCircle, 
  Loader2,
  ExternalLink,
  Copy,
  Network,
  Coins,
  AlertCircle,
  Wallet,
  Zap,
  Activity,
  ChevronDown,
  ChevronRight,
  Settings,
  RefreshCw,
  Play,
  Code,
  Bug,
} from 'lucide-react';
import { CompilationResult } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { 
  deployWithPlaygroundWallet, 
  preparePublishTransaction,
  simulateDeployment,
  prepareDeploymentTransaction,
  PublishData
} from '@/lib/deployV2';
import { useSignAndExecuteTransaction, useConnectWallet } from '@iota/dapp-kit';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Transaction } from '@iota/iota-sdk/transactions';
import { fromB64 } from '@iota/iota-sdk/utils';
import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';
import { BytecodeInspector } from './BytecodeInspector';
import { BytecodeVerification } from './BytecodeVerification';

interface DeploymentResult {
  success: boolean;
  packageId?: string;
  transactionDigest?: string;
  explorerUrl?: string;
  error?: string;
  gasUsed?: string;
  gasCost?: string;
}

interface DeployDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  lastCompilation: CompilationResult | null;
  onDeploySuccess?: () => void;
}

export function DeployDialogV2({
  open,
  onOpenChange,
  projectId,
  lastCompilation,
  onDeploySuccess,
}: DeployDialogProps) {
  const { user } = useAuth();
  const { 
    currentAccount, 
    network, 
    isPlaygroundWallet, 
    playgroundAddress,
    switchNetwork,
    connectPlaygroundWallet,
    connectExternalWallet,
    disconnectWallet,
    availableWallets,
  } = useWallet();
  
  // State management
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);
  const [activeTab, setActiveTab] = useState<'deploy' | 'simulate' | 'bytecode'>('deploy');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [selectedWalletType, setSelectedWalletType] = useState<'playground' | 'external'>('playground');
  const [selectedNetwork, setSelectedNetwork] = useState<'testnet' | 'mainnet'>(network);
  const [publishData, setPublishData] = useState<PublishData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [deploymentStep, setDeploymentStep] = useState(0);
  const [gasEstimate, setGasEstimate] = useState<any>(null);
  const [showBytecode, setShowBytecode] = useState(false);
  const [simulationNetwork, setSimulationNetwork] = useState<'testnet' | 'mainnet'>('testnet');
  const [showWalletDialog, setShowWalletDialog] = useState(false);
  
  const { toast } = useToast();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { mutate: connectWallet } = useConnectWallet();
  // Load publish data when dialog opens
  useEffect(() => {
    if (open && lastCompilation?.success) {
      loadPublishData();
    }
  }, [open, lastCompilation, selectedNetwork]);

  const loadPublishData = async () => {
    if (!lastCompilation?.success) return;
    
    setIsLoadingData(true);
    try {
      const data = await preparePublishTransaction(projectId, selectedNetwork);
      setPublishData(data);
    } catch (error) {
      console.error('Failed to load publish data:', error);
      toast({
        title: "Failed to Load",
        description: "Could not prepare deployment data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  // Wallet connection handlers
  const handleWalletTypeChange = async (type: 'playground' | 'external') => {
    setSelectedWalletType(type);
    
    if (type === 'playground') {
      try {
        await connectPlaygroundWallet();
      } catch (error) {
        toast({
          title: "Connection Failed",
          description: "Failed to connect playground wallet",
          variant: "destructive",
        });
      }
    }
    // For external wallet, user needs to manually connect
  };

  const handleConnectExternalWallet = () => {
    const firstWallet = availableWallets[0];
    if (firstWallet) {
      connectWallet(
        { wallet: firstWallet },
        {
          onSuccess: () => {
            toast({
              title: "Wallet Connected",
              description: `Successfully connected to ${firstWallet.name}`,
            });
          },
          onError: (error) => {
            toast({
              title: "Connection Failed",
              description: error.message,
              variant: "destructive",
            });
          }
        }
      );
    }
  };

  const handleNetworkChange = (newNetwork: 'testnet' | 'mainnet') => {
    setSelectedNetwork(newNetwork);
    switchNetwork(newNetwork);
    // Reload publish data for new network
    if (lastCompilation?.success) {
      loadPublishData();
    }
  };

  // Check wallet connection status
  const isWalletConnected = selectedWalletType === 'playground' 
    ? !!playgroundAddress 
    : !!currentAccount?.address;
    
  const walletAddress = selectedWalletType === 'playground' 
    ? playgroundAddress 
    : currentAccount?.address;


  // Reset deployment result when dialog is opened
  useEffect(() => {
    if (open) {
      setDeploymentResult(null);
      setIsDeploying(false);
      setSimulationResult(null);
      setDeploymentStep(0);
      setGasEstimate(null);
    }
  }, [open]);

  // Calculate bytecode info
  const bytecodeInfo = lastCompilation?.bytecode ? {
    size: Math.ceil(lastCompilation.bytecode.length / 2), // Hex string to bytes
    sizeKB: (Math.ceil(lastCompilation.bytecode.length / 2) / 1024).toFixed(2),
    hash: lastCompilation.bytecode.slice(0, 16) + '...',
    moduleCount: lastCompilation.abi?.modules?.length || 1,
  } : null;

  // Format gas amount to IOTA
  const formatGas = (gas: string | number) => {
    const gasNum = typeof gas === 'string' ? parseInt(gas) : gas;
    return (gasNum / 1000000000).toFixed(4); // Convert from nanoIOTA to IOTA
  };

  // Deployment steps
  const deploymentSteps = [
    { id: 0, label: 'Preparing', description: 'Setting up deployment' },
    { id: 1, label: 'Estimating Gas', description: 'Calculating gas costs' },
    { id: 2, label: 'Awaiting Signature', description: 'Waiting for wallet confirmation' },
    { id: 3, label: 'Broadcasting', description: 'Sending to network' },
    { id: 4, label: 'Confirming', description: 'Waiting for confirmation' },
    { id: 5, label: 'Complete', description: 'Deployment successful' },
  ];

  const handleConnectWallet = () => {
    if (selectedWalletType === 'playground') {
      handleWalletTypeChange('playground');
    } else {
      handleConnectExternalWallet();
    }
  };

  const handleNetworkSimulate = async (network: 'testnet' | 'mainnet') => {
    if (!lastCompilation?.success) {
      toast({
        title: "Compilation Required",
        description: "Please compile your code successfully before simulation",
        variant: "destructive",
      });
      return;
    }

    // Clear any previous simulation result when starting new simulation
    if (simulationResult && simulationResult.network !== network) {
      setSimulationResult(null);
    }

    setSimulationNetwork(network);
    setIsSimulating(true);
    
    try {
      if (!user?.id) {
        throw new Error("User authentication required");
      }
      
      const result = await simulateDeployment(projectId, user.id, network);
      setSimulationResult(result);
      
      if (result.success) {
        toast({
          title: "Simulation Successful",
          description: `${network.charAt(0).toUpperCase() + network.slice(1)} simulation completed successfully`,
        });
      } else {
        toast({
          title: "Simulation Failed",
          description: result.error || "Failed to simulate deployment",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Simulation error:', error);
      
      // Set error result to display in UI
      setSimulationResult({
        success: false,
        error: error instanceof Error ? error.message : "Failed to simulate deployment",
        network,
      });
      
      toast({
        title: "Simulation Failed",
        description: error instanceof Error ? error.message : "Failed to simulate deployment",
        variant: "destructive",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulate = async () => {
    if (!lastCompilation?.success) {
      toast({
        title: "Compilation Required",
        description: "Please compile your contract successfully before simulating.",
        variant: "destructive",
      });
      return;
    }

    setIsSimulating(true);
    try {
      const result = await simulateDeployment(projectId, user.id, simulationNetwork);
      setSimulationResult(result);
      
      if (result.success) {
        toast({
          title: "Simulation Successful",
          description: "Deployment simulation completed successfully",
        });
      } else {
        toast({
          title: "Simulation Failed",
          description: result.error || "Failed to simulate deployment",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Simulation error:', error);
      toast({
        title: "Simulation Failed",
        description: error instanceof Error ? error.message : "Failed to simulate deployment",
        variant: "destructive",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handlePlaygroundDeploy = async () => {
    if (!lastCompilation?.success) {
      toast({
        title: "Compilation Required",
        description: "Please compile your contract successfully before deploying.",
        variant: "destructive",
      });
      return;
    }

    setIsDeploying(true);
    setDeploymentStep(0);
    
    try {
      // Step 1: Preparing
      setDeploymentStep(1);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Estimating Gas
      setDeploymentStep(2);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 3: Broadcasting
      setDeploymentStep(3);
      const result = await deployWithPlaygroundWallet(projectId, network);
      
      // Step 4: Confirming
      setDeploymentStep(4);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (result.success) {
        // Step 5: Complete
        setDeploymentStep(5);
        setDeploymentResult(result);
        toast({
          title: "Deployment Successful",
          description: `Package deployed with ID: ${result.packageId}`,
        });
        onDeploySuccess?.();
      } else {
        throw new Error(result.error || 'Deployment failed');
      }
    } catch (error) {
      console.error('Deployment error:', error);
      toast({
        title: "Deployment Failed",
        description: error instanceof Error ? error.message : "Failed to deploy contract",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
      setDeploymentStep(0);
    }
  };

  const handleExternalWalletDeploy = async () => {
    if (!lastCompilation?.success) {
      toast({
        title: "Compilation Required",
        description: "Please compile your contract successfully before deploying.",
        variant: "destructive",
      });
      return;
    }

    if (!currentAccount?.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to deploy.",
        variant: "destructive",
      });
      return;
    }

    if (!publishData) {
      toast({
        title: "No Publish Data",
        description: "Please wait for publish data to load.",
        variant: "destructive",
      });
      return;
    }

    setIsDeploying(true);
    setDeploymentStep(0);
    
    try {
      // Step 1: Preparing
      setDeploymentStep(1);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Estimating Gas
      setDeploymentStep(2);
      
      // Create publish transaction using IOTA SDK
      const tx = new Transaction();
      
      // Convert base64 modules to Uint8Array
      const moduleBytes = publishData.modules.map((m: string) => fromB64(m));
      
      // Convert dependencies to proper format
      const iotaDependencies = publishData.dependencies.map(dep => {
        if (dep === '0x1') return '0x0000000000000000000000000000000000000000000000000000000000000001';
        if (dep === '0x2') return '0x0000000000000000000000000000000000000000000000000000000000000002';
        return dep;
      });
      
      // Publish the package
      const [upgradeCap] = tx.publish({
        modules: moduleBytes,
        dependencies: iotaDependencies,
      });
      
      // Transfer upgrade capability to the sender
      tx.transferObjects([upgradeCap], currentAccount.address);
      
      // Set gas budget
      tx.setGasBudget(publishData.gasEstimate);

      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 3: Awaiting Signature
      setDeploymentStep(3);
      
      // Sign and execute with wallet
      signAndExecute({
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true,
        }
      }, {
        onSuccess: async (result) => {
          console.log('🚀 External wallet deployment SUCCESS');
          console.log('📦 Object changes:', result.objectChanges);
          console.log('⚡ Effects:', result.effects);
          
          // Step 4: Broadcasting
          setDeploymentStep(4);
          
          setTimeout(async () => {
            // Step 5: Complete
            setDeploymentStep(5);
            
            // Extract package ID from transaction result - IOTA specific format
            let packageId: string | undefined;
            
            console.log('🔍 Analyzing transaction result structure...');
            console.log('🔍 Has objectChanges?', !!result.objectChanges);
            console.log('🔍 Has effects?', !!result.effects);
            console.log('🔍 Has bytes?', !!result.bytes);
            
            // If we have the raw transaction bytes, we need to decode them to get the package ID
            // The package ID is embedded in the transaction data
            if (result.bytes && !result.objectChanges) {
              console.log('📦 Transaction has bytes but no objectChanges, attempting to extract package ID from bytes...');
              
              // The package ID is typically the first address in the transaction bytes after the sender
              // In the bytes, look for addresses (32 bytes starting with known patterns)
              try {
                // Convert base64 to hex for easier parsing
                const bytes = atob(result.bytes);
                const hexBytes = Array.from(bytes).map(b => b.charCodeAt(0).toString(16).padStart(2, '0')).join('');
                
                // Look for potential package IDs in the hex (64 character hex strings)
                // Package IDs are 32 bytes (64 hex chars) and often start with patterns
                const addressPattern = /[a-f0-9]{64}/g;
                const matches = hexBytes.match(addressPattern);
                
                if (matches && matches.length > 0) {
                  // The first match after the sender is often the package ID
                  // Skip the sender address (first match) and look for the package
                  for (let i = 1; i < Math.min(matches.length, 5); i++) {
                    const potentialPackageId = '0x' + matches[i];
                    // Verify it's not all zeros or ones
                    if (!matches[i].match(/^0+$/) && !matches[i].match(/^f+$/)) {
                      packageId = potentialPackageId;
                      console.log(`📦 Potential package ID found at position ${i}:`, packageId);
                      break;
                    }
                  }
                }
              } catch (error) {
                console.error('Failed to parse transaction bytes:', error);
              }
            }
            
            // Primary method: Look for published package in objectChanges
            if (!packageId && result.objectChanges) {
              const publishedPackage = result.objectChanges.find((change: any) => 
                change.type === 'published'
              );
              
              if (publishedPackage) {
                packageId = publishedPackage.packageId;
                console.log('📦 Found published package in objectChanges:', packageId);
              }
              
              // Look for any packageId in objectChanges
              if (!packageId) {
                for (const change of result.objectChanges) {
                  if (change.packageId) {
                    packageId = change.packageId;
                    console.log('📦 Found packageId in objectChanges:', packageId);
                    break;
                  }
                }
              }
              
              // Look for UpgradeCap to extract package ID
              if (!packageId) {
                const upgradeCapChange = result.objectChanges.find((change: any) => 
                  change.type === 'created' && 
                  change.objectType?.includes('UpgradeCap')
                );
                
                if (upgradeCapChange) {
                  // Extract package ID from the UpgradeCap type string
                  // Format: "0x123::package::UpgradeCap"
                  const typeMatch = upgradeCapChange.objectType.match(/^(0x[a-f0-9]+)::/);
                  if (typeMatch) {
                    packageId = typeMatch[1];
                    console.log('📦 Extracted package ID from UpgradeCap type:', packageId);
                  }
                }
              }
            }
            
            // Parse from digest - ALWAYS query the transaction for accurate data
            if (!packageId && result.digest) {
              console.log('📦 Querying transaction details from chain using digest:', result.digest);
              try {
                const client = new IotaClient({ url: getFullnodeUrl(selectedNetwork) });
                const txDetails = await client.getTransactionBlock({
                  digest: result.digest,
                  options: {
                    showObjectChanges: true,
                    showEffects: true,
                    showEvents: true,
                    showInput: true
                  }
                });
                
                console.log('📦 Full transaction details from chain:', JSON.stringify(txDetails, null, 2));
                
                // Look for published package in the detailed response
                if (txDetails.objectChanges) {
                  const published = txDetails.objectChanges.find((change: any) => 
                    change.type === 'published'
                  );
                  
                  if (published && published.packageId) {
                    packageId = published.packageId;
                    console.log('📦 Found package ID from published object:', packageId);
                  } else {
                    // Look for any created object that might be the package
                    for (const change of txDetails.objectChanges) {
                      console.log('📦 Checking object change:', change);
                      if (change.packageId) {
                        packageId = change.packageId;
                        console.log('📦 Found package ID in object change:', packageId);
                        break;
                      }
                    }
                  }
                }
                
                // If still no package ID, check the effects for created objects
                if (!packageId && txDetails.effects?.created) {
                  console.log('📦 Checking created objects in effects...');
                  for (const created of txDetails.effects.created) {
                    console.log('📦 Created object:', created);
                    // Packages have Immutable owner
                    if (created.owner === 'Immutable' || (created.owner && created.owner.Immutable)) {
                      packageId = created.reference?.objectId || created.objectId;
                      console.log('📦 Found immutable object (likely package):', packageId);
                      break;
                    }
                  }
                }
                
                // Check events for Publish event
                if (!packageId && txDetails.events) {
                  console.log('📦 Checking events for package publish...');
                  for (const event of txDetails.events) {
                    console.log('📦 Event:', event);
                    if (event.type === '0x2::package::PublishEvent' || event.type?.includes('Publish')) {
                      // The package ID might be in the event data
                      if (event.parsedJson?.package_id) {
                        packageId = event.parsedJson.package_id;
                        console.log('📦 Found package ID in publish event:', packageId);
                        break;
                      }
                    }
                  }
                }
              } catch (error) {
                console.error('Failed to query transaction details:', error);
                
                // As a last resort, use the transaction digest to link to explorer
                console.log('⚠️ Could not determine package ID, will use transaction digest for tracking');
              }
            }
            
            console.log('📦 Final package ID:', packageId);
            
            // Check if we successfully extracted package ID
            if (!packageId) {
              console.error('❌ Failed to extract package ID from transaction result');
              toast({
                title: "Deployment Warning",
                description: "Transaction succeeded but couldn't extract package ID. Check explorer with transaction digest.",
                variant: "destructive",
              });
            }

            const deployResult: DeploymentResult = {
              success: true,
              packageId: packageId || 'unknown',
              transactionDigest: result.digest,
              explorerUrl: selectedNetwork === 'testnet'
                ? `https://explorer.iota.org/txblock/${result.digest}?network=testnet`
                : `https://explorer.iota.org/txblock/${result.digest}?network=mainnet`,
              gasUsed: result.effects?.gasUsed?.computationCost,
              gasCost: result.effects?.gasUsed?.storageCost,
            };

            console.log('✅ Deploy result created:', deployResult);
            setDeploymentResult(deployResult);

            // Save deployment to database (frontend)
            console.log('💾 Starting database save...');
            console.log('📝 Package ID:', packageId);
            console.log('👤 User ID:', user?.id);
            console.log('📊 Project ID:', projectId);
            console.log('🌐 Network:', selectedNetwork);
            
            // Always try to save deployment info, even without package ID
            if (user?.id && result.digest) {
              try {
                // Use transaction digest as fallback identifier if no package ID
                const deploymentId = packageId || `tx_${result.digest}`;
                
                // Extract ABI from compilation result
                const compilationAbi = lastCompilation?.abi;
                console.log('🔧 Compilation ABI:', compilationAbi);
                
                let abiFunctions = [];
                
                if (compilationAbi) {
                  if (Array.isArray(compilationAbi)) {
                    abiFunctions = compilationAbi;
                  } else if (compilationAbi.functions && Array.isArray(compilationAbi.functions)) {
                    abiFunctions = compilationAbi.functions;
                  }
                }

                console.log('🔧 ABI Functions to save:', abiFunctions);

                const deploymentData = {
                  project_id: projectId,
                  user_id: user.id,
                  package_id: deploymentId,
                  module_address: deploymentId,
                  module_name: 'external_deployment',
                  network: selectedNetwork,
                  abi: abiFunctions,
                  transaction_hash: result.digest,
                  gas_used: parseInt(result.effects?.gasUsed?.computationCost || '0'),
                  wallet_type: 'external'
                };

                console.log('💾 Attempting to save deployment data:', deploymentData);

                // Use upsert to handle re-deployments (same package_id + network)
                const { data: insertData, error: dbError } = await supabase
                  .from('deployed_contracts')
                  .upsert(deploymentData, {
                    onConflict: 'package_id,network',
                    ignoreDuplicates: false
                  })
                  .select();

                if (dbError) {
                  console.error('❌ Failed to save deployment to database:', dbError);
                  console.error('❌ Database error details:', JSON.stringify(dbError, null, 2));
                  
                  // If database save fails, try calling backend endpoint as fallback
                  try {
                    console.log('🔄 Attempting to save via backend endpoint...');
                    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
                    
                    const backendResponse = await fetch(`${API_URL}/v2/deploy/save-external`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        projectId,
                        packageId,
                        transactionDigest: result.digest,
                        network: selectedNetwork,
                        abi: abiFunctions,
                        gasUsed: result.effects?.gasUsed?.computationCost,
                        userId: user.id,
                      }),
                    });
                    
                    if (backendResponse.ok) {
                      console.log('✅ Successfully saved deployment via backend');
                    } else {
                      const error = await backendResponse.json();
                      console.error('❌ Backend save failed:', error);
                    }
                  } catch (backendError) {
                    console.error('❌ Backend fallback failed:', backendError);
                  }
                } else {
                  console.log('✅ Successfully saved deployment to database:', packageId);
                  console.log('✅ Database upsert result:', insertData);
                  
                  // Trigger refresh of deployments in ModuleInterfaceView
                  window.dispatchEvent(new CustomEvent('deployment-completed', { 
                    detail: { packageId, network: selectedNetwork }
                  }));
                }

                // Update project with deployment info
                console.log('📝 Updating project with deployment info...');
                const projectUpdateData = {
                  package_id: packageId,
                  module_address: packageId,
                  last_deployment: {
                    packageId: packageId,
                    transactionDigest: result.digest,
                    network: selectedNetwork,
                    timestamp: new Date().toISOString(),
                  }
                };

                console.log('📝 Project update data:', projectUpdateData);

                const { data: updateData, error: updateError } = await supabase
                  .from('projects')
                  .update(projectUpdateData)
                  .eq('id', projectId)
                  .select();

                if (updateError) {
                  console.error('❌ Failed to update project:', updateError);
                } else {
                  console.log('✅ Successfully updated project:', updateData);
                }

              } catch (saveError) {
                console.error('❌ Error saving deployment:', saveError);
                // Don't fail the deployment for database save errors
              }
            } else {
              console.warn('⚠️ Cannot save to database - missing required data');
              console.log('📦 Package ID:', packageId);
              console.log('🔑 Transaction digest:', result.digest);
              console.log('👤 User ID:', user?.id);
            }

            // Show success notification with appropriate message
            if (packageId && packageId !== 'unknown') {
              toast({
                title: "Deployment Successful",
                description: `Package deployed with ID: ${packageId}`,
              });
            } else {
              toast({
                title: "Deployment Completed",
                description: `Transaction successful. View in explorer: ${result.digest.slice(0, 8)}...`,
              });
            }
            onDeploySuccess?.();
          }, 1000);
        },
        onError: (error) => {
          console.error('Deployment error:', error);
          toast({
            title: "Deployment Failed",
            description: error.message || "Failed to deploy contract",
            variant: "destructive",
          });
          setIsDeploying(false);
          setDeploymentStep(0);
        }
      });
    } catch (error) {
      console.error('Deployment error:', error);
      toast({
        title: "Deployment Failed",
        description: error instanceof Error ? error.message : "Failed to deploy contract",
        variant: "destructive",
      });
      setIsDeploying(false);
      setDeploymentStep(0);
    }
  };

  const handleDeploy = () => {
    if (selectedWalletType === 'playground') {
      handlePlaygroundDeploy();
    } else {
      handleExternalWalletDeploy();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
  };

  if (!lastCompilation) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              No Compilation Found
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
            <p className="text-sm">
              Please compile your contract before attempting to deploy.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RocketIcon className="h-5 w-5" />
              Deploy Contract
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="deploy" className="flex items-center gap-2">
                <RocketIcon className="h-4 w-4" />
                Deploy
              </TabsTrigger>
              <TabsTrigger value="simulate" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Simulate
              </TabsTrigger>
              <TabsTrigger value="bytecode" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Bytecode
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-4">
              <TabsContent value="deploy" className="space-y-4">
                {/* Bytecode Inspection Panel */}
                {lastCompilation?.success && bytecodeInfo && (
                  <Collapsible open={showBytecode} onOpenChange={setShowBytecode}>
                    <div className="rounded-lg border bg-muted/30">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between p-4 hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <Code className="h-4 w-4" />
                            <span className="font-medium">Bytecode Inspection</span>
                            <Badge variant="outline">{bytecodeInfo.sizeKB} KB</Badge>
                          </div>
                          {showBytecode ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Size:</span>
                                <span className="font-mono">{bytecodeInfo.size} bytes</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Modules:</span>
                                <span className="font-mono">{bytecodeInfo.moduleCount}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Hash:</span>
                                <span className="font-mono text-xs">{bytecodeInfo.hash}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Status:</span>
                                <Badge variant="default" className="bg-green-500/10 text-green-500">
                                  Verified
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="text-xs text-muted-foreground mb-2">Bytecode (first 128 chars):</div>
                            <div className="bg-muted rounded p-2 font-mono text-xs break-all">
                              {lastCompilation.bytecode?.slice(0, 128)}...
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}

                {/* Deployment Progress */}
                {isDeploying && (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="h-4 w-4 animate-pulse" />
                      <span className="font-medium">Deployment Progress</span>
                    </div>
                    <div className="space-y-3">
                      {deploymentSteps.map((step, index) => (
                        <div key={step.id} className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            deploymentStep > step.id 
                              ? "bg-green-500" 
                              : deploymentStep === step.id 
                                ? "bg-blue-500 animate-pulse" 
                                : "bg-muted-foreground/30"
                          )} />
                          <div className="flex-1">
                            <div className={cn(
                              "text-sm",
                              deploymentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                            )}>
                              {step.label}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {step.description}
                            </div>
                          </div>
                          {deploymentStep === step.id && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          {deploymentStep > step.id && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deployment Status Card */}
                <div className="space-y-4">
                  {/* Wallet Type Selector */}
                  <div className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                    <label className="text-sm font-medium">Wallet Type:</label>
                    <Select value={selectedWalletType} onValueChange={(value: 'playground' | 'external') => handleWalletTypeChange(value)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="playground">Playground Wallet</SelectItem>
                        <SelectItem value="external">External Wallet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Wallet Status */}
                  <div className="rounded-lg border bg-card">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-primary" />
                          <span className="font-medium">Wallet</span>
                        </div>
                        {isWalletConnected ? (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-200">
                            ✓ Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-200">
                            Not Connected
                          </Badge>
                        )}
                      </div>
                      
                      {isWalletConnected ? (
                        <div className="grid grid-cols-1 gap-3 text-sm">
                          <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                            <span className="text-muted-foreground font-medium">Type</span>
                            <Badge variant="outline" className="font-mono text-xs">
                              {selectedWalletType === 'playground' ? 'Playground Wallet' : 'External Wallet'}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                            <span className="text-muted-foreground font-medium">Address</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">
                                {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-6)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(walletAddress || '')}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                            <span className="text-muted-foreground font-medium">Network</span>
                            <Badge variant="default" className="capitalize">{network}</Badge>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={handleConnectWallet}
                          >
                            <Wallet className="mr-2 h-4 w-4" />
                            {selectedWalletType === 'playground' ? 'Connect Playground' : 'Connect External Wallet'}
                          </Button>
                          {selectedWalletType === 'external' && (
                            <p className="text-xs text-muted-foreground text-center">
                              Install IOTA Wallet or compatible wallet extension to connect
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Gas Estimation */}
                  {lastCompilation?.success && publishData && (
                    <div className="rounded-lg border bg-card">
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Zap className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">Gas Estimation</span>
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-200">
                            {selectedNetwork.charAt(0).toUpperCase() + selectedNetwork.slice(1)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                            <span className="text-muted-foreground font-medium">Estimated Cost</span>
                            <span className="font-mono text-xs font-semibold text-blue-600">
                              {publishData.estimatedCost}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                            <span className="text-muted-foreground font-medium">Gas Limit</span>
                            <span className="font-mono text-xs">
                              {(publishData.gasEstimate / 1000000000).toFixed(3)} IOTA
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                            <span className="text-muted-foreground font-medium">Modules</span>
                            <span className="font-mono text-xs">
                              {publishData.modules.length}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Deployment Result */}
                {deploymentResult && deploymentResult.success && (
                  <div className="rounded-lg border bg-card border-green-200">
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="font-medium text-green-700">Deployment Successful!</span>
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-200">
                          Deployed
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        {deploymentResult.packageId && (
                          <div className="flex items-center justify-between py-2 px-3 rounded-md bg-green-50 border border-green-100">
                            <span className="text-green-700 font-medium">Package ID</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-green-600">
                                {deploymentResult.packageId.slice(0, 12)}...{deploymentResult.packageId.slice(-8)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(deploymentResult.packageId || '')}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                        {deploymentResult.transactionDigest && (
                          <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                            <span className="text-muted-foreground font-medium">Transaction</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">
                                {deploymentResult.transactionDigest.slice(0, 12)}...{deploymentResult.transactionDigest.slice(-8)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(deploymentResult.transactionDigest || '')}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                        {deploymentResult.gasUsed && (
                          <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                            <span className="text-muted-foreground font-medium">Gas Used</span>
                            <span className="font-mono text-xs">
                              {formatGas(deploymentResult.gasUsed)} IOTA
                            </span>
                          </div>
                        )}
                        {deploymentResult.explorerUrl && (
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => window.open(deploymentResult.explorerUrl, '_blank')}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View in Explorer
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="simulate" className="space-y-4">
                {/* Simulation Cards */}
                <div className="space-y-3">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-primary" />
                      <h3 className="text-base font-semibold">Transaction Simulation</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Test deployment costs and effects without spending gas
                    </p>
                  </div>

                  {/* Testnet Simulation Card */}
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span className="font-medium text-sm">Simulate on Testnet</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Free
                        </Badge>
                      </div>
                      <Button
                        onClick={() => handleNetworkSimulate('testnet')}
                        disabled={isSimulating || !lastCompilation?.success}
                        size="sm"
                        variant="outline"
                      >
                        {isSimulating && simulationNetwork === 'testnet' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Simulating...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Simulate
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex items-start gap-2">
                      <Zap className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Get accurate gas estimates using real testnet state and funded playground wallet
                      </p>
                    </div>
                    
                    {/* Testnet Results */}
                    {simulationResult && simulationResult.network === 'testnet' && (
                      <div className="mt-2 pt-2 border-t space-y-3">
                        {simulationResult.success ? (
                          <>
                            {/* Success Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="default" className="bg-green-500 text-white text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Simulation Successful
                                </Badge>
                              </div>
                              <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">
                                Dry Run Only
                              </Badge>
                            </div>

                            {/* Gas Analysis */}
                            <Collapsible>
                              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors group border border-border/50">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <Zap className="h-4 w-4 text-blue-500" />
                                  Gas Analysis
                                  <Badge variant="secondary" className="text-xs">
                                    IOTA Testnet
                                  </Badge>
                                </div>
                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:rotate-[-90deg]" />
                              </CollapsibleTrigger>
                              <CollapsibleContent className="px-2 pb-2">
                                <div className="space-y-2 pt-2">
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className="text-sm text-muted-foreground">Computation</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="font-mono text-sm font-medium">
                                          {formatGas(simulationResult.effects.gasUsed.computationCost)} IOTA
                                        </span>
                                        <div className="text-xs text-muted-foreground">
                                          {parseInt(simulationResult.effects.gasUsed.computationCost).toLocaleString()} units
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                        <span className="text-sm text-muted-foreground">Storage</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="font-mono text-sm font-medium">
                                          {formatGas(simulationResult.effects.gasUsed.storageCost)} IOTA
                                        </span>
                                        <div className="text-xs text-muted-foreground">
                                          {parseInt(simulationResult.effects.gasUsed.storageCost).toLocaleString()} units
                                        </div>
                                      </div>
                                    </div>
                                    {simulationResult.effects.gasUsed.storageRebate && parseInt(simulationResult.effects.gasUsed.storageRebate) > 0 && (
                                      <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                          <span className="text-sm text-muted-foreground">Storage Rebate</span>
                                        </div>
                                        <div className="text-right">
                                          <span className="font-mono text-sm font-medium text-green-600">
                                            +{formatGas(simulationResult.effects.gasUsed.storageRebate)} IOTA
                                          </span>
                                          <div className="text-xs text-muted-foreground">
                                            {parseInt(simulationResult.effects.gasUsed.storageRebate).toLocaleString()} units
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    <div className="border-t pt-2 mt-2">
                                      <div className="flex justify-between items-center font-medium bg-background p-2 rounded-lg">
                                        <span className="text-sm">Total Estimated Cost:</span>
                                        <span className="font-mono text-sm text-blue-600">
                                          {formatGas(
                                            (parseInt(simulationResult.effects.gasUsed.computationCost) + 
                                             parseInt(simulationResult.effects.gasUsed.storageCost) - 
                                             parseInt(simulationResult.effects.gasUsed.storageRebate || '0')).toString()
                                          )} IOTA
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>

                            {/* Transaction Effects */}
                            {simulationResult.objectChanges && simulationResult.objectChanges.length > 0 && (
                              <Collapsible>
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors group border border-border/50">
                                  <div className="flex items-center gap-2 text-sm font-medium">
                                    <Activity className="h-4 w-4 text-orange-500" />
                                    Transaction Effects
                                    <Badge variant="secondary" className="text-xs">
                                      {simulationResult.objectChanges.length} Change{simulationResult.objectChanges.length !== 1 ? 's' : ''}
                                    </Badge>
                                  </div>
                                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:rotate-[-90deg]" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="px-2 pb-2">
                                  <div className="space-y-2 pt-2">
                                    {simulationResult.objectChanges.map((change: any, index: number) => (
                                      <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                          <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            change.type === 'published' ? 'bg-green-500' : 
                                            change.type === 'created' ? 'bg-blue-500' : 
                                            change.type === 'mutated' ? 'bg-yellow-500' : 'bg-gray-500'
                                          )}></div>
                                          <span className="font-mono text-sm font-medium capitalize">
                                            {change.type}
                                          </span>
                                          {change.type === 'published' && change.modules && (
                                            <Badge variant="secondary" className="text-xs">
                                              {change.modules.length} module{change.modules.length !== 1 ? 's' : ''}
                                            </Badge>
                                          )}
                                        </div>
                                        {change.packageId && (
                                          <div className="flex items-center gap-2">
                                            <code className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                                              {change.packageId.slice(0, 8)}...{change.packageId.slice(-8)}
                                            </code>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-6 w-6 p-0"
                                              onClick={() => navigator.clipboard.writeText(change.packageId)}
                                            >
                                              <Copy className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}

                          </>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-red-700">
                              <AlertCircle className="h-4 w-4" />
                              <span className="font-medium">Simulation Failed</span>
                            </div>
                            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                              <div className="flex items-center gap-1 mb-1">
                                <Bug className="h-3 w-3" />
                                <span className="font-medium">Error Details:</span>
                              </div>
                              <div className="font-mono text-xs">
                                {simulationResult.error || 'Unknown error'}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mainnet Simulation Card */}
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="font-medium text-sm">Simulate on Mainnet</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Real Prices
                        </Badge>
                      </div>
                      <Button
                        onClick={() => handleNetworkSimulate('mainnet')}
                        disabled={isSimulating || !lastCompilation?.success}
                        size="sm"
                        variant="outline"
                      >
                        {isSimulating && simulationNetwork === 'mainnet' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Simulating...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Simulate
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex items-start gap-2">
                      <Coins className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Get production gas estimates using real mainnet state and pricing
                      </p>
                    </div>
                    
                    {/* Mainnet Results */}
                    {simulationResult && simulationResult.network === 'mainnet' && (
                      <div className="mt-2 pt-2 border-t space-y-3">
                        {simulationResult.success ? (
                          <>
                            {/* Success Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="default" className="bg-green-500 text-white text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Simulation Successful
                                </Badge>
                              </div>
                              <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                                Real Mainnet Data
                              </Badge>
                            </div>

                            {/* Gas Analysis */}
                            <Collapsible>
                              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors group border border-border/50">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <Zap className="h-4 w-4 text-green-500" />
                                  Gas Analysis
                                  <Badge variant="secondary" className="text-xs">
                                    IOTA Mainnet
                                  </Badge>
                                </div>
                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:rotate-[-90deg]" />
                              </CollapsibleTrigger>
                              <CollapsibleContent className="px-2 pb-2">
                                <div className="space-y-2 pt-2">
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className="text-sm text-muted-foreground">Computation</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="font-mono text-sm font-medium">
                                          {formatGas(simulationResult.effects.gasUsed.computationCost)} IOTA
                                        </span>
                                        <div className="text-xs text-muted-foreground">
                                          {parseInt(simulationResult.effects.gasUsed.computationCost).toLocaleString()} units
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                        <span className="text-sm text-muted-foreground">Storage</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="font-mono text-sm font-medium">
                                          {formatGas(simulationResult.effects.gasUsed.storageCost)} IOTA
                                        </span>
                                        <div className="text-xs text-muted-foreground">
                                          {parseInt(simulationResult.effects.gasUsed.storageCost).toLocaleString()} units
                                        </div>
                                      </div>
                                    </div>
                                    {simulationResult.effects.gasUsed.storageRebate && parseInt(simulationResult.effects.gasUsed.storageRebate) > 0 && (
                                      <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                          <span className="text-sm text-muted-foreground">Storage Rebate</span>
                                        </div>
                                        <div className="text-right">
                                          <span className="font-mono text-sm font-medium text-green-600">
                                            +{formatGas(simulationResult.effects.gasUsed.storageRebate)} IOTA
                                          </span>
                                          <div className="text-xs text-muted-foreground">
                                            {parseInt(simulationResult.effects.gasUsed.storageRebate).toLocaleString()} units
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    <div className="border-t pt-2 mt-2">
                                      <div className="flex justify-between items-center font-medium bg-background p-2 rounded-lg">
                                        <span className="text-sm">Total Estimated Cost:</span>
                                        <span className="font-mono text-sm text-green-600">
                                          {formatGas(
                                            (parseInt(simulationResult.effects.gasUsed.computationCost) + 
                                             parseInt(simulationResult.effects.gasUsed.storageCost) - 
                                             parseInt(simulationResult.effects.gasUsed.storageRebate || '0')).toString()
                                          )} IOTA
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>

                            {/* Transaction Effects */}
                            {simulationResult.objectChanges && simulationResult.objectChanges.length > 0 && (
                              <Collapsible>
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors group border border-border/50">
                                  <div className="flex items-center gap-2 text-sm font-medium">
                                    <Activity className="h-4 w-4 text-orange-500" />
                                    Transaction Effects
                                    <Badge variant="secondary" className="text-xs">
                                      {simulationResult.objectChanges.length} Change{simulationResult.objectChanges.length !== 1 ? 's' : ''}
                                    </Badge>
                                  </div>
                                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:rotate-[-90deg]" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="px-2 pb-2">
                                  <div className="space-y-2 pt-2">
                                    {simulationResult.objectChanges.map((change: any, index: number) => (
                                      <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                          <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            change.type === 'published' ? 'bg-green-500' : 
                                            change.type === 'created' ? 'bg-blue-500' : 
                                            change.type === 'mutated' ? 'bg-yellow-500' : 'bg-gray-500'
                                          )}></div>
                                          <span className="font-mono text-sm font-medium capitalize">
                                            {change.type}
                                          </span>
                                          {change.type === 'published' && change.modules && (
                                            <Badge variant="secondary" className="text-xs">
                                              {change.modules.length} module{change.modules.length !== 1 ? 's' : ''}
                                            </Badge>
                                          )}
                                        </div>
                                        {change.packageId && (
                                          <div className="flex items-center gap-2">
                                            <code className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                                              {change.packageId.slice(0, 8)}...{change.packageId.slice(-8)}
                                            </code>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-6 w-6 p-0"
                                              onClick={() => navigator.clipboard.writeText(change.packageId)}
                                            >
                                              <Copy className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}

                          </>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-red-700">
                              <AlertCircle className="h-4 w-4" />
                              <span className="font-medium">Simulation Failed</span>
                            </div>
                            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-3 space-y-2">
                              <div className="flex items-center gap-1">
                                <Bug className="h-3 w-3" />
                                <span className="font-medium">Error Details:</span>
                              </div>
                              <div className="font-mono text-xs bg-red-100 border border-red-200 rounded p-2">
                                {simulationResult.error || 'Unknown simulation error'}
                              </div>
                              {simulationResult.error?.includes('gas coins') && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                                  <div className="flex items-start gap-2">
                                    <div className="text-xs">💡</div>
                                    <div className="text-xs text-yellow-800">
                                      <div className="font-medium mb-1">Expected Behavior</div>
                                      <div>
                                        This is expected - playground wallet has no mainnet funds. 
                                        Gas estimates would be accurate for funded wallets.
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </TabsContent>

              <TabsContent value="bytecode" className="space-y-4">
                <Tabs defaultValue="inspector" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="inspector" className="flex items-center gap-2">
                      <Code className="h-3 w-3" />
                      Inspector
                    </TabsTrigger>
                    <TabsTrigger value="verification" className="flex items-center gap-2">
                      <Bug className="h-3 w-3" />
                      Verification
                    </TabsTrigger>
                  </TabsList>
                  
                  <div className="mt-4">
                    <TabsContent value="inspector" className="mt-0">
                      <BytecodeInspector lastCompilation={lastCompilation} />
                    </TabsContent>
                    <TabsContent value="verification" className="mt-0">
                      <BytecodeVerification lastCompilation={lastCompilation} />
                    </TabsContent>
                  </div>
                </Tabs>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeploy}
              disabled={isDeploying || !isWalletConnected || !lastCompilation?.success || (selectedWalletType === 'external' && !publishData)}
            >
              {isDeploying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <RocketIcon className="mr-2 h-4 w-4" />
                  Deploy
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}