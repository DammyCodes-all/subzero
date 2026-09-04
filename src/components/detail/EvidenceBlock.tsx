"use client";

import { ExternalLinkIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MiniMarkdown } from "@/components/detail/MiniMarkdown";

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
    <div className="overflow-hidden rounded-xl border border-border/50 divide-y divide-border/40">
      {evidence.map((ev) => (
        <div
          key={ev._id}
          className="p-4 transition-colors hover:bg-[var(--card-hover)] sm:p-5"
        >
          <blockquote className="text-[13px] leading-relaxed text-foreground/90">
            <MiniMarkdown text={ev.excerpt} />
          </blockquote>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-xs font-medium text-foreground">
              {ev.source}
            </p>
            <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {ev.sourceType}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatRetrieved(ev.retrievedAt)} ·{" "}
              {Math.round(ev.confidence * 100)}%
            </span>
            {ev.url && (
              <a
                href={ev.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                Open source
                <HugeiconsIcon
                  icon={
                    ExternalLinkIcon as unknown as Parameters<
                      typeof HugeiconsIcon
                    >[0]["icon"]
                  }
                  size={11}
                  strokeWidth={2}
                  color="currentColor"
                />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
