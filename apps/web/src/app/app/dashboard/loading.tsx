import { Skeleton, SkeletonCard, SkeletonStatCard } from "@/components/app/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* PageHeader skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Stat cards row */}
      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Main content + streak tracker */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Radar chart + leaderboard */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
