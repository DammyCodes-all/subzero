"use client";

import { formatPrice } from "@/lib/format";
import type { Doc } from "../../convex/_generated/dataModel";

interface SummaryHeaderProps {
  items: Doc<"subscriptions">[];
  attentionCount: number;
  activeCount: number;
}

// Money at risk groups by currency — summing mixed currencies is wrong,
// so "₦15,400 + $64.99" instead of a single converted figure.
function groupedTotal(items: Doc<"subscriptions">[]): string {
  const totals = new Map<string, number>();
  for (const s of items) {
    const code = (s.currency || "USD").toUpperCase();
    totals.set(code, (totals.get(code) ?? 0) + s.price);
  }
  const parts = [...totals.entries()].map(([code, total]) =>
    formatPrice(total, code),
  );
  return parts.length > 0 ? parts.join(" + ") : "—";
}

// Overview strip — typographic, not boxed. Three metrics separated by a
// subtle hairline; no card borders. Numbers in Lato.
export function SummaryHeader({
  items,
  attentionCount,
  activeCount,
}: SummaryHeaderProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border/40">
      <div className="space-y-1.5 sm:pr-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          At risk this week
        </p>
        <p className="font-numeric text-[26px] font-bold leading-none tabular-nums text-foreground">
          {groupedTotal(items)}
        </p>
        <p className="text-xs text-muted-foreground">
          {items.length} renewal{items.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="space-y-1.5 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Needs attention
        </p>
        <p className="font-numeric text-[26px] font-bold leading-none tabular-nums text-foreground">
          {attentionCount}
        </p>
        <p className="text-xs text-muted-foreground">
          {attentionCount === 1 ? "needs action" : "need action"}
        </p>
      </div>

      <div className="space-y-1.5 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Active
        </p>
        <p className="font-numeric text-[26px] font-bold leading-none tabular-nums text-foreground">
          {activeCount}
        </p>
        <p className="text-xs text-muted-foreground">tracked</p>
      </div>
    </div>
  );
}
