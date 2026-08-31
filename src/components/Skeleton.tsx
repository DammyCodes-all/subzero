"use client";

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-border/60 ${className ?? ""}`} />
  );
}

function SkeletonCard({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`animate-pulse rounded-lg border bg-card ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary strip skeleton */}
      <div className="flex items-center gap-2 border-b border-border/30 pb-5">
        <SkeletonLine className="h-5 w-10" />
        <SkeletonLine className="h-4 w-16" />
        <SkeletonLine className="h-4 w-3" />
        <SkeletonLine className="h-5 w-20" />
        <SkeletonLine className="h-4 w-12" />
        <SkeletonLine className="h-4 w-3" />
        <SkeletonLine className="h-5 w-14" />
        <SkeletonLine className="h-4 w-14" />
      </div>

      {/* Section heading */}
      <SkeletonLine className="h-7 w-56" />

      {/* Hero card skeleton */}
      <SkeletonCard className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 space-y-3">
            <SkeletonLine className="h-5 w-40" />
            <SkeletonLine className="h-4 w-52" />
            <SkeletonLine className="h-4 w-36" />
          </div>
          <SkeletonLine className="h-7 w-28" />
        </div>
      </SkeletonCard>

      {/* "Also due this week" heading */}
      <SkeletonLine className="h-4 w-36" />

      {/* Compact rows */}
      <div className="space-y-2">
        <SkeletonCard className="h-12 w-full" />
        <SkeletonCard className="h-12 w-full" />
      </div>

      {/* Section heading */}
      <SkeletonLine className="h-5 w-44" />

      {/* Subscription rows */}
      <div className="space-y-2">
        <SkeletonCard className="h-14 w-full" />
        <SkeletonCard className="h-14 w-full" />
        <SkeletonCard className="h-14 w-full" />
        <SkeletonCard className="h-14 w-full" />
      </div>
    </div>
  );
}

export function ForwardingCardSkeleton() {
  return (
    <div className="animate-pulse rounded-md border border-dashed border-border/60 bg-transparent p-5">
      <SkeletonLine className="h-4 w-32" />
      <SkeletonLine className="mt-2.5 h-3.5 w-full" />
      <div className="mt-4 flex items-center gap-2">
        <SkeletonLine className="h-9 flex-1" />
        <SkeletonLine className="h-8 w-16 shrink-0" />
      </div>
      <SkeletonLine className="mt-2 h-3 w-48" />
    </div>
  );
}

export function ConnectionsAgentMailSkeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-3 rounded-lg border border-border/80 bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-muted" />
        <div>
          <SkeletonLine className="h-4 w-48" />
          <SkeletonLine className="mt-1.5 h-3 w-56" />
        </div>
      </div>
      <SkeletonLine className="h-8 w-20" />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-[680px] px-6 py-10">
      {/* Back link skeleton */}
      <SkeletonLine className="mb-6 h-4 w-28" />

      {/* Merchant heading */}
      <SkeletonLine className="mb-2 h-7 w-52" />

      {/* Product + price line */}
      <SkeletonLine className="mb-2 h-4 w-64" />

      {/* Renewal + friction line */}
      <SkeletonLine className="mb-6 h-4 w-56" />

      {/* CTA button */}
      <SkeletonLine className="mb-10 h-7 w-36" />

      {/* How to cancel heading */}
      <SkeletonLine className="mb-4 h-5 w-40" />

      {/* Steps */}
      <SkeletonCard className="mb-8 p-5">
        <div className="space-y-3">
          <SkeletonLine className="h-4 w-full" />
          <SkeletonLine className="h-4 w-full" />
          <SkeletonLine className="h-4 w-3/4" />
        </div>
      </SkeletonCard>

      {/* Why we believe this heading */}
      <SkeletonLine className="mb-4 h-5 w-44" />

      {/* Intro text */}
      <SkeletonLine className="mb-4 h-4 w-full" />
      <SkeletonLine className="mb-4 h-4 w-3/4" />

      {/* Evidence cards */}
      <div className="space-y-3">
        <SkeletonCard className="h-28 w-full" />
        <SkeletonCard className="h-24 w-full" />
      </div>
    </div>
  );
}
