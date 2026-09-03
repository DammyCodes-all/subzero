"use client";

import { formatPrice } from "@/lib/format";
import type { Doc } from "../../convex/_generated/dataModel";

interface SummaryHeaderProps {
  items: Doc<"subscriptions">[];
  attentionCount: number;
  activeCount: number;
}

// Money at risk groups by currency — summing mixed currencies is wrong.
// The biggest group (by charge count) owns the big number; the rest drops
// to the sub-line ("₦15,400" + "4 renewals · plus $64.99").
function splitTotals(items: Doc<"subscriptions">[]): {
  primary: string;
  remainder: string | null;
} {
  const totals = new Map<string, { total: number; count: number }>();
  for (const s of items) {
    const code = (s.currency || "USD").toUpperCase();
    const entry = totals.get(code) ?? { total: 0, count: 0 };
    entry.total += s.price;
    entry.count += 1;
    totals.set(code, entry);
  }
  const groups = [...totals.entries()];
  if (groups.length === 0) return { primary: "—", remainder: null };
  groups.sort((a, b) => b[1].count - a[1].count);
  const [[primaryCode, primary], ...rest] = groups;
  return {
    primary: formatPrice(primary.total, primaryCode),
    remainder:
      rest.length > 0
        ? rest.map(([code, g]) => formatPrice(g.total, code)).join(" + ")
        : null,
  };
}

// Overview strip — typographic, not boxed. Three metrics separated by a
// subtle hairline; no card borders. Numbers in Lato.
export function SummaryHeader({
  items,
  attentionCount,
  activeCount,
}: SummaryHeaderProps) {
  const atRisk = splitTotals(items);
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border/40">
      <div className="space-y-1.5 sm:pr-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          At risk this week
        </p>
        <p className="font-numeric text-[26px] font-bold leading-none tabular-nums text-foreground">
          {atRisk.primary}
        </p>
        <p className="text-xs text-muted-foreground">
          {items.length} renewal{items.length === 1 ? "" : "s"}
          {atRisk.remainder ? ` · plus ${atRisk.remainder}` : ""}
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
