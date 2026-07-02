"use client";

import Link from "next/link";
import { ArrowRight, Clock, Target, Trophy } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc/client";
import { IRSRadarChart } from "@/components/features/irs-radar-chart";
import { Leaderboard } from "@/components/features/leaderboard";
import { StreakTracker } from "@/components/features/streak-tracker";

export default function DashboardPage() {
  const { data: profile, isLoading: profileLoading, isError: profileError } =
    trpc.profile.getProfile.useQuery();
  const { data: tracks, isLoading: tracksLoading, isError: tracksError } =
    trpc.tracks.getAll.useQuery();
  const { data: leaderboard, isLoading: leaderboardLoading, isError: leaderboardError } =
    trpc.warRoom.getLeaderboard.useQuery();
  const { data: stats, isLoading: statsLoading, isError: statsError } =
    trpc.profile.getStats.useQuery();

  const isLoading = profileLoading || tracksLoading || leaderboardLoading || statsLoading;
  const isError = profileError || tracksError || leaderboardError || statsError;

  if (isError) return (
    <div role="alert" className="rounded-md bg-destructive/10 p-6 text-center">
      <p className="font-medium text-destructive">Failed to load content</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Please try refreshing the page. If the issue persists, contact support.
      </p>
    </div>
  );
  if (isLoading) return (
    <div role="status" aria-label="Loading dashboard" className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-primary/10" />
        ))}
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
  if (!profile || !tracks || !leaderboard || !stats) return (
    <div role="status" className="rounded-md bg-muted/10 p-6 text-center">
      <p className="font-medium text-muted-foreground">Complete your first module to see stats here</p>
    </div>
  );

  const activeTrack = tracks?.[0] ?? null;
  const userRank = leaderboard?.findIndex((entry) => entry.userId === profile?.id) ?? -1;
  const rankDisplay = userRank >= 0 ? `#${userRank + 1}` : "--";

  const leaderboardEntries = (leaderboard ?? []).map((entry) => ({
    id: entry.userId,
    name: entry.name,
    score: entry.score,
    streak: 0,
    track: "",
  }));

  return (
    <>
      <PageHeader
        eyebrow="dashboard"
        title="Training status"
        description="Mock data mirrors the future API shape while the backend catches up."
        action={
          <Button asChild>
            <Link
              href={
                activeTrack?.modules?.[0]
                  ? `/app/tracks/${activeTrack.id}/modules/${activeTrack.modules[0].id}`
                  : "/app/tracks"
              }
            >
              {activeTrack?.modules?.[0] ? "Resume module" : "Browse tracks"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              IRS <Trophy className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{profile?.irs ?? 0}</p>
            <p className="mt-1 text-sm text-muted-foreground">Irreplaceability score</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Rank <Target className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{rankDisplay}</p>
            <p className="mt-1 text-sm text-muted-foreground">War Room placement</p>
          </CardContent>
        </Card>
        <div className="col-span-full mt-1 sm:col-span-1 sm:mt-0">
          <Card className="border-accent/40 bg-accent/[0.03]">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Next <Clock className="h-4 w-4 text-accent" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">34m</p>
              <p className="mt-1 text-sm text-muted-foreground">Estimated module time</p>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{activeTrack?.title ?? "No active track"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">{activeTrack?.description ?? ""}</p>
            {activeTrack ? <Progress value={0} /> : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {activeTrack?.modules?.map((module) => (
                <Link
                  key={module.id}
                  href={`/app/tracks/${activeTrack.id}/modules/${module.id}`}
                  className="rounded-md border border-border bg-background/60 p-4 transition hover:border-primary/60"
                >
                  <p className="font-medium">{module.title}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
        <StreakTracker streak={stats?.currentStreak ?? 0} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <IRSRadarChart data={[]} />
        <Leaderboard entries={leaderboardEntries} />
      </div>
    </>
  );
}
