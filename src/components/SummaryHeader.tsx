"use client";

import { formatPrice } from "@/lib/format";
import type { Doc } from "../../convex/_generated/dataModel";

interface SummaryHeaderProps {
  paceItems: Doc<"subscriptions">[];
  attentionCount: number;
  activeCount: number;
  trialCount: number;
}

// Monthly pace groups by currency — summing mixed currencies is wrong.
// Intervals are normalized to monthly equivalents so the total is a real
// velocity number, not a mix of /mo and /yr figures. Unknown intervals are
// counted as-is (treated monthly); the sub-line states the scope.
function monthlyEquivalent(price: number, interval?: string): number {
  if (interval === "yearly") return price / 12;
  if (interval === "weekly") return (price * 52) / 12;
  return price;
}

function paceTotals(items: Doc<"subscriptions">[]): {
  primary: string;
  remainder: string | null;
} {
  const totals = new Map<string, { total: number; count: number }>();
  for (const s of items) {
    const code = (s.currency || "USD").toUpperCase();
    const entry = totals.get(code) ?? { total: 0, count: 0 };
    entry.total += monthlyEquivalent(s.price, s.billingInterval);
    entry.count += 1;
    totals.set(code, entry);
  }
  const groups = [...totals.entries()];
  if (groups.length === 0) return { primary: "—", remainder: null };
  groups.sort((a, b) => b[1].count - a[1].count);
  const [[primaryCode, primary], ...rest] = groups;
  return {
    primary: formatPrice(Math.round(primary.total), primaryCode, "monthly"),
    remainder:
      rest.length > 0
        ? rest
            .map(([code, g]) =>
              formatPrice(Math.round(g.total), code, "monthly"),
            )
            .join(" + ")
        : null,
  };
}

// Overview strip — typographic, not boxed. Three metrics separated by a
// subtle hairline; no card borders. Numbers in Lato. Portfolio stats only
// (pace, attention, holdings) — anything temporal lives in the hero/list
// with real countdowns, so nothing here needs a time window to mean
// something.
export function SummaryHeader({
  paceItems,
  attentionCount,
  activeCount,
  trialCount,
}: SummaryHeaderProps) {
  const pace = paceTotals(paceItems);
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border/40">
      <div className="space-y-1.5 sm:pr-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Monthly pace
        </p>
        <p className="font-numeric text-[26px] font-bold leading-none tabular-nums text-foreground">
          {pace.primary}
        </p>
        <p className="text-xs text-muted-foreground">
          across {paceItems.length} subscription
          {paceItems.length === 1 ? "" : "s"}
          {pace.remainder ? ` · plus ${pace.remainder}` : ""}
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
        <p className="text-xs text-muted-foreground">
          {trialCount > 0
            ? `tracked · incl. ${trialCount} trial${trialCount === 1 ? "" : "s"}`
            : "tracked"}
        </p>
      </div>
    </div>
  );
}
