"use client";

import { ActionCard } from "@/components/ActionCard";
import { Button } from "@/components/ui/button";
import type { Doc } from "../../../convex/_generated/dataModel";

export function FirstScanSummary({
  total,
  needCount,
  topSubs,
  moreCount,
  onShowMe,
}: {
  /** Live subscription count — same query as the dashboard behind it. */
  total: number;
  /** Live 7-day attention count. */
  needCount: number;
  /** Closest upcoming subs to preview. */
  topSubs: Doc<"subscriptions">[];
  /** Remaining subs beyond the preview. */
  moreCount: number;
  onShowMe: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 text-center">
      <div className="space-y-1.5">
        <h2 className="font-heading text-2xl font-bold tracking-tight">
          We found {total} subscription{total === 1 ? "" : "s"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {needCount > 0
            ? `${needCount} need${needCount === 1 ? "s" : ""} you this week. Start with the closest one.`
            : "Nothing renews this week. Here is what we are watching."}
        </p>
      </div>
      <div className="space-y-3 text-left">
        {topSubs.slice(0, 3).map((s) => (
          <ActionCard key={s._id} sub={s} />
        ))}
      </div>
      {moreCount > 0 && (
        <p className="font-mono text-xs text-muted-foreground">
          + {moreCount} more on your dashboard
        </p>
      )}
      <div>
        <Button onClick={onShowMe} className="font-medium">
          Show me
        </Button>
      </div>
    </div>
  );
}
