"use client";

import { useState } from "react";
import { formatPrice, formatRenewalDate, needsAttention } from "@/lib/format";
import { ActionCard } from "./ActionCard";

type Sub = {
  _id: string;
  merchant: string;
  product?: string;
  price: number;
  currency: string;
  billingInterval: string;
  nextRenewalAt?: number;
  cancellationDifficulty?: string;
  cancellationMethod?: string;
  cancellationUrl?: string;
  billingProvider?: string;
};

export function SubscriptionRow({ sub }: { sub: Sub }) {
  const [expanded, setExpanded] = useState(false);
  const isAttention = needsAttention(sub.nextRenewalAt);

  return (
    <div className="rounded-lg border bg-card/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 p-3 text-left hover:bg-[var(--card-hover)] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`size-2 shrink-0 rounded-full ${isAttention ? "bg-destructive" : "bg-primary"}`}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-none">
              {sub.merchant}
            </p>
            {sub.product && (
              <p className="truncate text-xs text-muted-foreground">
                {sub.product}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-medium tabular-nums">
            {formatPrice(sub.price, sub.currency, sub.billingInterval)}
          </p>
          <p className="text-xs text-muted-foreground">
            Renews {formatRenewalDate(sub.nextRenewalAt)}
          </p>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border p-3 bg-background/50">
          <ActionCard sub={sub} />
        </div>
      )}
    </div>
  );
}
