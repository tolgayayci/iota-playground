import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Terminal,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Code,
  Clock,
} from 'lucide-react';

export interface ConsoleEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success' | 'debug';
  message: string;
  data?: any;
  source?: string;
}

interface ConsoleOutputProps {
  entries: ConsoleEntry[];
  onClear?: () => void;
  className?: string;
  maxHeight?: string;
  showTimestamp?: boolean;
  showSource?: boolean;
}

export function ConsoleOutput({ 
  entries, 
  onClear, 
  className = '',
  maxHeight = 'max-h-64',
  showTimestamp = true,
  showSource = true 
}: ConsoleOutputProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries.length]);

  const getEntryIcon = (level: ConsoleEntry['level']) => {
    switch (level) {
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'debug':
        return <Code className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEntryStyle = (level: ConsoleEntry['level']) => {
    switch (level) {
      case 'info':
        return 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/30';
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-50/30 dark:bg-yellow-950/30';
      case 'error':
        return 'border-l-red-500 bg-red-50/30 dark:bg-red-950/30';
      case 'success':
        return 'border-l-green-500 bg-green-50/30 dark:bg-green-950/30';
      case 'debug':
        return 'border-l-gray-500 bg-gray-50/30 dark:bg-gray-950/30';
    }
  };

  const copyToClipboard = () => {
    const text = entries.map(entry => {
      const timestamp = showTimestamp ? `[${entry.timestamp.toISOString()}] ` : '';
      const source = showSource && entry.source ? `[${entry.source}] ` : '';
      const data = entry.data ? `\n${JSON.stringify(entry.data, null, 2)}` : '';
      return `${timestamp}${source}${entry.level.toUpperCase()}: ${entry.message}${data}`;
    }).join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3 
    });
  };

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">Console Output</CardTitle>
            {entries.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {entries.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={copyToClipboard}
                  title="Copy all entries"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
                {onClear && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onClear}
                    title="Clear console"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {entries.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <div className="text-center">
                <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No console output yet</p>
              </div>
            </div>
          ) : (
            <ScrollArea className={`${maxHeight} w-full border rounded-lg`} ref={scrollAreaRef}>
              <div className="p-3 space-y-2">
                {entries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`border-l-4 pl-3 pr-2 py-2 rounded-r-lg ${getEntryStyle(entry.level)}`}
                  >
                    <div className="flex items-start gap-2">
                      {getEntryIcon(entry.level)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {showTimestamp && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {formatTimestamp(entry.timestamp)}
                            </span>
                          )}
                          {showSource && entry.source && (
                            <Badge variant="outline" className="text-xs px-1 py-0">
                              {entry.source}
                            </Badge>
                          )}
                          <Badge 
                            variant="outline" 
                            className={`text-xs px-1 py-0 capitalize ${
                              entry.level === 'error' ? 'text-red-600 border-red-200' :
                              entry.level === 'warning' ? 'text-yellow-600 border-yellow-200' :
                              entry.level === 'success' ? 'text-green-600 border-green-200' :
                              entry.level === 'info' ? 'text-blue-600 border-blue-200' :
                              'text-gray-600 border-gray-200'
                            }`}
                          >
                            {entry.level}
                          </Badge>
                        </div>
                        <div className="text-sm font-mono break-words">
                          {entry.message}
                        </div>
                        {entry.data && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Show data
                            </summary>
                            <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(entry.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            </ScrollArea>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Hook for managing console entries
export function useConsole() {
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);

  const addEntry = (entry: Omit<ConsoleEntry, 'id' | 'timestamp'>) => {
    const newEntry: ConsoleEntry = {
      ...entry,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    setEntries(prev => [...prev, newEntry]);
  };

  const log = (message: string, data?: any, source?: string) => {
    addEntry({ level: 'info', message, data, source });
  };

  const warn = (message: string, data?: any, source?: string) => {
    addEntry({ level: 'warning', message, data, source });
  };

  const error = (message: string, data?: any, source?: string) => {
    addEntry({ level: 'error', message, data, source });
  };

  const success = (message: string, data?: any, source?: string) => {
    addEntry({ level: 'success', message, data, source });
  };

  const debug = (message: string, data?: any, source?: string) => {
    addEntry({ level: 'debug', message, data, source });
  };

  const clear = () => {
    setEntries([]);
  };

  return {
    entries,
    log,
    warn,
    error,
    success,
    debug,
    clear,
  };
}