// App Shell for /dashboard/subscriptions — cached per route via partialPrefetching
export default function SubscriptionsLoading() {
  return (
    <div className="space-y-6" aria-hidden>
      <div>
        <div className="h-7 w-40 animate-pulse rounded bg-border/60" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-border/60" />
      </div>
      <div className="flex gap-1.5 border-b border-border/40 pb-2">
        <div className="h-7 w-14 animate-pulse rounded-lg bg-border/60" />
        <div className="h-7 w-16 animate-pulse rounded-lg bg-border/60" />
        <div className="h-7 w-14 animate-pulse rounded-lg bg-border/60" />
        <div className="h-7 w-20 animate-pulse rounded-lg bg-border/40" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="h-10 w-full animate-pulse bg-secondary/40" />
        <div className="divide-y divide-border/40">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-4 w-32 animate-pulse rounded bg-border/60" />
              <div className="h-4 w-20 animate-pulse rounded bg-border/40" />
              <div className="h-4 w-28 animate-pulse rounded bg-border/40" />
              <div className="ml-auto h-6 w-16 animate-pulse rounded-lg bg-border/40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
