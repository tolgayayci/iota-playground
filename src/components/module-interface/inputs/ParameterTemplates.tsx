import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  FileText as Template, 
  Search,
  Copy,
  Star,
  Clock,
  Zap,
  Code,
  Package,
  Coins
} from 'lucide-react';
import { ModuleFunctionInput } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface ParameterTemplatesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parameters: ModuleFunctionInput[];
  onApplyTemplate: (template: ParameterSet) => void;
}

export interface ParameterSet {
  name: string;
  description: string;
  icon?: React.ComponentType<any>;
  category: string;
  values: Record<string, string>;
  tags: string[];
}

// Common parameter templates for Move functions
const PARAMETER_TEMPLATES: ParameterSet[] = [
  // Token/Coin Operations
  {
    name: "Small Amount",
    description: "Small token amount for testing",
    icon: Coins,
    category: "amounts",
    values: {
      amount: "100",
      value: "100"
    },
    tags: ["amount", "token", "small", "test"]
  },
  {
    name: "Medium Amount", 
    description: "Medium token amount",
    icon: Coins,
    category: "amounts",
    values: {
      amount: "1000000",
      value: "1000000"
    },
    tags: ["amount", "token", "medium"]
  },
  {
    name: "Large Amount",
    description: "Large token amount",
    icon: Coins,
    category: "amounts", 
    values: {
      amount: "1000000000",
      value: "1000000000"
    },
    tags: ["amount", "token", "large"]
  },

  // Boolean Operations
  {
    name: "Enable Feature",
    description: "Enable a feature or option",
    icon: Zap,
    category: "boolean",
    values: {
      enabled: "true",
      active: "true",
      allow: "true"
    },
    tags: ["boolean", "enable", "true"]
  },
  {
    name: "Disable Feature",
    description: "Disable a feature or option", 
    icon: Zap,
    category: "boolean",
    values: {
      enabled: "false",
      active: "false",
      allow: "false"
    },
    tags: ["boolean", "disable", "false"]
  },

  // Address Templates
  {
    name: "Zero Address",
    description: "The zero address (0x0...)",
    icon: Package,
    category: "addresses",
    values: {
      recipient: "0x0000000000000000000000000000000000000000000000000000000000000000",
      to: "0x0000000000000000000000000000000000000000000000000000000000000000",
      address: "0x0000000000000000000000000000000000000000000000000000000000000000"
    },
    tags: ["address", "zero", "null"]
  },
  {
    name: "System Address",
    description: "System package address (0x1)",
    icon: Package,
    category: "addresses", 
    values: {
      package: "0x0000000000000000000000000000000000000000000000000000000000000001",
      address: "0x0000000000000000000000000000000000000000000000000000000000000001"
    },
    tags: ["address", "system", "package"]
  },

  // Counter-specific templates
  {
    name: "Counter Increment",
    description: "Increment counter by 1",
    icon: Zap,
    category: "counter",
    values: {
      value: "1",
      amount: "1",
      increment: "1"
    },
    tags: ["counter", "increment", "one"]
  },
  {
    name: "Counter Increment (10)",
    description: "Increment counter by 10",
    icon: Zap,
    category: "counter",
    values: {
      value: "10", 
      amount: "10",
      increment: "10"
    },
    tags: ["counter", "increment", "ten"]
  },

  // Vector templates
  {
    name: "Empty Vector",
    description: "Empty array/vector",
    icon: Code,
    category: "vectors",
    values: {
      items: "[]",
      values: "[]",
      data: "[]"
    },
    tags: ["vector", "array", "empty"]
  },
  {
    name: "Hello World Bytes",
    description: "Hello World as byte vector",
    icon: Code,
    category: "vectors",
    values: {
      data: 'b"Hello World"',
      bytes: 'b"Hello World"',
      message: 'b"Hello World"'
    },
    tags: ["vector", "bytes", "hello", "text"]
  },
  {
    name: "Simple Number Array",
    description: "Array with numbers 1, 2, 3",
    icon: Code,
    category: "vectors",
    values: {
      numbers: "[1, 2, 3]",
      values: "[1, 2, 3]",
      items: "[1, 2, 3]"
    },
    tags: ["vector", "numbers", "simple"]
  }
];

export function ParameterTemplates({
  open,
  onOpenChange,
  parameters,
  onApplyTemplate
}: ParameterTemplatesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { toast } = useToast();

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(PARAMETER_TEMPLATES.map(t => t.category)))];

  // Filter templates based on search and category
  const filteredTemplates = PARAMETER_TEMPLATES.filter(template => {
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;

    // Check if template has relevant parameters
    const parameterNames = parameters.map(p => p.name.toLowerCase());
    const hasRelevantParams = Object.keys(template.values).some(key => 
      parameterNames.some(param => param.includes(key.toLowerCase()) || key.toLowerCase().includes(param))
    );

    return matchesSearch && matchesCategory && hasRelevantParams;
  });

  const handleApplyTemplate = (template: ParameterSet) => {
    onApplyTemplate(template);
    onOpenChange(false);
    
    const appliedCount = Object.keys(template.values).filter(key =>
      parameters.some(p => p.name.toLowerCase().includes(key.toLowerCase()) || 
                          key.toLowerCase().includes(p.name.toLowerCase()))
    ).length;

    toast({
      title: "Template Applied",
      description: `Applied "${template.name}" to ${appliedCount} parameter(s)`,
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'amounts': return Coins;
      case 'boolean': return Zap;
      case 'addresses': return Package;
      case 'counter': return Star;
      case 'vectors': return Code;
      default: return Template;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'amounts': return 'text-green-600 bg-green-50 dark:bg-green-950/20';
      case 'boolean': return 'text-blue-600 bg-blue-50 dark:bg-blue-950/20';
      case 'addresses': return 'text-purple-600 bg-purple-50 dark:bg-purple-950/20';
      case 'counter': return 'text-orange-600 bg-orange-50 dark:bg-orange-950/20';
      case 'vectors': return 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/20';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-950/20';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Template className="h-5 w-5" />
            Parameter Templates
          </DialogTitle>
          <DialogDescription>
            Quick presets for common parameter combinations
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4">
          {/* Search and filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const Icon = getCategoryIcon(category);
                return (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectedCategory(category)}
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Templates list */}
          <ScrollArea className="h-[400px]">
            {filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Template className="h-8 w-8 text-muted-foreground mb-2" />
                <div className="text-sm text-muted-foreground">
                  No templates found for your current parameters
                </div>
              </div>
            ) : (
              <div className="space-y-3 pr-2">
                {filteredTemplates.map((template, index) => {
                  const Icon = template.icon || Template;
                  const applicableParams = Object.keys(template.values).filter(key =>
                    parameters.some(p => p.name.toLowerCase().includes(key.toLowerCase()) || 
                                        key.toLowerCase().includes(p.name.toLowerCase()))
                  );

                  return (
                    <div
                      key={index}
                      className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer group"
                      onClick={() => handleApplyTemplate(template)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              getCategoryColor(template.category)
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{template.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {template.description}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">
                              Will apply to: {applicableParams.join(', ')}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {template.tags.map((tag, tagIndex) => (
                                <Badge key={tagIndex} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {/* Preview values */}
                          <div className="text-xs bg-muted/50 rounded p-2 font-mono">
                            {Object.entries(template.values)
                              .filter(([key]) => applicableParams.includes(key))
                              .map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="text-muted-foreground">{key}:</span>
                                  <span>{value}</span>
                                </div>
                              ))
                            }
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(JSON.stringify(template.values, null, 2));
                              toast({ title: "Copied", description: "Template values copied to clipboard" });
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}