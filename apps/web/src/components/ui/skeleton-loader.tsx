import { Skeleton, SkeletonCard, SkeletonStatCard, SkeletonList } from "@/components/app/skeleton";

type SkeletonVariant = "dashboard" | "tracks" | "war-room" | "module" | "default";

interface SkeletonLoaderProps {
  variant?: SkeletonVariant;
  className?: string;
}

/** Dashboard skeleton — header + stat cards + content grid */
function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Page content is loading" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/** Tracks skeleton — header + 3-column card grid */
function TracksSkeleton() {
  return (
    <div role="status" aria-label="Page content is loading" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/** War Room skeleton — header + message area + leaderboard */
function WarRoomSkeleton() {
  return (
    <div role="status" aria-label="Page content is loading" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <SkeletonCard />
        <div className="space-y-3">
          <Skeleton className="h-5 w-24" />
          <SkeletonList count={5} />
        </div>
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/** Module player skeleton — header + player area */
function ModuleSkeleton() {
  return (
    <div role="status" aria-label="Page content is loading" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/** Generic skeleton — animated placeholder bars */
function DefaultSkeleton() {
  return (
    <div role="status" aria-label="Page content is loading" className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-48" />
      </div>
      <SkeletonCard />
      <SkeletonCard />
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/**
 * SkeletonLoader — page-level loading skeleton.
 * Use `variant` to match the target page layout.
 * Falls back to a generic multi-card skeleton if no variant is specified.
 */
export function SkeletonLoader({ variant = "default", className = "" }: SkeletonLoaderProps) {
  const content = {
    dashboard: <DashboardSkeleton />,
    tracks: <TracksSkeleton />,
    "war-room": <WarRoomSkeleton />,
    module: <ModuleSkeleton />,
    default: <DefaultSkeleton />,
  }[variant];

  return <div className={className}>{content}</div>;
}
