import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  Package, 
  User,
  Copy,
  ExternalLink,
  Loader2,
  AlertCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Coins,
  Image,
  FileText,
  Box,
  Check,
  X,
  Sparkles,
  Shield,
  Share2,
  Lock
} from 'lucide-react';
import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';
import { useWallet } from '@/contexts/WalletContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface ObjectBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectObject: (objectId: string, objectInfo?: any) => void;
  expectedType?: string;
  network?: 'testnet' | 'mainnet';
  packageId?: string;
}

interface ObjectInfo {
  objectId: string;
  version: string;
  digest: string;
  type?: string;
  owner?: any;
  content?: any;
  display?: any;
}

const ITEMS_PER_PAGE = 5;

export function ObjectBrowser({
  open,
  onOpenChange,
  onSelectObject,
  expectedType,
  network = 'testnet',
  packageId
}: ObjectBrowserProps) {
  const [typeFilter, setTypeFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'owned' | 'shared' | 'immutable'>('all');
  const [loading, setLoading] = useState(false);
  const [objects, setObjects] = useState<ObjectInfo[]>([]);
  const [filteredObjects, setFilteredObjects] = useState<ObjectInfo[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { currentAccount } = useWallet();
  const { toast } = useToast();

  // Fetch package/owned objects
  const searchObjects = async () => {
    setLoading(true);
    setObjects([]);
    setCurrentPage(1);
    
    try {
      const client = new IotaClient({ url: getFullnodeUrl(network) });
      let fetchedObjects: ObjectInfo[] = [];

      // If packageId is provided, fetch all objects from that package (owned + shared)
      if (packageId) {
        console.log('Fetching all objects from package:', packageId);
        try {
          // Fetch both owned and shared objects from the package
          const packageObjects = await fetchKnownPackageObjects(packageId, client);
          fetchedObjects = packageObjects;
        } catch (error) {
          console.error('Failed to fetch package objects:', error);
        }
      }
      // If wallet is connected and no packageId, fetch owned objects
      else if (currentAccount?.address && !packageId) {
        console.log('Fetching owned objects for address:', currentAccount.address);
        try {
          const response = await client.getOwnedObjects({
            owner: currentAccount.address,
            filter: null, // Remove packageId filter for general browsing
            options: {
              showType: true,
              showOwner: true,
              showContent: true,
              showDisplay: true,
            },
            limit: 50
          });

          console.log('getOwnedObjects response:', response);
          if (response.data && Array.isArray(response.data)) {
            fetchedObjects = response.data
              .filter(item => item && item.data)
              .map(item => ({
                objectId: item.data!.objectId || '',
                version: item.data!.version || '',
                digest: item.data!.digest || '',
                type: item.data!.type || '',
                owner: item.data!.owner || '',
                content: item.data!.content || null,
                display: item.data!.display || null,
              }));
              
            console.log('Processed owned objects:', fetchedObjects.length);
          } else {
            console.warn('No data in getOwnedObjects response:', response);
          }
        } catch (error) {
          console.error('Failed to fetch owned objects:', error);
        }
      } else {
        console.log('No wallet connected or packageId provided. Wallet:', !!currentAccount?.address, 'PackageId:', !!packageId);
      }

      console.log('Setting objects:', fetchedObjects.length, 'objects loaded');
      setObjects(fetchedObjects);
      
      // Apply filters after a small delay to ensure state is updated
      setTimeout(() => {
        applyFilters(fetchedObjects);
      }, 50);
    } catch (error) {
      console.error('Error searching objects:', error);
      toast({
        title: "Search Error",
        description: "Failed to search for objects",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch all objects from a package including shared objects
  const fetchKnownPackageObjects = async (pkgId: string, client: IotaClient): Promise<ObjectInfo[]> => {
    const allObjectIds = new Set<string>();
    const objects: ObjectInfo[] = [];
    
    console.log(`Fetching all objects for package: ${pkgId}`);
    
    // Method 1: Query transactions to find created objects
    try {
      // Query transactions that created objects from this package
      const txResponse = await client.queryTransactionBlocks({
        filter: {
          InputObject: pkgId
        },
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
        limit: 50
      });
      
      console.log(`Found ${txResponse.data.length} transactions for package`);
      
      // Extract created object IDs from transaction effects
      for (const tx of txResponse.data) {
        if (tx.effects?.created) {
          for (const created of tx.effects.created) {
            allObjectIds.add(created.reference.objectId);
          }
        }
        // Also check object changes for new objects
        if (tx.objectChanges) {
          for (const change of tx.objectChanges) {
            if (change.type === 'created' && change.objectType?.includes(pkgId)) {
              allObjectIds.add(change.objectId);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error querying transactions:', error);
    }

    // Method 2: If wallet connected, get owned objects
    if (currentAccount?.address) {
      try {
        const ownedResponse = await client.getOwnedObjects({
          owner: currentAccount.address,
          filter: {
            StructType: `${pkgId}::`
          },
          options: {
            showType: true,
            showOwner: true,
            showContent: true,
            showDisplay: true,
          },
          limit: 50
        });

        if (ownedResponse.data && Array.isArray(ownedResponse.data)) {
          for (const item of ownedResponse.data) {
            if (item.data) {
              allObjectIds.add(item.data.objectId);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch owned package objects:', error);
      }
    }

    // Method 3: Add any hardcoded known objects (temporary)
    // This includes your shared object
    const knownSharedObjects = [
      '0x2160e4373e5163788452f9175c805a44a069947bfc66a5b99f960a5c9c1d75d4', // Your shared object
      '0x303d8127340f4cd0994daba4a22a01e226466ac35221b1851743783da0daa574', // Example counter
    ];
    
    for (const id of knownSharedObjects) {
      allObjectIds.add(id);
    }

    console.log(`Found ${allObjectIds.size} unique object IDs`);

    // Fetch all objects in batches using multiGetObjects
    if (allObjectIds.size > 0) {
      const objectIdArray = Array.from(allObjectIds);
      
      try {
        const objectsResponse = await client.multiGetObjects({
          ids: objectIdArray,
          options: {
            showType: true,
            showOwner: true,
            showContent: true,
            showDisplay: true,
          }
        });

        for (const objResponse of objectsResponse) {
          if (objResponse.data) {
            // Check if object type matches the package
            const objectType = objResponse.data.type || '';
            if (objectType.includes(pkgId) || pkgId === '') {
              objects.push({
                objectId: objResponse.data.objectId,
                version: objResponse.data.version || '',
                digest: objResponse.data.digest || '',
                type: objResponse.data.type,
                owner: objResponse.data.owner,
                content: objResponse.data.content,
                display: objResponse.data.display,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching objects with multiGetObjects:', error);
      }
    }

    console.log(`Returning ${objects.length} objects for package ${pkgId}`);
    // Log detailed object info for debugging
    if (objects.length > 0) {
      console.log('Fetched objects:', objects.map(o => ({
        id: o.objectId.slice(0, 10),
        type: o.type,
        owner: o.owner?.Shared ? 'Shared' : o.owner?.AddressOwner ? 'Owned' : o.owner === 'Immutable' ? 'Immutable' : 'Other'
      })));
    } else {
      console.warn('No objects found for package', pkgId);
    }
    
    return objects;
  };

  // Apply filters to objects
  const applyFilters = (objectList: ObjectInfo[]) => {
    let filtered = [...objectList];

    // Apply type filter
    if (typeFilter) {
      filtered = filtered.filter(obj => {
        const type = getObjectTypeDisplay(obj.type);
        return type.toLowerCase().includes(typeFilter.toLowerCase());
      });
    }

    // Apply owner filter
    if (ownerFilter !== 'all') {
      filtered = filtered.filter(obj => {
        const owner = obj.owner;
        if (ownerFilter === 'owned') {
          return typeof owner === 'string' || owner?.AddressOwner;
        } else if (ownerFilter === 'shared') {
          return owner?.Shared;
        } else if (ownerFilter === 'immutable') {
          return owner?.Immutable;
        }
        return false;
      });
    }

    // Apply expected type filter if provided
    if (expectedType) {
      const cleanExpectedType = expectedType.replace(/^&/, '').replace(/mut\s+/, '');
      console.log('Filtering by expected type:', expectedType, 'clean:', cleanExpectedType);
      console.log('Available types:', objectList.map(obj => obj.type));
      
      filtered = filtered.filter(obj => {
        const type = obj.type?.toLowerCase() || '';
        const cleanType = type.replace(/0x[a-f0-9]+::/g, '');
        const expectedLower = cleanExpectedType.toLowerCase();
        
        // More flexible matching
        const matches = type.includes(expectedLower) || 
                       cleanType.includes(expectedLower) ||
                       type.endsWith(expectedLower) ||
                       cleanType.endsWith(expectedLower.split('::').pop() || '');
        
        console.log(`Type matching: ${type} vs ${expectedLower} = ${matches}`);
        return matches;
      });
    }

    setFilteredObjects(filtered);
    setTotalPages(Math.ceil(filtered.length / ITEMS_PER_PAGE));
    setCurrentPage(1);
  };

  // Get paginated objects
  const getPaginatedObjects = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredObjects.slice(startIndex, endIndex);
  };

  // Load objects when dialog opens
  useEffect(() => {
    if (open) {
      setTypeFilter('');
      setOwnerFilter('all');
      setObjects([]);
      setCurrentPage(1);
      
      // Load objects based on context
      setTimeout(() => {
        searchObjects();
      }, 100);
    }
  }, [open, currentAccount?.address, packageId]);

  // Apply filters when they change
  useEffect(() => {
    applyFilters(objects);
  }, [typeFilter, ownerFilter, expectedType]);

  const getObjectTypeDisplay = (type?: string) => {
    if (!type) return 'Unknown';
    const parts = type.split('::');
    if (parts.length >= 3) {
      return parts[parts.length - 1];
    }
    return type;
  };

  const getObjectIcon = (type?: string) => {
    if (!type) return <Box className="h-4 w-4" />;
    
    const typeName = getObjectTypeDisplay(type).toLowerCase();
    
    if (typeName.includes('coin')) return <Coins className="h-4 w-4 text-yellow-500" />;
    if (typeName.includes('nft')) return <Image className="h-4 w-4 text-purple-500" />;
    if (typeName.includes('counter')) return <Sparkles className="h-4 w-4 text-blue-500" />;
    if (typeName.includes('package')) return <Package className="h-4 w-4 text-orange-500" />;
    
    return <FileText className="h-4 w-4 text-gray-500" />;
  };

  const getOwnerBadge = (owner: any) => {
    if (!owner) return null;
    
    if (typeof owner === 'string' || owner?.AddressOwner) {
      return (
        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
          <User className="h-3 w-3 mr-1" />
          Owned
        </Badge>
      );
    }
    if (owner?.Shared) {
      return (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
          <Share2 className="h-3 w-3 mr-1" />
          Shared
        </Badge>
      );
    }
    if (owner?.Immutable) {
      return (
        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
          <Lock className="h-3 w-3 mr-1" />
          Immutable
        </Badge>
      );
    }
    
    return null;
  };

  const handleSelectObject = (obj: ObjectInfo) => {
    onSelectObject(obj.objectId, obj);
    onOpenChange(false);
    toast({
      title: "Object Selected",
      description: `Selected ${getObjectTypeDisplay(obj.type)} object`,
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
      toast({
        title: "Copied",
        description: "Object ID copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const truncateObjectId = (id: string) => {
    if (id.length <= 12) return id;
    return `${id.slice(0, 6)}...${id.slice(-4)}`;
  };

  const paginatedObjects = getPaginatedObjects();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Object Packages
          </DialogTitle>
          <DialogDescription>
            Search for objects by ID or browse package objects
            {expectedType && (
              <Badge variant="outline" className="ml-2 text-xs max-w-xs truncate" title={expectedType}>
                Expected: {(() => {
                  // Extract the struct name from the full type
                  const cleanType = expectedType.replace(/^&mut\s+|^&\s+/, '');
                  const parts = cleanType.split('::');
                  if (parts.length >= 2) {
                    return parts.slice(-2).join('::'); // Show module::Struct
                  }
                  return parts[parts.length - 1] || cleanType; // Show just Struct
                })()}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-3">
          {/* Filters */}
          <div className="space-y-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by type..."
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-8 text-sm w-[200px]"
                />
                {(typeFilter || ownerFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTypeFilter('');
                      setOwnerFilter('all');
                    }}
                    className="h-8 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              <ToggleGroup 
                type="single" 
                value={ownerFilter} 
                onValueChange={(value) => value && setOwnerFilter(value as any)}
              >
                <ToggleGroupItem value="all" size="sm">All</ToggleGroupItem>
                <ToggleGroupItem value="owned" size="sm">
                  <User className="h-3 w-3 mr-1" />
                  Owned
                </ToggleGroupItem>
                <ToggleGroupItem value="shared" size="sm">
                  <Share2 className="h-3 w-3 mr-1" />
                  Shared
                </ToggleGroupItem>
                <ToggleGroupItem value="immutable" size="sm">
                  <Lock className="h-3 w-3 mr-1" />
                  Immutable
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {/* Objects List */}
          <ScrollArea className="h-[460px] border rounded-lg">
            {loading ? (
              <div className="space-y-2 p-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : paginatedObjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <div className="text-sm text-muted-foreground">
                  {objects.length === 0 ? (
                    packageId ?
                      'No package objects found' :
                      currentAccount?.address ?
                        'No objects found in your wallet' :
                        'Connect wallet to browse objects'
                  ) : (
                    'No objects match your filters'
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-3">
                {paginatedObjects.map((obj) => (
                  <div
                    key={obj.objectId}
                    className={cn(
                      "flex items-center justify-between p-4 border rounded-lg cursor-pointer",
                      "hover:bg-muted/50 transition-colors group"
                    )}
                    onClick={() => handleSelectObject(obj)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getObjectIcon(obj.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {getObjectTypeDisplay(obj.type)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            v{obj.version}
                          </span>
                          {getOwnerBadge(obj.owner)}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {truncateObjectId(obj.objectId)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(obj.objectId);
                        }}
                      >
                        {copiedId === obj.objectId ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      <a
                        href={`https://explorer.iota.org/object/${obj.objectId}?network=${network}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "flex items-center justify-center h-7 w-7 rounded hover:bg-muted",
                          network === 'testnet' ? 'text-blue-500' : 'text-green-500'
                        )}
                        onClick={(e) => e.stopPropagation()}
                        title="View on IOTA Explorer"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Pagination */}
          {(totalPages > 1 || filteredObjects.length > 0) && (
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                {totalPages > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </>
                )}
              </div>
              {filteredObjects.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredObjects.length)} of {filteredObjects.length} objects
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}