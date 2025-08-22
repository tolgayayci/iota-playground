import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Copy,
  Check,
  FileCode,
  Clock,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectTemplate } from '@/lib/templates';

interface TemplatePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ProjectTemplate | null;
  onUse: () => void;
}

export function TemplatePreview({ open, onOpenChange, template, onUse }: TemplatePreviewProps) {
  const [copied, setCopied] = useState(false);

  if (!template) return null;

  const Icon = template.icon;

  const handleCopy = () => {
    navigator.clipboard.writeText(template.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <DialogTitle className="text-xl font-semibold">
                  {template.name}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {template.description}
                </DialogDescription>
              </div>
            </div>
          </div>
          
          {/* Meta Information */}
          <div className="flex items-center gap-4 mt-4 text-sm">
            <Badge variant="outline" className="font-normal">
              {template.difficulty}
            </Badge>
            {template.linesOfCode && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <FileCode className="h-3.5 w-3.5" />
                <span>{template.linesOfCode} lines</span>
              </div>
            )}
            {template.estimatedTime && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{template.estimatedTime}</span>
              </div>
            )}
            {template.author && (
              <span className="text-muted-foreground">
                by {template.author}
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Code Preview */}
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="relative">
            <div className="absolute top-2 right-2 z-10">
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto">
              <code className="text-sm font-mono">
                {template.code}
              </code>
            </pre>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
          <div className="flex flex-wrap gap-1.5">
            {template.tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs font-normal">
                {tag}
              </Badge>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onUse} className="gap-2">
              Use Template
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}