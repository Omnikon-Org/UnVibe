"use client";

import { PageHeader } from "@/components/app/page-header";
import { LoadingPanel } from "@/components/app/loading-panel";
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

  if (isError) return <p>Something went wrong: {firstError?.message}</p>;
  if (isLoading) return <LoadingPanel label="Joining War Room" />;
  if (!room) return <p>No data found.</p>;

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
