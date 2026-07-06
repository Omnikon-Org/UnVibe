"use client";

import { trpc } from "./client";

/**
 * tRPC-powered query hooks that parallel the original mock-data hooks.
 */

export function useDashboardData() {
  return trpc.tracks.getAll.useQuery();
}

export function useTracksData() {
  return trpc.tracks.getAll.useQuery();
}

export function useModuleData(
  _trackId: string,
  moduleId: string,
) {
  return trpc.modules.getById.useQuery({ id: moduleId });
}

export function useWarRoomData() {
  return trpc.warRoom.getRoom.useQuery();
}

export function useProfileData() {
  return trpc.profile.getProfile.useQuery();
}

export function useBlindspotsData() {
  return trpc.irs.getBlindspots.useQuery();
}
