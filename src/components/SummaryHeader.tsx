"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar01Icon,
  AlertCircleIcon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons";
import type { Doc } from "../../convex/_generated/dataModel";

interface SummaryHeaderProps {
  subscriptions: Doc<"subscriptions">[];
  attentionCount: number;
}

export function SummaryHeader({
  subscriptions,
  attentionCount,
}: SummaryHeaderProps) {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  // Active subscriptions
  const activeSubs = subscriptions.filter((s) => s.status !== "cancelled");
  // 1. Renewing in next 7 days
  const renewingSoonCount = activeSubs.filter(
    (s) => s.nextRenewalAt && s.nextRenewalAt <= now + sevenDays && s.nextRenewalAt >= now,
  ).length;

  // 2. Active Free Trials
  const activeTrialsCount = activeSubs.filter(
    (s) => s.trialEndsAt && s.trialEndsAt > now,
  ).length;

  return (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
      {/* 1. Renewing Soon */}
      <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Renewing Soon</span>
          <HugeiconsIcon
            icon={Calendar01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
            size={16}
            strokeWidth={1.8}
            color="currentColor"
            className={renewingSoonCount > 0 ? "text-amber-400" : ""}
          />
        </div>
        <div className="mt-3">
          <p className="font-mono text-xl font-bold tabular-nums text-foreground">
            {renewingSoonCount}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            due in next 7 days
          </p>
        </div>
      </div>

      {/* 2. Action Needed */}
      <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Needs Attention</span>
          <HugeiconsIcon
            icon={AlertCircleIcon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
            size={16}
            strokeWidth={1.8}
            color="currentColor"
            className={attentionCount > 0 ? "text-primary" : ""}
          />
        </div>
        <div className="mt-3">
          <p
            className={`font-mono text-xl font-bold tabular-nums ${
              attentionCount > 0 ? "text-primary" : "text-foreground"
            }`}
          >
            {attentionCount}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {activeTrialsCount > 0 ? `${activeTrialsCount} active free trial` : "requiring review"}
          </p>
        </div>
      </div>

      {/* 3. Active Subscriptions Protection */}
      <div className="col-span-2 flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80 sm:col-span-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Active Subs</span>
          <HugeiconsIcon
            icon={ShieldCheckIcon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
            size={16}
            strokeWidth={1.8}
            color="currentColor"
            className="text-primary"
          />
        </div>
        <div className="mt-3">
          <p className="font-mono text-xl font-bold tabular-nums text-foreground">
            {activeSubs.length}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            monitored by SubZero
          </p>
        </div>
      </div>
    </div>
  );
}
