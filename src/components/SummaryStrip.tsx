"use client";

import { formatPrice } from "@/lib/format";

type Props = {
  count: number;
  total: number;
  currency?: string;
  attentionCount: number;
};

export function SummaryStrip({
  count,
  total,
  currency = "USD",
  attentionCount,
}: Props) {
  return (
    <div className="border-b border-border/30 pb-5">
      <p className="text-sm leading-none">
        <span className="font-numeric text-sm font-medium tabular-nums text-foreground">
          {count}
        </span>{" "}
        <span className="text-sm text-muted-foreground">subscriptions</span>
        <span className="mx-3 text-muted-foreground">·</span>
        <span className="font-numeric text-sm font-medium tabular-nums text-foreground">
          {formatPrice(total, currency)}
        </span>{" "}
        <span className="text-sm text-muted-foreground">upcoming</span>
        <span className="mx-3 text-muted-foreground">·</span>
        <span
          className={`font-numeric text-sm font-medium tabular-nums ${attentionCount > 0 ? "text-primary" : "text-foreground"}`}
        >
          {attentionCount}
        </span>{" "}
        <span className="text-sm text-muted-foreground">
          {attentionCount === 1 ? "needs" : "need"} attention
        </span>
      </p>
    </div>
  );
}
