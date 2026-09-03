"use client";

import { ExternalLinkIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { getCancellationCTA, openExternalUrl } from "@/lib/cancellation";
import { daysUntil, formatPrice, frictionLabel } from "@/lib/format";
import type { Doc } from "../../../convex/_generated/dataModel";

function heroCountdown(ts?: number): string | null {
  const d = daysUntil(ts);
  if (d === null) return null;
  if (d <= 0) return "Today";
  if (d === 1) return "In 1 day";
  return `In ${d} days`;
}

// The one action that matters — the single bordered hero on the dashboard.
// Lime means action/status only: the friction warning and the CTA.
export function AttentionHero({ sub }: { sub: Doc<"subscriptions"> }) {
  const cta = getCancellationCTA(sub);
  const timing = heroCountdown(sub.nextRenewalAt);
  const friction = sub.cancellationDifficulty;
  const warnFriction =
    friction === "medium" || friction === "high" || friction === "very_high";

  return (
    <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-muted-foreground/30">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-heading text-[19px] font-bold leading-none tracking-tight text-foreground">
          {sub.merchant}
        </h3>
        {timing && (
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {timing}
          </span>
        )}
      </div>
      <p className="mt-2.5 text-sm leading-none">
        <span className="text-xs text-muted-foreground">
          {sub.product ?? "Subscription"} ·{" "}
        </span>
        <span className="font-numeric text-[15px] font-bold tabular-nums text-foreground">
          {formatPrice(sub.price, sub.currency, sub.billingInterval)}
        </span>
      </p>
      {friction && (
        <p className="mt-2.5 text-xs leading-none">
          {warnFriction && (
            <span className="text-primary">Cancellation recommended · </span>
          )}
          <span className="text-muted-foreground">
            {frictionLabel(friction)}
          </span>
        </p>
      )}
      {sub.billingProvider && (
        <p className="mt-2 text-xs leading-none text-muted-foreground">
          Billed through {sub.billingProvider}
        </p>
      )}
      <div className="mt-5 flex justify-end">
        {cta.href ? (
          <Button
            variant={cta.variant}
            size="sm"
            className="gap-1.5 font-medium"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openExternalUrl(cta.href!, sub.billingProvider);
            }}
          >
            {cta.label}
            <HugeiconsIcon
              icon={
                ExternalLinkIcon as unknown as Parameters<
                  typeof HugeiconsIcon
                >[0]["icon"]
              }
              size={14}
              strokeWidth={1.8}
              color="currentColor"
              className="opacity-70"
            />
          </Button>
        ) : (
          <Button
            variant={cta.variant}
            size="sm"
            disabled={(cta as { disabled?: boolean }).disabled}
            className="gap-1.5 font-medium"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {cta.label}
          </Button>
        )}
      </div>
    </div>
  );
}
