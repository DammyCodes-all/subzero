"use client";

type Evidence = {
  _id: string;
  source: string;
  sourceType: "email" | "firecrawl" | "manual";
  excerpt: string;
  url?: string;
  confidence: number;
  retrievedAt: number;
};

function formatRetrieved(ts: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

export function EvidenceBlock({ evidence }: { evidence: Evidence[] }) {
  if (evidence.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-transparent p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No verified evidence yet — we&apos;re still researching this merchant.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {evidence.map((ev) => (
        <div
          key={ev._id}
          className="rounded-lg border bg-card p-4 transition-colors hover:bg-[var(--card-hover)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium leading-none">
                  {ev.source}
                </p>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${
                    ev.sourceType === "email"
                      ? "bg-primary/15 text-primary"
                      : ev.sourceType === "firecrawl"
                        ? "bg-secondary text-muted-foreground"
                        : "bg-border text-muted-foreground"
                  }`}
                >
                  {ev.sourceType}
                </span>
              </div>
              <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatRetrieved(ev.retrievedAt)} ·{" "}
                {Math.round(ev.confidence * 100)}% confidence
              </p>
            </div>
            {ev.url && (
              <a
                href={ev.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 font-mono text-xs font-medium text-primary hover:underline"
              >
                Open source
              </a>
            )}
          </div>
          <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground">
            “{ev.excerpt}”
          </blockquote>
        </div>
      ))}
    </div>
  );
}
