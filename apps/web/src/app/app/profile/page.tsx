"use client";

import { PageHeader } from "@/components/app/page-header";
import { LoadingPanel } from "@/components/app/loading-panel";
import { IRSRadarChart } from "@/components/features/irs-radar-chart";
import { StreakTracker } from "@/components/features/streak-tracker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";

export default function ProfilePage() {
  const { data: profile, isLoading: profileLoading, isError: profileError, error: profileErrorObj } =
    trpc.profile.getProfile.useQuery();
  const { data: recentData, isLoading: recentLoading, isError: recentError, error: recentErrorObj } =
    trpc.profile.getRecent.useQuery({ limit: 5 });
  const { data: stats, isLoading: statsLoading, isError: statsError, error: statsErrorObj } =
    trpc.profile.getStats.useQuery();

  const isLoading = profileLoading || recentLoading || statsLoading;
  const isError = profileError || recentError || statsError;
  const firstError = profileErrorObj || recentErrorObj || statsErrorObj;

  if (isError) return <p>Something went wrong: {firstError?.message}</p>;
  if (isLoading) return <LoadingPanel label="Loading profile" />;
  if (!profile) return <p>No data found.</p>;

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
