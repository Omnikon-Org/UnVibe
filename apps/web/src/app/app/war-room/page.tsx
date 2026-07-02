"use client";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { WarRoomLive } from "@/components/features/war-room-live";
import { trpc } from "@/lib/trpc/client";

export default function WarRoomPage() {
  const { data: room, isLoading: roomLoading, isError: roomError, error: roomErrorObj } =
    trpc.warRoom.getRoom.useQuery();
  const { data: leaderboard, isLoading: leaderboardLoading, isError: leaderboardError, error: leaderboardErrorObj } =
    trpc.warRoom.getLeaderboard.useQuery();

  const isLoading = roomLoading || leaderboardLoading;
  const isError = roomError || leaderboardError;
  const firstError = roomErrorObj || leaderboardErrorObj;

  if (isError) return (
    <div role="alert" className="rounded-md bg-destructive/10 p-6 text-center">
      <p className="font-medium text-destructive">Failed to load content</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Please try refreshing the page. If the issue persists, contact support.
      </p>
    </div>
  );
  if (isLoading) return (
    <div role="status" aria-label="Loading war room" className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="h-64 animate-pulse rounded-lg bg-primary/10" />
        <div className="h-64 animate-pulse rounded-lg bg-primary/10" />
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
  if (!room) return (
    <div role="status" className="rounded-md bg-muted/10 p-6 text-center">
      <p className="font-medium text-muted-foreground">No war room data available yet.</p>
    </div>
  );

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
        eyebrow="war room"
        title={room.name}
        description="Socket.io client wiring is present with a mock live feed so the room works without backend events."
        action={<Badge variant="success">Live</Badge>}
      />
      <WarRoomLive messages={[]} leaderboard={leaderboardEntries} />
    </>
  );
}
