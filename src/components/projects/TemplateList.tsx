import { useState, useMemo } from 'react';
import { PROJECT_TEMPLATES } from '@/lib/templates';
import { TemplateCards } from '@/components/templates/TemplateCards';
import { TemplatePreview } from '@/components/templates/TemplatePreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search,
  Filter,
  Sparkles
} from 'lucide-react';
import { SortOption } from './ProjectTabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TemplateListProps {
  searchQuery: string;
  onUseTemplate: (template: any) => void;
  isLoading?: boolean;
  sortBy?: SortOption['value'];
}

export function TemplateList({ 
  searchQuery, 
  onUseTemplate, 
  isLoading,
  sortBy = 'name_asc'
}: TemplateListProps) {
  const [previewTemplate, setPreviewTemplate] = useState<typeof PROJECT_TEMPLATES[0] | null>(null);
  const { toast } = useToast();

  const handleUseTemplate = (template: typeof PROJECT_TEMPLATES[0]) => {
    if (!template.code) {
      toast({
        title: "Error",
        description: "Template code is missing",
        variant: "destructive",
      });
      return;
    }

    onUseTemplate({
      name: template.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      description: template.description,
      template: template,
    });

    toast({
      title: "Template Applied",
      description: `${template.name} has been loaded into your project.`,
    });
  };

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let templates = [...PROJECT_TEMPLATES];

    // Apply search filter
    if (searchQuery) {
      templates = templates.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply sorting
    templates.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'created_desc':
          // Sort by popularity as proxy
          return (b.popularity || 0) - (a.popularity || 0);
        case 'created_asc':
          return (a.popularity || 0) - (b.popularity || 0);
        default:
          return 0;
      }
    });

    return templates;
  }, [searchQuery, sortBy]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Templates Table/List */}
      {filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border rounded-lg bg-muted/10">
          <div className="p-3 rounded-full bg-muted mb-4">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-lg mb-1">No templates found</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            {searchQuery
              ? "Try adjusting your search terms"
              : "No templates are currently available"}
          </p>
        </div>
      ) : (
        <TemplateCards
          templates={filteredTemplates}
          onUseTemplate={handleUseTemplate}
          onPreviewTemplate={setPreviewTemplate}
        />
      )}

      {/* Template Preview Modal */}
      <TemplatePreview
        open={previewTemplate !== null}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
        template={previewTemplate}
        onUse={() => {
          if (previewTemplate) {
            handleUseTemplate(previewTemplate);
            setPreviewTemplate(null);
          }
        }}
      />
    </div>
  );
}