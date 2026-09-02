export default function ActionsLoading() {
  return (
    <div className="space-y-8" aria-hidden>
      <div>
        <div className="h-7 w-36 animate-pulse rounded bg-border/60" />
        <div className="mt-2 h-4 w-[520px] max-w-full animate-pulse rounded bg-border/60" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    </div>
  );
}
