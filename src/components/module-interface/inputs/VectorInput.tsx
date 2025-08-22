import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  Minus,
  Copy, 
  RotateCcw,
  Upload,
  Download,
  Info,
  GripVertical,
  List,
  Code
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { NumberInput } from './NumberInput';
import { AddressInput } from './AddressInput';
import { ObjectIdInput } from './ObjectIdInput';

export interface VectorInputProps {
  value: string;
  onChange: (value: string) => void;
  type: string; // e.g., "vector<u8>", "vector<address>", etc.
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  network?: 'testnet' | 'mainnet';
}

interface ElementInfo {
  elementType: string;
  isNumber: boolean;
  isAddress: boolean;
  isObjectId: boolean;
  isBool: boolean;
}

export function VectorInput({
  value,
  onChange,
  type,
  placeholder,
  disabled = false,
  className,
  network = 'testnet'
}: VectorInputProps) {
  const [elements, setElements] = useState<string[]>(['']);
  const [inputMode, setInputMode] = useState<'builder' | 'raw'>('builder');
  const [rawInput, setRawInput] = useState<string>('');

  // Parse the vector element type
  const parseElementType = (vectorType: string): ElementInfo => {
    // Extract element type from vector<ElementType>
    const match = vectorType.match(/vector<(.+)>/);
    const elementType = match ? match[1].trim() : 'string';
    
    const isNumber = /^u(8|16|32|64|128|256)$/.test(elementType);
    const isAddress = elementType === 'address';
    const isObjectId = elementType.startsWith('&') || elementType.includes('::');
    const isBool = elementType === 'bool';
    
    return {
      elementType,
      isNumber,
      isAddress,
      isObjectId,
      isBool
    };
  };

  const elementInfo = parseElementType(type);

  // Convert array to string representation
  const arrayToString = (arr: string[]): string => {
    const validElements = arr.filter(el => el.trim() !== '');
    
    if (validElements.length === 0) {
      return '[]';
    }

    // For special cases
    if (elementInfo.elementType === 'u8' && validElements.every(el => /^\d+$/.test(el))) {
      // For vector<u8>, check if it looks like a string (all ASCII values)
      const nums = validElements.map(el => parseInt(el));
      if (nums.every(n => n >= 32 && n <= 126)) {
        try {
          const str = String.fromCharCode(...nums);
          return `b"${str}"`; // Byte string representation
        } catch {
          // Fall through to array representation
        }
      }
    }

    // Standard array representation
    return JSON.stringify(validElements);
  };

  // Convert string representation to array
  const stringToArray = (str: string): string[] => {
    if (!str || str.trim() === '' || str.trim() === '[]') {
      return [''];
    }

    try {
      // Handle byte string format b"text"
      if (str.startsWith('b"') && str.endsWith('"')) {
        const text = str.slice(2, -1);
        return text.split('').map(char => char.charCodeAt(0).toString());
      }

      // Handle JSON array format
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item));
      }

      // Handle comma-separated values
      if (str.includes(',')) {
        return str.split(',').map(item => item.trim());
      }

      // Single value
      return [str.trim()];
    } catch {
      // If parsing fails, treat as comma-separated or single value
      if (str.includes(',')) {
        return str.split(',').map(item => item.trim());
      }
      return [str.trim()];
    }
  };

  // Initialize elements from value
  useEffect(() => {
    const newElements = stringToArray(value);
    if (newElements.length === 0) {
      setElements(['']);
    } else {
      setElements(newElements);
    }
    setRawInput(value);
  }, [value]);

  // Update parent when elements change (builder mode)
  useEffect(() => {
    if (inputMode === 'builder') {
      const newValue = arrayToString(elements);
      if (newValue !== value) {
        onChange(newValue);
      }
    }
  }, [elements, inputMode, onChange, value]);

  const handleElementChange = (index: number, newValue: string) => {
    const newElements = [...elements];
    newElements[index] = newValue;
    setElements(newElements);
  };

  const addElement = () => {
    setElements([...elements, '']);
  };

  const removeElement = (index: number) => {
    if (elements.length > 1) {
      const newElements = elements.filter((_, i) => i !== index);
      setElements(newElements);
    }
  };

  const clearAll = () => {
    setElements(['']);
  };

  const handleRawInputChange = (newValue: string) => {
    setRawInput(newValue);
    onChange(newValue);
  };

  const importFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const imported = stringToArray(text);
      setElements(imported.length > 0 ? imported : ['']);
    } catch (error) {
      console.error('Failed to import from clipboard:', error);
    }
  };

  const exportToClipboard = async () => {
    try {
      const exported = arrayToString(elements);
      await navigator.clipboard.writeText(exported);
    } catch (error) {
      console.error('Failed to export to clipboard:', error);
    }
  };

  // Render appropriate input component for element type
  const renderElementInput = (index: number, elementValue: string) => {
    const commonProps = {
      value: elementValue,
      onChange: (newValue: string) => handleElementChange(index, newValue),
      disabled,
      className: "flex-1"
    };

    if (elementInfo.isNumber) {
      return (
        <NumberInput
          {...commonProps}
          type={elementInfo.elementType as any}
          placeholder={`Enter ${elementInfo.elementType} value`}
        />
      );
    }

    if (elementInfo.isAddress) {
      return (
        <AddressInput
          {...commonProps}
          placeholder="Enter address (0x...)"
          showWalletOption={false}
        />
      );
    }

    if (elementInfo.isObjectId) {
      return (
        <ObjectIdInput
          {...commonProps}
          placeholder="Enter object ID (0x...)"
          expectedType={elementInfo.elementType.replace('&', '')}
          network={network}
        />
      );
    }

    if (elementInfo.isBool) {
      return (
        <select
          {...commonProps}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select...</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    // Default to text input
    return (
      <Input
        {...commonProps}
        placeholder={`Enter ${elementInfo.elementType} value`}
      />
    );
  };

  const getExamples = () => {
    switch (elementInfo.elementType) {
      case 'u8':
        return ['[0, 1, 2]', 'b"hello"', '[72, 101, 108, 108, 111]'];
      case 'u64':
        return ['[1000, 2000, 3000]', '[0]', '[18446744073709551615]'];
      case 'address':
        return ['["0x1", "0x2"]', '["0x0000000000000000000000000000000000000000000000000000000000000000"]'];
      case 'bool':
        return ['[true, false]', '[true]', '[false, true, false]'];
      default:
        return ['["item1", "item2"]', '[]'];
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with type info and controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">
            {type}
          </Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                  <Info className="h-3 w-3" />
                  Vector/Array
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-2">
                  <div className="font-semibold">Vector Input</div>
                  <div className="text-xs">
                    <div>• Element type: {elementInfo.elementType}</div>
                    <div>• Dynamic array builder</div>
                    <div>• Supports raw JSON input</div>
                    <div>• Click + to add elements</div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={importFromClipboard}
            title="Import from clipboard"
          >
            <Upload className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={exportToClipboard}
            title="Export to clipboard"
          >
            <Download className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={clearAll}
            title="Clear all"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Input mode tabs */}
      <Tabs value={inputMode} onValueChange={(value) => setInputMode(value as 'builder' | 'raw')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="builder" className="text-xs">
            <List className="h-3 w-3 mr-1" />
            Builder
          </TabsTrigger>
          <TabsTrigger value="raw" className="text-xs">
            <Code className="h-3 w-3 mr-1" />
            Raw Input
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-3">
          {/* Dynamic element builder */}
          <div className="space-y-2">
            {elements.map((element, index) => (
              <div key={index} className="flex items-center gap-2 group">
                <div className="flex items-center text-xs text-muted-foreground w-8">
                  <GripVertical className="h-3 w-3 mr-1" />
                  {index}
                </div>
                
                {renderElementInput(index, element)}
                
                <div className="flex items-center gap-1">
                  {elements.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeElement(index)}
                      title="Remove element"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                  )}
                  
                  {index === elements.length - 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={addElement}
                      title="Add element"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
            <div className="flex items-center justify-between">
              <span>{elements.filter(el => el.trim() !== '').length} element(s)</span>
              <span className="font-mono">{arrayToString(elements)}</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="raw" className="space-y-3">
          {/* Raw JSON/text input */}
          <div className="space-y-2">
            <Textarea
              value={rawInput}
              onChange={(e) => handleRawInputChange(e.target.value)}
              placeholder={placeholder || `Enter ${type} as JSON array or comma-separated values`}
              className="font-mono text-sm min-h-[100px]"
              disabled={disabled}
            />
            
            <div className="text-xs text-muted-foreground">
              Supports JSON arrays, comma-separated values, or byte strings (b"text" for vector&lt;u8&gt;)
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Examples */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Examples for {elementInfo.elementType}:</div>
        <div className="flex flex-wrap gap-1">
          {getExamples().map((example, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs font-mono"
              onClick={() => {
                if (inputMode === 'raw') {
                  handleRawInputChange(example);
                } else {
                  const imported = stringToArray(example);
                  setElements(imported.length > 0 ? imported : ['']);
                }
              }}
              title={`Use example: ${example}`}
            >
              {example}
              <Copy className="h-3 w-3 ml-1" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}