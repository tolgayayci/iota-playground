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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Package, 
  Clock,
  User,
  Globe,
  Copy,
  ExternalLink,
  Loader2,
  Filter,
  AlertCircle
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

interface ObjectCategory {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  filter: (obj: ObjectInfo) => boolean;
}

export function ObjectBrowser({
  open,
  onOpenChange,
  onSelectObject,
  expectedType,
  network = 'testnet'
}: ObjectBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [objects, setObjects] = useState<ObjectInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('owned');
  const { currentAccount } = useWallet();
  const { toast } = useToast();

  // Object categories for browsing
  const categories: Record<string, ObjectCategory> = {
    owned: {
      title: 'My Objects',
      description: 'Objects owned by your wallet',
      icon: User,
      filter: (obj) => {
        if (!currentAccount?.address) return false;
        const owner = obj.owner;
        if (typeof owner === 'string') return owner === currentAccount.address;
        if (owner?.AddressOwner) return owner.AddressOwner === currentAccount.address;
        return false;
      }
    },
    shared: {
      title: 'Shared Objects',
      description: 'Objects with shared ownership',
      icon: Globe,
      filter: (obj) => {
        const owner = obj.owner;
        return owner?.Shared !== undefined;
      }
    },
    system: {
      title: 'System Objects',
      description: 'Core protocol objects',
      icon: Package,
      filter: (obj) => {
        const type = obj.type?.toLowerCase() || '';
        return type.includes('0x1::') || type.includes('0x2::') || type.includes('sui::');
      }
    }
  };

  // Fetch objects from the blockchain
  const fetchObjects = async (category: string) => {
    if (!currentAccount?.address && category === 'owned') {
      toast({
        title: "Wallet Required",
        description: "Please connect a wallet to browse your objects",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const client = new IotaClient({ url: getFullnodeUrl(network) });
      let fetchedObjects: ObjectInfo[] = [];

      if (category === 'owned' && currentAccount?.address) {
        // Fetch objects owned by the current account
        const response = await client.getOwnedObjects({
          owner: currentAccount.address,
          options: {
            showType: true,
            showOwner: true,
            showContent: true,
            showDisplay: true,
          },
          limit: 50
        });

        fetchedObjects = response.data.map(obj => ({
          objectId: obj.data!.objectId,
          version: obj.data!.version,
          digest: obj.data!.digest,
          type: obj.data!.type,
          owner: obj.data!.owner,
          content: obj.data!.content,
          display: obj.data!.display,
        }));
      } else {
        // For other categories, we'd need more specific queries
        // This is a simplified implementation
        fetchedObjects = [];
      }

      setObjects(fetchedObjects);
    } catch (error) {
      console.error('Error fetching objects:', error);
      toast({
        title: "Error",
        description: "Failed to fetch objects from the blockchain",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Search for a specific object by ID
  const searchObjectById = async (objectId: string) => {
    if (!objectId.trim()) return;

    setLoading(true);
    try {
      const client = new IotaClient({ url: getFullnodeUrl(network) });
      const response = await client.getObject({
        id: objectId,
        options: {
          showType: true,
          showOwner: true,
          showContent: true,
          showDisplay: true,
        },
      });

      if (response.data) {
        const objectInfo: ObjectInfo = {
          objectId: response.data.objectId,
          version: response.data.version,
          digest: response.data.digest,
          type: response.data.type,
          owner: response.data.owner,
          content: response.data.content,
          display: response.data.display,
        };

        setObjects([objectInfo]);
      } else {
        toast({
          title: "Object Not Found",
          description: `No object found with ID: ${objectId}`,
          variant: "destructive"
        });
        setObjects([]);
      }
    } catch (error) {
      console.error('Error searching for object:', error);
      toast({
        title: "Search Error",
        description: "Failed to search for the object",
        variant: "destructive"
      });
      setObjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter objects based on search query and expected type
  const filteredObjects = objects.filter(obj => {
    const matchesSearch = !searchQuery || 
      obj.objectId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obj.type?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = !expectedType || 
      obj.type?.toLowerCase().includes(expectedType.toLowerCase());

    return matchesSearch && matchesType;
  });

  // Load objects when category changes
  useEffect(() => {
    if (open && selectedCategory) {
      fetchObjects(selectedCategory);
    }
  }, [open, selectedCategory, currentAccount?.address]);

  const getObjectTypeDisplay = (type?: string) => {
    if (!type) return 'Unknown';
    
    const parts = type.split('::');
    if (parts.length >= 3) {
      return parts[parts.length - 1];
    }
    return type;
  };

  const getOwnerDisplay = (owner: any) => {
    if (!owner) return 'Unknown';
    
    if (typeof owner === 'string') return owner.slice(0, 6) + '...' + owner.slice(-4);
    if (owner.AddressOwner) return owner.AddressOwner.slice(0, 6) + '...' + owner.AddressOwner.slice(-4);
    if (owner.ObjectOwner) return 'Object-owned';
    if (owner.Shared) return 'Shared';
    if (owner.Immutable) return 'Immutable';
    
    return 'Unknown';
  };

  const handleSelectObject = (obj: ObjectInfo) => {
    onSelectObject(obj.objectId, obj);
    onOpenChange(false);
    toast({
      title: "Object Selected",
      description: `Selected ${getObjectTypeDisplay(obj.type)} object`,
    });
  };

  const handleSearch = () => {
    if (searchQuery.startsWith('0x') && searchQuery.length === 66) {
      searchObjectById(searchQuery);
    } else {
      // Filter current objects
      // Already handled by filteredObjects
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Object Browser
          </DialogTitle>
          <DialogDescription>
            Browse and select objects from the {network} network
            {expectedType && (
              <div className="mt-1">
                <Badge variant="outline" className="text-xs">
                  Expected: {expectedType}
                </Badge>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by object ID or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {/* Category Tabs */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="grid w-full grid-cols-3">
              {Object.entries(categories).map(([key, category]) => {
                const Icon = category.icon;
                return (
                  <TabsTrigger key={key} value={key} className="text-xs">
                    <Icon className="h-3 w-3 mr-1" />
                    {category.title}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {Object.entries(categories).map(([key, category]) => (
              <TabsContent key={key} value={key} className="mt-4">
                <div className="text-xs text-muted-foreground mb-3">
                  {category.description}
                </div>

                <ScrollArea className="h-[400px] border rounded-lg">
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="ml-2">Loading objects...</span>
                    </div>
                  ) : filteredObjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                      <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                      <div className="text-sm text-muted-foreground">
                        {objects.length === 0 ? 'No objects found' : 'No objects match your search'}
                      </div>
                      {key === 'owned' && !currentAccount?.address && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Connect a wallet to see your objects
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 p-2">
                      {filteredObjects.map((obj) => (
                        <div
                          key={obj.objectId}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer group"
                          onClick={() => handleSelectObject(obj)}
                        >
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {getObjectTypeDisplay(obj.type)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                v{obj.version}
                              </span>
                            </div>
                            <div className="font-mono text-xs text-muted-foreground truncate">
                              {obj.objectId}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Owner: {getOwnerDisplay(obj.owner)}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(obj.objectId);
                                toast({ title: "Copied", description: "Object ID copied to clipboard" });
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <a
                              href={`https://explorer.iota.org/object/${obj.objectId}?network=${network}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}