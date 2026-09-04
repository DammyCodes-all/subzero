"use client";

import Image from "next/image";
import { useState } from "react";
import { MiniMarkdown } from "@/components/detail/MiniMarkdown";
import { faviconUrlFor } from "@/lib/merchantFavicon";

type Evidence = {
  _id: string;
  source: string;
  sourceType: "email" | "firecrawl" | "manual";
  excerpt: string;
  url?: string;
  messageId?: string;
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

function SourceLink({
  url,
  label = "Open source",
}: {
  url: string;
  label?: string;
}) {
  const [failed, setFailed] = useState(false);
  const favicon = faviconUrlFor(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-transparent px-2.5 py-1.5 font-mono text-xs font-medium text-foreground transition-colors hover:bg-secondary"
    >
      {favicon && !failed && (
        <Image
          src={favicon}
          alt=""
          width={14}
          height={14}
          unoptimized
          onError={() => setFailed(true)}
          className="size-3.5 rounded-[4px]"
        />
      )}
      {label}
    </a>
  );
}

// Gmail API ids are stored as `gmail:<hex>` — deep-linkable to the exact
// message. AgentMail ids are opaque (no public webmail), so those rows get
// no button. `u/0` assumes the first signed-in account, standard practice.
function gmailUrlFor(messageId?: string): string | null {
  if (!messageId?.startsWith("gmail:")) return null;
  const id = messageId.slice("gmail:".length).trim();
  if (!id) return null;
  return `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(id)}`;
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
      {evidence.map((ev) => {
        const gmailUrl = gmailUrlFor(ev.messageId);
        return (
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
              {ev.url ? (
                <SourceLink url={ev.url} />
              ) : gmailUrl ? (
                <SourceLink url={gmailUrl} label="Open in Gmail" />
              ) : null}
            </div>
            <blockquote className="mt-3 space-y-2 border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground">
              <MiniMarkdown text={ev.excerpt} />
            </blockquote>
          </div>
        );
      })}
    </div>
  );
}
