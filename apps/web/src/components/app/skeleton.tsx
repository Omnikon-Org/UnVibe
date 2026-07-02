import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Base skeleton block with animate-pulse */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-primary/20 ${className}`} />;
}

/** Multiline text skeleton */
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? "w-3/4" : "w-full"}`} />
      ))}
    </div>
  );
}

/** Card-shaped skeleton */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

/** Stat card skeleton — icon + big number + label */
export function SkeletonStatCard({ className = "" }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20" />
        <Skeleton className="mt-1 h-3 w-24" />
      </CardContent>
    </Card>
  );
}

/** List item skeleton — icon + two text lines */
export function SkeletonList({ count = 3, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-md border border-border bg-background/60 p-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
