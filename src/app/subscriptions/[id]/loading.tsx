// App Shell for /subscriptions/[id] — static part prefetched per route.
// Dynamic param-specific data streams after commit; spinner handled here.
export default function SubscriptionDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-[680px]" aria-hidden>
      <div className="mb-6 h-4 w-28 animate-pulse rounded bg-border/60" />
      <div className="mb-2 h-7 w-52 animate-pulse rounded bg-border" />
      <div className="mb-2 h-4 w-64 animate-pulse rounded bg-border/60" />
      <div className="mb-6 h-4 w-56 animate-pulse rounded bg-border/60" />
      <div className="mb-10 h-9 w-36 animate-pulse rounded-lg bg-border" />
      <div className="mb-4 h-5 w-40 animate-pulse rounded bg-border/60" />
      <div className="mb-8 rounded-lg border bg-card p-5">
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-border/60" />
          <div className="h-4 w-full animate-pulse rounded bg-border/60" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-border/60" />
        </div>
      </div>
      <div className="mb-4 h-5 w-44 animate-pulse rounded bg-border/60" />
      <div className="space-y-3">
        <div className="h-28 w-full animate-pulse rounded-lg border bg-card" />
        <div className="h-24 w-full animate-pulse rounded-lg border bg-card" />
      </div>
    </div>
  );
}
