// Instant Navigation shell for /dashboard — static, no client JS.
// Prefetched as App Shell via partialPrefetching; streams real data via Convex on commit.
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-hidden>
      {/* Summary strip */}
      <div className="flex items-center gap-2 border-b border-border/30 pb-5">
        <div className="h-5 w-10 animate-pulse rounded bg-border/60" />
        <div className="h-4 w-16 animate-pulse rounded bg-border/60" />
        <div className="h-4 w-3 animate-pulse rounded bg-border/60" />
        <div className="h-5 w-20 animate-pulse rounded bg-border/60" />
        <div className="h-4 w-12 animate-pulse rounded bg-border/60" />
        <div className="h-4 w-3 animate-pulse rounded bg-border/60" />
        <div className="h-5 w-14 animate-pulse rounded bg-border/60" />
        <div className="h-4 w-14 animate-pulse rounded bg-border/60" />
      </div>
      <div className="h-7 w-56 animate-pulse rounded bg-border/60" />
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 space-y-3">
            <div className="h-5 w-40 animate-pulse rounded bg-border/60" />
            <div className="h-4 w-52 animate-pulse rounded bg-border/60" />
            <div className="h-4 w-36 animate-pulse rounded bg-border/60" />
          </div>
          <div className="h-7 w-28 animate-pulse rounded bg-border/60" />
        </div>
      </div>
      <div className="h-4 w-36 animate-pulse rounded bg-border/60" />
      <div className="space-y-2">
        <div className="h-12 w-full animate-pulse rounded-lg border bg-card" />
        <div className="h-12 w-full animate-pulse rounded-lg border bg-card" />
      </div>
    </div>
  );
}
