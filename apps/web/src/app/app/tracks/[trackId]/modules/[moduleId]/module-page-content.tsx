"use client";

import { PageHeader } from "@/components/app/page-header";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { ModulePlayer } from "@/components/features/module-player";
import { trpc } from "@/lib/trpc/client";

export function ModulePageContent({ trackId, moduleId }: { trackId: string; moduleId: string }) {
  const { data: trackData, isLoading: trackLoading } = trpc.tracks.getById.useQuery({ id: trackId });
  const { data: dbModule, isLoading: moduleLoading } = trpc.modules.getById.useQuery({ id: moduleId });

  const isLoading = trackLoading || moduleLoading;

  if (isLoading || !dbModule) return <SkeletonLoader variant="module" />;

  const moduleForPlayer = {
    id: dbModule.id,
    trackId: dbModule.trackId,
    title: dbModule.title,
    summary: dbModule.content,
    order: dbModule.order,
    estimatedMinutes: 30,
    sourceCode: dbModule.content,
    starterCode: dbModule.content,
    language: "typescript",
    concepts: [],
  };

  return (
    <>
      <PageHeader
        eyebrow={trackData?.title ?? "Track"}
        title={dbModule.title}
        description={dbModule.content}
      />
      <ModulePlayer module={moduleForPlayer} moduleId={moduleId} annotations={[]} quiz={[]} diffLines={[]} />
    </>
  );
}
