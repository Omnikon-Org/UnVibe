"use client";

import { PageHeader } from "@/components/app/page-header";
import { IRSRadarChart } from "@/components/features/irs-radar-chart";
import { StreakTracker } from "@/components/features/streak-tracker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";

export default function ProfilePage() {
  const { data: profile, isLoading: profileLoading, isError: profileError } =
    trpc.profile.getProfile.useQuery();
  const { data: recentData, isLoading: recentLoading, isError: recentError } =
    trpc.profile.getRecent.useQuery({ limit: 5 });
  const { data: stats, isLoading: statsLoading, isError: statsError } =
    trpc.profile.getStats.useQuery();

  const isLoading = profileLoading || recentLoading || statsLoading;
  const isError = profileError || recentError || statsError;

  if (isError) return (
    <div role="alert" className="rounded-md bg-destructive/10 p-6 text-center">
      <p className="font-medium text-destructive">Failed to load content</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Please try refreshing the page. If the issue persists, contact support.
      </p>
    </div>
  );
  if (isLoading) return (
    <div role="status" aria-label="Loading profile" className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="h-64 animate-pulse rounded-lg bg-primary/10" />
        <div className="h-64 animate-pulse rounded-lg bg-primary/10" />
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
  if (!profile) return (
    <div role="status" className="rounded-md bg-muted/10 p-6 text-center">
      <p className="font-medium text-muted-foreground">Profile data is not available yet.</p>
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="profile"
        title={profile.name}
        description={profile.email ?? ""}
        action={<Badge>IRS {profile.irs}</Badge>}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <IRSRadarChart data={[]} />
        <StreakTracker streak={stats?.currentStreak ?? 0} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Session display</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Name: {profile.name}</p>
            <p>Email: {profile.email}</p>
            <p>Completed modules: {profile.completedModules}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent modules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentData?.map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-background/60 p-3 text-sm">
                {item.moduleTitle}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
