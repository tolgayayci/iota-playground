import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectTemplate } from '@/lib/templates';

interface TemplateCardsProps {
  templates: ProjectTemplate[];
  onUseTemplate: (template: ProjectTemplate) => void;
  onPreviewTemplate: (template: ProjectTemplate) => void;
}

export function TemplateCards({ templates, onUseTemplate, onPreviewTemplate }: TemplateCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {templates.map((template) => {
        const Icon = template.icon;
        
        return (
          <Card
            key={template.id}
            className={cn(
              "group relative overflow-hidden transition-all duration-200",
              "hover:shadow-lg",
              "border"
            )}
          >
            <div className="p-6 space-y-4">
              {/* Icon and Category */}
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-muted">
                  <Icon className="h-6 w-6 text-muted-foreground" />
                </div>
                {template.category && (
                  <Badge variant="secondary" className="text-xs">
                    {template.category}
                  </Badge>
                )}
              </div>
              
              {/* Title and Description */}
              <div className="space-y-2">
                <h3 className="text-base font-semibold">
                  {template.name}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
              </div>

              {/* Action Button */}
              <Button
                size="sm"
                className="w-full"
                onClick={() => onUseTemplate(template)}
              >
                Use Template
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}