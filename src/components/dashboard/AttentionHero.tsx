"use client";

import { ExternalLinkIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { getCancellationCTA, openExternalUrl } from "@/lib/cancellation";
import {
  daysUntil,
  formatPrice,
  formatRenewalDate,
  frictionLabel,
} from "@/lib/format";
import type { Doc } from "../../../convex/_generated/dataModel";

function heroCountdown(ts?: number): string | null {
  const d = daysUntil(ts);
  if (d === null) return null;
  if (d <= 0) return "Today";
  if (d === 1) return "In 1 day";
  return `In ${d} days`;
}

// The one action that matters — the single bordered hero on the dashboard.
// Identity + facts on the left, the action vertically centered on the right
// so no corner of the card is dead. Lime means action/status only.
export function AttentionHero({ sub }: { sub: Doc<"subscriptions"> }) {
  const cta = getCancellationCTA(sub);
  const d = daysUntil(sub.nextRenewalAt);
  const urgent = d !== null && d <= 2 && d >= 0;
  const timing = heroCountdown(sub.nextRenewalAt);
  const friction = sub.cancellationDifficulty;
  const warnFriction =
    friction === "medium" || friction === "high" || friction === "very_high";
  // Don't echo the merchant name back at itself ("Google One · Google One").
  const showProduct =
    !!sub.product && sub.product.toLowerCase() !== sub.merchant.toLowerCase();

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 transition-colors hover:border-muted-foreground/30 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground"
        >
          {sub.merchant.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-heading text-[19px] font-bold leading-none tracking-tight text-foreground">
              {sub.merchant}
            </h3>
            {timing && (
              <span
                className={`font-mono text-[11px] uppercase tracking-widest ${
                  urgent ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {timing}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-none">
            {showProduct && (
              <span className="text-xs text-muted-foreground">
                {sub.product} ·{" "}
              </span>
            )}
            <span className="font-numeric text-[15px] font-bold tabular-nums text-foreground">
              {formatPrice(sub.price, sub.currency, sub.billingInterval)}
            </span>
            <span className="text-xs text-muted-foreground">
              {" "}
              · Renews {formatRenewalDate(sub.nextRenewalAt)}
            </span>
          </p>
          {friction && (
            <p className="mt-2 text-xs leading-none">
              {warnFriction && (
                <span className="text-primary">
                  Cancellation recommended ·{" "}
                </span>
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
        </div>
      </div>

      <div className="shrink-0 sm:self-center">
        {cta.href ? (
          <Button
            variant={cta.variant}
            size="sm"
            className="w-full gap-1.5 font-medium sm:w-auto"
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
            className="w-full gap-1.5 font-medium sm:w-auto"
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
