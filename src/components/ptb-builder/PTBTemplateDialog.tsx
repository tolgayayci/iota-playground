import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Coins,
  Send,
  ArrowRightLeft,
  Clock,
  Package,
  BookOpen,
} from 'lucide-react';
import { PTBCommand } from '@/components/views/PTBBuilderV3';

interface PTBTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (commands: PTBCommand[]) => void;
}

interface PTBTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  commands: Omit<PTBCommand, 'id'>[];
  category: 'basic' | 'defi' | 'nft' | 'advanced';
}

const templates: PTBTemplate[] = [
  // Essential working examples covering all command types
  {
    id: 'simple-transfer',
    name: 'Simple Transfer',
    description: 'Split and transfer IOTA',
    icon: <Send className="h-4 w-4 text-blue-600" />,
    category: 'basic',
    commands: [
      {
        type: 'SplitCoins',
        description: 'Split 0.1 IOTA from gas',
        coin: { type: 'gas', value: 'gas' },
        amounts: [
          { type: 'input', value: '100000000' }, // 0.1 IOTA
        ],
      },
      {
        type: 'TransferObjects',
        description: 'Transfer to recipient',
        objects: [{ type: 'result', value: 'Result(0)', resultFrom: 0 }],
        recipient: { type: 'input', value: '0x0000000000000000000000000000000000000000000000000000000000000002' }, // Replace with actual recipient
      },
    ],
  },
  {
    id: 'multi-transfer',
    name: 'Multi Transfer',
    description: 'Send to multiple recipients',
    icon: <Coins className="h-4 w-4 text-green-600" />,
    category: 'basic',
    commands: [
      {
        type: 'SplitCoins',
        description: 'Split into 3 amounts',
        coin: { type: 'gas', value: 'gas' },
        amounts: [
          { type: 'input', value: '50000000' },  // 0.05 IOTA
          { type: 'input', value: '100000000' }, // 0.1 IOTA
          { type: 'input', value: '150000000' }, // 0.15 IOTA
        ],
      },
      {
        type: 'TransferObjects',
        description: 'Send to recipient 1',
        objects: [{ type: 'result', value: 'Result(0)[0]', resultFrom: 0, resultIndex: 0 }],
        recipient: { type: 'input', value: '0x0000000000000000000000000000000000000000000000000000000000000002' },
      },
      {
        type: 'TransferObjects',
        description: 'Send to recipient 2',
        objects: [{ type: 'result', value: 'Result(0)[1]', resultFrom: 0, resultIndex: 1 }],
        recipient: { type: 'input', value: '0x0000000000000000000000000000000000000000000000000000000000000003' },
      },
      {
        type: 'TransferObjects',
        description: 'Send to recipient 3',
        objects: [{ type: 'result', value: 'Result(0)[2]', resultFrom: 0, resultIndex: 2 }],
        recipient: { type: 'input', value: '0x0000000000000000000000000000000000000000000000000000000000000004' },
      },
    ],
  },
  {
    id: 'merge-coins',
    name: 'Merge Coins',
    description: 'Combine multiple coins',
    icon: <ArrowRightLeft className="h-4 w-4 text-orange-600" />,
    category: 'basic',
    commands: [
      {
        type: 'MergeCoins',
        description: 'Merge coins together',
        destination: { type: 'object', value: '' }, // Destination coin
        sources: [
          { type: 'object', value: '' }, // Source 1
          { type: 'object', value: '' }, // Source 2
        ],
      },
    ],
  },
  {
    id: 'get-timestamp',
    name: 'Get Timestamp',
    description: 'Read blockchain time',
    icon: <Clock className="h-4 w-4 text-cyan-600" />,
    category: 'advanced',
    commands: [
      {
        type: 'MoveCall',
        description: 'Get current timestamp',
        target: '0x2::clock::timestamp_ms',
        module: 'clock',
        function: 'timestamp_ms',
        arguments: [
          { type: 'object', value: '0x6' }, // System clock
        ],
        typeArguments: [],
      },
    ],
  },
  {
    id: 'mint-nft',
    name: 'Mint NFT',
    description: 'Create devnet NFT',
    icon: <Package className="h-4 w-4 text-purple-600" />,
    category: 'nft',
    commands: [
      {
        type: 'MoveCall',
        description: 'Mint NFT on devnet',
        target: '0x2::devnet_nft::mint',
        module: 'devnet_nft',
        function: 'mint',
        arguments: [
          { type: 'input', value: 'My NFT' },
          { type: 'input', value: 'Test NFT' },
          { type: 'input', value: 'https://example.com/nft.png' },
        ],
        typeArguments: [],
      },
    ],
  },
];

export function PTBTemplateDialog({
  open,
  onOpenChange,
  onApply,
}: PTBTemplateDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<PTBTemplate | null>(null);

  const handleApply = () => {
    if (selectedTemplate) {
      onApply(selectedTemplate.commands as PTBCommand[]);
      setSelectedTemplate(null);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'basic':
        return 'bg-blue-500/5 text-blue-600 border-blue-200/50';
      case 'defi':
        return 'bg-green-500/5 text-green-600 border-green-200/50';
      case 'nft':
        return 'bg-purple-500/5 text-purple-600 border-purple-200/50';
      case 'advanced':
        return 'bg-orange-500/5 text-orange-600 border-orange-200/50';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            PTB Templates
          </DialogTitle>
          <DialogDescription>
            Select a template to quickly set up common PTB patterns
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[450px] overflow-x-hidden">
          <div className="space-y-3 pr-4">
            {templates.map((template) => (
                <div 
                  key={template.id}
                  className={`
                    relative cursor-pointer transition-all rounded-lg p-4 overflow-hidden
                    ${selectedTemplate?.id === template.id 
                      ? 'bg-primary/10 ring-2 ring-primary/30 ring-inset' 
                      : 'bg-muted/20 hover:bg-muted/40 border border-border/50'
                    }
                  `}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      template.id === 'simple-transfer' ? 'bg-blue-500/10' :
                      template.id === 'multi-transfer' ? 'bg-green-500/10' :
                      template.id === 'merge-coins' ? 'bg-orange-500/10' :
                      template.id === 'get-timestamp' ? 'bg-cyan-500/10' :
                      template.id === 'mint-nft' ? 'bg-purple-500/10' :
                      'bg-muted'
                    }`}>
                      {template.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-3">
                        <h4 className="font-semibold text-sm mb-1">
                          {template.name}
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {template.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">Commands:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {template.commands.map((cmd, idx) => (
                            <Badge key={idx} variant="outline" className="text-[11px] px-2 py-0 font-mono">
                              {cmd.type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleApply}
            disabled={!selectedTemplate}
          >
            Apply Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}