import { Skeleton, SkeletonCard, SkeletonList } from "@/components/app/skeleton";

export default function WarRoomLoading() {
  return (
    <div role="status" aria-label="Page content is loading" className="space-y-6">
      {/* PageHeader skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* War room live skeleton */}
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
