import { Skeleton, SkeletonCard } from "@/components/app/skeleton";

export default function ProfileLoading() {
  return (
    <div className="space-y-6">
      {/* PageHeader skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Radar chart + streak tracker */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
