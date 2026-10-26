import { cn } from "@/lib/utils";

interface SkeletonShimmerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'circular' | 'text' | 'card';
}

function SkeletonShimmer({
  className,
  variant = 'default',
  ...props
}: SkeletonShimmerProps) {
  const baseClasses = "animate-shimmer bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%]";
  
  const variantClasses = {
    default: "rounded-md",
    circular: "rounded-full",
    text: "rounded h-4 w-full",
    card: "rounded-2xl",
  };

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

// Story skeleton for StoriesBar
function StorySkeleton() {
  return (
    <div className="flex flex-col items-center gap-1">
      <SkeletonShimmer variant="circular" className="w-16 h-16" />
      <SkeletonShimmer variant="text" className="w-12 h-3" />
    </div>
  );
}

// Post card skeleton
function PostCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <SkeletonShimmer variant="circular" className="w-9 h-9" />
        <div className="flex-1 space-y-1.5">
          <SkeletonShimmer variant="text" className="w-24 h-3.5" />
          <SkeletonShimmer variant="text" className="w-16 h-2.5" />
        </div>
      </div>
      
      {/* Content */}
      <div className="space-y-2">
        <SkeletonShimmer variant="text" className="w-full h-3.5" />
        <SkeletonShimmer variant="text" className="w-4/5 h-3.5" />
        <SkeletonShimmer variant="text" className="w-2/3 h-3.5" />
      </div>
      
      {/* Image placeholder */}
      <SkeletonShimmer variant="card" className="w-full h-48" />
      
      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <SkeletonShimmer className="flex-1 h-8 rounded-lg" />
        <SkeletonShimmer className="flex-1 h-8 rounded-lg" />
        <SkeletonShimmer className="flex-1 h-8 rounded-lg" />
      </div>
    </div>
  );
}

// Tool card skeleton for ToolsHub
function ToolCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
      <SkeletonShimmer variant="circular" className="w-12 h-12" />
      <SkeletonShimmer variant="text" className="w-3/4 h-4" />
      <SkeletonShimmer variant="text" className="w-1/2 h-3" />
    </div>
  );
}

// Dashboard stat card skeleton
function StatCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <SkeletonShimmer variant="circular" className="w-8 h-8" />
        <SkeletonShimmer variant="text" className="w-16 h-4" />
      </div>
      <SkeletonShimmer variant="text" className="w-12 h-6" />
    </div>
  );
}

// Profile header skeleton
function ProfileHeaderSkeleton() {
  return (
    <div className="gradient-primary rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <SkeletonShimmer variant="circular" className="w-14 h-14 bg-white/20" />
        <div className="flex-1 space-y-2">
          <SkeletonShimmer variant="text" className="w-32 h-5 bg-white/20" />
          <SkeletonShimmer variant="text" className="w-48 h-3.5 bg-white/20" />
        </div>
      </div>
    </div>
  );
}

export {
  SkeletonShimmer,
  StorySkeleton,
  PostCardSkeleton,
  ToolCardSkeleton,
  StatCardSkeleton,
  ProfileHeaderSkeleton,
};
