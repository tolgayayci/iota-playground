import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Code2, 
  Clock, 
  TrendingUp, 
  Users, 
  Sparkles,
  Eye,
  Rocket,
  FileCode,
  Zap,
  Award,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ProjectTemplate } from '@/lib/templates';

interface TemplateRowProps {
  template: ProjectTemplate;
  onUse: () => void;
  onPreview: () => void;
  index: number;
}

const difficultyConfig = {
  beginner: {
    color: 'emerald',
    bg: 'bg-gradient-to-r from-emerald-500 to-green-500',
    lightBg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    icon: Sparkles,
    label: 'Beginner'
  },
  intermediate: {
    color: 'amber',
    bg: 'bg-gradient-to-r from-amber-500 to-yellow-500',
    lightBg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    icon: Zap,
    label: 'Intermediate'
  },
  advanced: {
    color: 'rose',
    bg: 'bg-gradient-to-r from-rose-500 to-red-500',
    lightBg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    text: 'text-rose-600 dark:text-rose-400',
    icon: Award,
    label: 'Advanced'
  }
};

const categoryConfig = {
  defi: { label: 'DeFi', color: 'purple' },
  nft: { label: 'NFT', color: 'blue' },
  token: { label: 'Token', color: 'orange' },
  utility: { label: 'Utility', color: 'teal' },
  game: { label: 'Gaming', color: 'pink' }
};

export function TemplateRow({ template, onUse, onPreview, index }: TemplateRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const difficulty = difficultyConfig[template.difficulty];
  const category = template.category ? categoryConfig[template.category] : null;
  const Icon = template.icon;
  const DifficultyIcon = difficulty.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <div className={cn(
        "group relative bg-card rounded-xl border overflow-hidden",
        "transition-all duration-300",
        "hover:shadow-lg hover:border-primary/30",
        "dark:hover:shadow-primary/5"
      )}>
        {/* Difficulty Indicator Strip */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-1",
          difficulty.bg
        )} />

        {/* Main Row Content */}
        <div className="flex items-center p-4 gap-4">
          {/* Icon Container */}
          <motion.div
            animate={{ rotate: isHovered ? 360 : 0 }}
            transition={{ duration: 0.5 }}
            className={cn(
              "flex-shrink-0 p-3 rounded-xl",
              difficulty.lightBg,
              difficulty.border,
              "border"
            )}
          >
            <Icon className={cn("h-6 w-6", difficulty.text)} />
          </motion.div>

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">
                    {template.name}
                  </h3>
                  <Badge className={cn(
                    "text-xs",
                    difficulty.lightBg,
                    difficulty.text,
                    difficulty.border,
                    "border"
                  )}>
                    <DifficultyIcon className="h-3 w-3 mr-1" />
                    {difficulty.label}
                  </Badge>
                  {category && (
                    <Badge variant="outline" className="text-xs">
                      {category.label}
                    </Badge>
                  )}
                  {template.popularity && template.popularity > 1000 && (
                    <Badge className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Popular
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {template.description}
                </p>
              </div>
            </div>

            {/* Stats and Tags Row */}
            <div className="flex items-center gap-6 mt-3">
              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FileCode className="h-3.5 w-3.5" />
                  <span className="font-medium">{template.linesOfCode} lines</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="font-medium">{template.estimatedTime}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  <span className="font-medium">
                    {template.popularity ? 
                      template.popularity > 1000 ? 
                        `${(template.popularity / 1000).toFixed(1)}k uses` : 
                        `${template.popularity} uses`
                      : '0 uses'
                    }
                  </span>
                </div>
                {template.author && (
                  <div className="flex items-center gap-1">
                    <span>by {template.author}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="flex items-center gap-1.5">
                {template.tags.slice(0, 2).map((tag, i) => (
                  <Badge 
                    key={i} 
                    variant="secondary" 
                    className="text-[10px] px-2 py-0.5"
                  >
                    {tag}
                  </Badge>
                ))}
                {template.tags.length > 2 && (
                  <Badge 
                    variant="secondary" 
                    className="text-[10px] px-2 py-0.5"
                  >
                    +{template.tags.length - 2}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={onPreview}
              variant="ghost"
              size="sm"
              className="gap-1.5"
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button
              onClick={onUse}
              className={cn(
                "gap-2 font-semibold",
                difficulty.bg,
                "text-white border-0",
                "hover:shadow-lg hover:scale-[1.02]"
              )}
              size="sm"
            >
              <Rocket className="h-4 w-4" />
              Use Template
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              variant="ghost"
              size="icon"
              className="ml-2"
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            </Button>
          </div>
        </div>

        {/* Expandable Code Preview */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="border-t bg-muted/30"
            >
              <div className="p-4">
                <div className="bg-background/50 rounded-lg p-4 font-mono text-xs max-h-48 overflow-y-auto">
                  <div className="text-muted-foreground mb-2">// {template.name}.move</div>
                  <pre className="text-sm">
                    <code>{template.code.slice(0, 500)}...</code>
                  </pre>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex gap-2">
                    {template.tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    onClick={onPreview}
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                  >
                    <Code2 className="h-4 w-4" />
                    View Full Code
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}