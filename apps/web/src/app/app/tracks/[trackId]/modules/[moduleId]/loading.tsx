import { Skeleton, SkeletonCard } from "@/components/app/skeleton";

export default function ModuleLoading() {
  return (
    <div className="space-y-6">
      {/* PageHeader skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Module player skeleton */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    </div>
  );
}
