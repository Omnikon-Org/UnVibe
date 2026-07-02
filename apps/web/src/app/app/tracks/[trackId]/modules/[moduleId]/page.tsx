"use client";

import { PageHeader } from "@/components/app/page-header";
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

  if (isError) return (
    <div role="alert" className="rounded-md bg-destructive/10 p-6 text-center">
      <p className="font-medium text-destructive">Failed to load content</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Please try refreshing the page. If the issue persists, contact support.
      </p>
    </div>
  );
  if (isLoading) return (
    <div role="status" aria-label="Loading module" className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="h-64 animate-pulse rounded-lg bg-primary/10" />
          <div className="h-64 animate-pulse rounded-lg bg-primary/10" />
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-primary/10" />
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
  if (!dbModule) return (
    <div role="status" className="rounded-md bg-muted/10 p-6 text-center">
      <p className="font-medium text-muted-foreground">Module content is not available.</p>
    </div>
  );

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
