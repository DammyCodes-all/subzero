export default function ConnectionsLoading() {
  return (
    <div className="space-y-6" aria-hidden>
      <div>
        <div className="h-7 w-56 animate-pulse rounded bg-border/60" />
        <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-border/60" />
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="h-6 w-48 animate-pulse rounded bg-border/60" />
        <div className="mt-4 space-y-3">
          <div className="h-16 w-full animate-pulse rounded-lg bg-background/50" />
          <div className="h-16 w-full animate-pulse rounded-lg bg-background/50" />
        </div>
      </div>
      <div className="h-28 w-full animate-pulse rounded-md border border-dashed border-border/60" />
    </div>
  );
}
