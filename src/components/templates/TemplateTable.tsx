import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, Code2, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectTemplate } from '@/lib/templates';

interface TemplateTableProps {
  templates: ProjectTemplate[];
  onUseTemplate: (template: ProjectTemplate) => void;
  onPreviewTemplate: (template: ProjectTemplate) => void;
}

export function TemplateTable({ templates, onUseTemplate, onPreviewTemplate }: TemplateTableProps) {
  return (
    <div className="w-full space-y-3">
      {templates.map((template) => {
        const Icon = template.icon;
        
        return (
          <div
            key={template.id}
            className={cn(
              "group flex items-center justify-between p-4 rounded-lg border-2 bg-card",
              "hover:bg-accent/50 transition-colors duration-200"
            )}
          >
            {/* Left Section: Icon, Name, Description */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {/* Icon */}
              <div className="flex-shrink-0">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              
              {/* Name and Description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <h3 className="font-medium text-sm">
                    {template.name}
                  </h3>
                  <span className="text-muted-foreground text-sm">
                    {template.description}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Section: Badges and Button */}
            <div className="flex items-center gap-3 ml-4">
              {/* Difficulty Badge */}
              <Badge variant="outline" className="text-xs font-normal">
                {template.difficulty}
              </Badge>
              
              {/* Lines of Code */}
              {template.linesOfCode && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileCode className="h-3 w-3" />
                  <span>{template.linesOfCode} lines</span>
                </div>
              )}
              
              {/* Time Estimate */}
              {template.estimatedTime && (
                <Badge variant="secondary" className="text-xs font-normal">
                  {template.estimatedTime}
                </Badge>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPreviewTemplate(template)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Preview
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUseTemplate(template)}
                  className={cn(
                    "gap-1 text-xs",
                    "group-hover:bg-primary group-hover:text-primary-foreground"
                  )}
                >
                  Use Template
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}