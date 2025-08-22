import { Code2 } from 'lucide-react';

interface ModuleEmptyStateProps {
  title?: string;
  description?: string;
}

export function ModuleEmptyState({ 
  title = "No Module Deployments", 
  description = "Deploy your Move package to IOTA to start interacting with its functions" 
}: ModuleEmptyStateProps = {}) {
  return (
    <div className="h-full flex items-center justify-center bg-muted/40">
      <div className="text-center">
        <div className="inline-flex p-3 bg-primary/10 rounded-lg mb-6">
          <Code2 className="h-6 w-6 text-primary animate-pulse" />
        </div>
        <h3 className="font-medium mb-3">{title}</h3>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}