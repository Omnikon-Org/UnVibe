import { Skeleton, SkeletonCard } from "@/components/app/skeleton";

export default function BlindspotMapLoading() {
  return (
    <div role="status" aria-label="Page content is loading" className="space-y-6">
      {/* PageHeader skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Blindspot cards skeleton */}
      <div className="grid gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}
