import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Bug, 
  ChevronDown, 
  ChevronRight, 
  Copy, 
  Check, 
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Globe,
  TestTube,
  Wallet,
  Database,
  Code,
  Network,
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface DebugPanelProps {
  className?: string;
}

export function DebugPanel({ className }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  
  const {
    currentWallet,
    isConnected,
    network,
    isPlaygroundWallet,
    playgroundAddress,
    availableWallets,
    currentAccount,
  } = useWallet();
  
  const { user, session } = useAuth();

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied to clipboard",
      description: `${label} has been copied`,
    });
  };

  const debugInfo = {
    wallet: {
      connected: isConnected,
      type: isPlaygroundWallet ? 'playground' : 'external',
      address: currentWallet?.address || null,
      playgroundAddress: playgroundAddress,
      network: network,
      availableWallets: availableWallets.length,
      currentAccount: currentAccount?.address || null,
    },
    auth: {
      authenticated: !!user,
      userId: user?.id || null,
      email: user?.email || null,
      sessionValid: !!session,
      sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    },
    environment: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookiesEnabled: navigator.cookieEnabled,
      onlineStatus: navigator.onLine,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${screen.width}x${screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    },
    storage: {
      localStorage: {
        'iota_wallet_type': localStorage.getItem('iota_wallet_type'),
        'iota_network': localStorage.getItem('iota_network'),
        'sb-access-token': localStorage.getItem('sb-access-token') ? '[HIDDEN]' : null,
        'sb-refresh-token': localStorage.getItem('sb-refresh-token') ? '[HIDDEN]' : null,
      },
      sessionStorage: Object.keys(sessionStorage).length,
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-4 right-4 z-50 ${className}`}
      >
        <Bug className="h-4 w-4 mr-2" />
        Debug
      </Button>
    );
  }

  return (
    <Card className={`fixed bottom-4 right-4 z-50 w-[400px] max-h-[80vh] overflow-y-auto ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            <CardTitle className="text-lg">Debug Panel</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Development tools and system information
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Wallet Information */}
        <Collapsible
          open={expandedSections.wallet}
          onOpenChange={() => toggleSection('wallet')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                <span className="font-medium">Wallet State</span>
                <Badge variant={isConnected ? 'default' : 'secondary'}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              {expandedSections.wallet ? 
                <ChevronDown className="h-4 w-4" /> : 
                <ChevronRight className="h-4 w-4" />
              }
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 pl-6 space-y-2 text-sm">
            {Object.entries(debugInfo.wallet).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                <div className="flex items-center gap-1">
                  <code className="px-1 py-0.5 bg-muted rounded text-xs max-w-32 truncate">
                    {value === null ? 'null' : String(value)}
                  </code>
                  {value && typeof value === 'string' && value.length > 10 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => copyToClipboard(String(value), key)}
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Authentication Information */}
        <Collapsible
          open={expandedSections.auth}
          onOpenChange={() => toggleSection('auth')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="font-medium">Authentication</span>
                <Badge variant={user ? 'default' : 'secondary'}>
                  {user ? 'Authenticated' : 'Not Authenticated'}
                </Badge>
              </div>
              {expandedSections.auth ? 
                <ChevronDown className="h-4 w-4" /> : 
                <ChevronRight className="h-4 w-4" />
              }
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 pl-6 space-y-2 text-sm">
            {Object.entries(debugInfo.auth).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                <code className="px-1 py-0.5 bg-muted rounded text-xs max-w-32 truncate">
                  {value === null ? 'null' : String(value)}
                </code>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Environment Information */}
        <Collapsible
          open={expandedSections.environment}
          onOpenChange={() => toggleSection('environment')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span className="font-medium">Environment</span>
              </div>
              {expandedSections.environment ? 
                <ChevronDown className="h-4 w-4" /> : 
                <ChevronRight className="h-4 w-4" />
              }
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 pl-6 space-y-2 text-sm">
            {Object.entries(debugInfo.environment).map(([key, value]) => (
              <div key={key} className="flex justify-between items-start">
                <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                <div className="flex items-center gap-1 max-w-48">
                  <code className="px-1 py-0.5 bg-muted rounded text-xs break-all">
                    {String(value)}
                  </code>
                  {typeof value === 'string' && value.length > 20 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 flex-shrink-0"
                      onClick={() => copyToClipboard(String(value), key)}
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Storage Information */}
        <Collapsible
          open={expandedSections.storage}
          onOpenChange={() => toggleSection('storage')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="font-medium">Browser Storage</span>
              </div>
              {expandedSections.storage ? 
                <ChevronDown className="h-4 w-4" /> : 
                <ChevronRight className="h-4 w-4" />
              }
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 pl-6 space-y-3 text-sm">
            <div>
              <div className="font-medium text-xs text-muted-foreground mb-2">Local Storage</div>
              {Object.entries(debugInfo.storage.localStorage).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center mb-1">
                  <span className="text-muted-foreground text-xs">{key}:</span>
                  <code className="px-1 py-0.5 bg-muted rounded text-xs max-w-24 truncate">
                    {value || 'null'}
                  </code>
                </div>
              ))}
            </div>
            <div>
              <div className="font-medium text-xs text-muted-foreground mb-2">Session Storage</div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Items:</span>
                <code className="px-1 py-0.5 bg-muted rounded text-xs">
                  {debugInfo.storage.sessionStorage}
                </code>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Actions */}
        <div className="space-y-2">
          <div className="font-medium text-sm">Debug Actions</div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(JSON.stringify(debugInfo, null, 2), 'Debug Info')}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reload
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
              }}
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Clear Storage
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}