export default function SettingsLoading() {
  return (
    <div className="space-y-8" aria-hidden>
      <div>
        <div className="h-7 w-28 animate-pulse rounded bg-border/60" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-border/60" />
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="h-14 w-full animate-pulse border-b border-border/40" />
        <div className="h-14 w-full animate-pulse border-b border-border/40" />
        <div className="h-14 w-full animate-pulse" />
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="h-5 w-48 animate-pulse rounded bg-border/60" />
        <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-border/40" />
      </div>
    </div>
  );
}
