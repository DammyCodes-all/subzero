"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Coins01Icon,
  Calendar01Icon,
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons";
import { formatPrice } from "@/lib/format";
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
  const cancelledSubs = subscriptions.filter((s) => s.status === "cancelled");

  // 1. Monthly Spend calculation (normalized to monthly)
  const monthlySpend = activeSubs.reduce((sum, s) => {
    let monthlyPrice = s.price;
    if (s.billingInterval === "yearly") {
      monthlyPrice = s.price / 12;
    } else if (s.billingInterval === "weekly") {
      monthlyPrice = s.price * 4.33;
    }
    return sum + monthlyPrice;
  }, 0);

  // 2. Annual Spend projection
  const annualProjection = monthlySpend * 12;

  // 3. Renewing in next 7 days
  const renewingSoonCount = activeSubs.filter(
    (s) => s.nextRenewalAt && s.nextRenewalAt <= now + sevenDays && s.nextRenewalAt >= now,
  ).length;

  // 4. Active Free Trials
  const activeTrialsCount = activeSubs.filter(
    (s) => s.trialEndsAt && s.trialEndsAt > now,
  ).length;

  // 5. Total Money Saved (Sum of cancelled subs monthly value * 12)
  const totalSaved = cancelledSubs.reduce((sum, s) => {
    let annualVal = s.price;
    if (s.billingInterval === "monthly") {
      annualVal = s.price * 12;
    }
    return sum + annualVal;
  }, 0);

  return (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
      {/* 1. Monthly Spend */}
      <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Monthly Spend</span>
          <HugeiconsIcon
            icon={Coins01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
            size={16}
            strokeWidth={1.8}
            color="currentColor"
          />
        </div>
        <div className="mt-3">
          <p className="font-mono text-xl font-bold tabular-nums text-foreground">
            {formatPrice(monthlySpend, "USD")}/mo
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            ~{formatPrice(annualProjection, "USD")}/yr projected
          </p>
        </div>
      </div>

      {/* 2. Renewing Soon */}
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

      {/* 3. Action Needed */}
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

      {/* 4. Total Saved */}
      <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Money Saved</span>
          <HugeiconsIcon
            icon={CheckmarkCircle01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
            size={16}
            strokeWidth={1.8}
            color="currentColor"
            className="text-emerald-400"
          />
        </div>
        <div className="mt-3">
          <p className="font-mono text-xl font-bold tabular-nums text-emerald-400">
            {formatPrice(totalSaved, "USD")}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {cancelledSubs.length} sub{cancelledSubs.length === 1 ? "" : "s"} cancelled
          </p>
        </div>
      </div>

      {/* 5. Active Subscriptions Protection */}
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
