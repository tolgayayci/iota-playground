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
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ProjectTemplate } from '@/lib/templates';

interface TemplateCardProps {
  template: ProjectTemplate;
  onUse: () => void;
  onPreview: () => void;
  index: number;
}

const difficultyConfig = {
  beginner: {
    color: 'emerald',
    gradient: 'from-emerald-500 to-green-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    icon: Sparkles,
    label: 'Beginner Friendly'
  },
  intermediate: {
    color: 'amber',
    gradient: 'from-amber-500 to-yellow-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    icon: Zap,
    label: 'Intermediate'
  },
  advanced: {
    color: 'rose',
    gradient: 'from-rose-500 to-red-500',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    text: 'text-rose-600 dark:text-rose-400',
    icon: Award,
    label: 'Advanced'
  }
};

const categoryConfig = {
  defi: {
    gradient: 'from-purple-600 to-indigo-600',
    bg: 'bg-purple-500/10',
    text: 'text-purple-600 dark:text-purple-400',
    label: 'DeFi'
  },
  nft: {
    gradient: 'from-blue-600 to-cyan-600',
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    label: 'NFT'
  },
  token: {
    gradient: 'from-orange-600 to-amber-600',
    bg: 'bg-orange-500/10',
    text: 'text-orange-600 dark:text-orange-400',
    label: 'Token'
  },
  utility: {
    gradient: 'from-teal-600 to-green-600',
    bg: 'bg-teal-500/10',
    text: 'text-teal-600 dark:text-teal-400',
    label: 'Utility'
  },
  game: {
    gradient: 'from-pink-600 to-purple-600',
    bg: 'bg-pink-500/10',
    text: 'text-pink-600 dark:text-pink-400',
    label: 'Gaming'
  }
};

export function TemplateCard({ template, onUse, onPreview, index }: TemplateCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const difficulty = difficultyConfig[template.difficulty];
  const category = template.category ? categoryConfig[template.category] : null;
  const Icon = template.icon;
  const DifficultyIcon = difficulty.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative group"
    >
      <div className={cn(
        "relative bg-card rounded-xl border overflow-hidden",
        "transition-all duration-300",
        "hover:shadow-2xl hover:border-primary/30",
        "dark:hover:shadow-primary/10"
      )}>
        {/* Gradient Header */}
        <div className={cn(
          "relative h-32 bg-gradient-to-br",
          difficulty.gradient,
          "opacity-90"
        )}>
          {/* Animated Pattern Overlay */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0 bg-grid-white/10 bg-grid-16 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
          </div>
          
          {/* Floating Icon */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            animate={{ 
              rotate: isHovered ? 360 : 0,
              scale: isHovered ? 1.1 : 1
            }}
            transition={{ duration: 0.5 }}
          >
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
              <Icon className="h-10 w-10 text-white" />
            </div>
          </motion.div>

          {/* Difficulty Badge */}
          <div className="absolute top-3 right-3">
            <Badge className={cn(
              "backdrop-blur-sm bg-white/90 dark:bg-black/50",
              difficulty.text,
              "border-0 font-semibold px-2 py-1"
            )}>
              <DifficultyIcon className="h-3 w-3 mr-1" />
              {difficulty.label}
            </Badge>
          </div>

          {/* Category Badge */}
          {category && (
            <div className="absolute top-3 left-3">
              <Badge className={cn(
                "backdrop-blur-sm bg-white/90 dark:bg-black/50",
                category.text,
                "border-0 font-semibold px-2 py-1"
              )}>
                {category.label}
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Title and Author */}
          <div className="mb-3">
            <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
              {template.name}
              {template.popularity && template.popularity > 1000 && (
                <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Popular
                </Badge>
              )}
            </h3>
            {template.author && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                by {template.author}
              </p>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {template.description}
          </p>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className={cn(
              "p-2 rounded-lg text-center",
              difficulty.bg,
              difficulty.border,
              "border"
            )}>
              <FileCode className={cn("h-4 w-4 mx-auto mb-1", difficulty.text)} />
              <p className="text-xs font-semibold">{template.linesOfCode}</p>
              <p className="text-[10px] text-muted-foreground">lines</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs font-semibold">{template.estimatedTime}</p>
              <p className="text-[10px] text-muted-foreground">deploy</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs font-semibold">
                {template.popularity ? 
                  template.popularity > 1000 ? 
                    `${(template.popularity / 1000).toFixed(1)}k` : 
                    template.popularity
                  : '0'
                }
              </p>
              <p className="text-[10px] text-muted-foreground">uses</p>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {template.tags.slice(0, 3).map((tag, i) => (
              <Badge 
                key={i} 
                variant="secondary" 
                className="text-[10px] px-2 py-0.5 bg-muted/50"
              >
                #{tag}
              </Badge>
            ))}
            {template.tags.length > 3 && (
              <Badge 
                variant="secondary" 
                className="text-[10px] px-2 py-0.5 bg-muted/50"
              >
                +{template.tags.length - 3}
              </Badge>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={onUse}
              className={cn(
                "flex-1 gap-2 font-semibold transition-all",
                "bg-gradient-to-r", difficulty.gradient,
                "hover:shadow-lg hover:scale-[1.02]",
                "text-white border-0"
              )}
              size="sm"
            >
              <Rocket className="h-4 w-4" />
              Use Template
              <ChevronRight className="h-3 w-3 ml-auto" />
            </Button>
            <Button
              onClick={onPreview}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
          </div>
        </div>

        {/* Hover Effect - Code Preview */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-background/95 to-transparent backdrop-blur-sm"
            >
              <div className="bg-muted/80 rounded-lg p-3 font-mono text-xs">
                <div className="text-muted-foreground mb-1">// {template.name}.move</div>
                <div className="text-primary">module {template.id.replace('-', '_')}::{template.id.replace('-', '_')} {'{'}</div>
                <div className="text-muted-foreground ml-4">...</div>
                <div className="text-primary">{'}'}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}