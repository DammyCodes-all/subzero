"use client";

import { formatPrice, formatRenewalDate, needsAttention } from "@/lib/format";

type Sub = {
  _id: string;
  merchant: string;
  product?: string;
  price: number;
  currency: string;
  billingInterval: string;
  nextRenewalAt?: number;
  cancellationDifficulty?: string;
  billingProvider?: string;
};

export function SubscriptionRow({ sub }: { sub: Sub }) {
  const isAttention = needsAttention(sub.nextRenewalAt);

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/40 py-3.5 last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`size-1.5 shrink-0 rounded-full ${isAttention ? "bg-destructive" : "bg-primary/60"}`}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-none">
            {sub.merchant}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {sub.product ?? "Subscription"}
            {sub.billingProvider
              ? ` · ${sub.billingProvider}`
              : sub.cancellationDifficulty
                ? ` · ${sub.cancellationDifficulty === "high" ? "High" : sub.cancellationDifficulty === "very_high" ? "Very high" : sub.cancellationDifficulty === "medium" ? "Medium" : "Low"}`
                : ""}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-numeric text-sm font-medium tabular-nums">
          {formatPrice(sub.price, sub.currency, sub.billingInterval)}
        </p>
        <p className="text-xs text-muted-foreground">
          Renews {formatRenewalDate(sub.nextRenewalAt)}
        </p>
      </div>
    </div>
  );
}
