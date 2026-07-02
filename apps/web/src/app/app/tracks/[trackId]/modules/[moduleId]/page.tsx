"use client";

import { PageHeader } from "@/components/app/page-header";
import { LoadingPanel } from "@/components/app/loading-panel";
import { ModulePlayer } from "@/components/features/module-player";
import { trpc } from "@/lib/trpc/client";

export default function ModulePage({ params }: { params: { trackId: string; moduleId: string } }) {
  const { data: trackData, isLoading: trackLoading, isError: trackError, error: trackErrorObj } =
    trpc.tracks.getById.useQuery({ id: params.trackId });
  const { data: dbModule, isLoading: moduleLoading, isError: moduleError, error: moduleErrorObj } =
    trpc.modules.getById.useQuery({ id: params.moduleId });

  const isLoading = trackLoading || moduleLoading;
  const isError = trackError || moduleError;
  const firstError = trackErrorObj || moduleErrorObj;

  if (isError) return <p>Something went wrong: {firstError?.message}</p>;
  if (isLoading) return <LoadingPanel label="Loading module player" />;
  if (!dbModule) return <p>No data found.</p>;

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
      <ModulePlayer module={moduleForPlayer} moduleId={params.moduleId} annotations={[]} quiz={[]} diffLines={[]} />
    </>
  );
}
