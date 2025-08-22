import { cn } from '@/lib/utils';

interface TemplateSkeletonProps {
  view?: 'grid' | 'list';
  count?: number;
}

export function TemplateSkeleton({ view = 'grid', count = 6 }: TemplateSkeletonProps) {
  if (view === 'list') {
    return (
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="relative bg-card rounded-xl border overflow-hidden"
          >
            {/* Difficulty strip skeleton */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-muted to-muted/50" />
            
            <div className="flex items-center p-4 gap-4">
              {/* Icon skeleton */}
              <div className="flex-shrink-0 p-3 rounded-xl bg-muted animate-pulse">
                <div className="h-6 w-6 bg-muted-foreground/20 rounded" />
              </div>

              {/* Content skeleton */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
                  <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
                </div>
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                <div className="flex items-center gap-4">
                  <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                </div>
              </div>

              {/* Action buttons skeleton */}
              <div className="flex items-center gap-2">
                <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
                <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative bg-card rounded-xl border overflow-hidden"
        >
          {/* Header skeleton */}
          <div className="h-32 bg-gradient-to-br from-muted to-muted/50 animate-pulse">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl">
                <div className="h-10 w-10 bg-white/20 rounded" />
              </div>
            </div>
            <div className="absolute top-3 right-3">
              <div className="h-6 w-24 bg-white/20 rounded-full" />
            </div>
          </div>

          {/* Content skeleton */}
          <div className="p-6 space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
              <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-4/5 bg-muted animate-pulse rounded" />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="p-2 rounded-lg bg-muted/50">
                  <div className="h-4 w-4 mx-auto mb-1 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-8 mx-auto mb-1 bg-muted animate-pulse rounded" />
                  <div className="h-2 w-12 mx-auto bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>

            {/* Tags */}
            <div className="flex gap-1.5">
              <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
              <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
              <div className="h-5 w-12 bg-muted animate-pulse rounded-full" />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <div className="flex-1 h-9 bg-muted animate-pulse rounded-md" />
              <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TemplateSkeletonSingle() {
  return (
    <div className="relative bg-card rounded-xl border overflow-hidden">
      <div className="h-32 bg-gradient-to-br from-muted to-muted/50 animate-pulse" />
      <div className="p-6 space-y-4">
        <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
        <div className="h-4 w-full bg-muted animate-pulse rounded" />
        <div className="h-4 w-4/5 bg-muted animate-pulse rounded" />
        <div className="flex gap-2">
          <div className="flex-1 h-9 bg-muted animate-pulse rounded-md" />
          <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
        </div>
      </div>
    </div>
  );
}