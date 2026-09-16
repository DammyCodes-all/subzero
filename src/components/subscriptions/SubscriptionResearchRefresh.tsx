"use client";

import { RefreshIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ManageRowIcon } from "./ManageRowIcon";

type ResearchSub = {
  _id: Id<"subscriptions">;
  merchant: string;
  researchStatus?: string;
  researchedAt?: number;
};

export function SubscriptionResearchRefresh({ sub }: { sub: ResearchSub }) {
  const retry = useMutation(api.subscriptions.requestResearchRetry);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const isPending = sub.researchStatus === "pending";
  const ageMs =
    typeof sub.researchedAt === "number" ? now - sub.researchedAt : null;
  const remainingMs =
    typeof sub.researchedAt === "number"
      ? 10 * 60 * 1000 - (now - sub.researchedAt)
      : 0;
  const inCooldown = !isPending && remainingMs > 0;
  const cooldownLabel =
    remainingMs > 0 ? `${Math.max(1, Math.ceil(remainingMs / 60000))} min` : "";
  const isStalePending =
    isPending && ageMs !== null && ageMs > 2 * 60 * 1000;

  useEffect(() => {
    if (!isPending && !inCooldown) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [isPending, inCooldown]);

  const lastChecked = sub.researchedAt
    ? new Date(sub.researchedAt).toLocaleDateString()
    : null;

  async function handleRefresh() {
    if (busy || isPending) return;
    if (inCooldown) {
      sileo.error({
        title: "Hold on",
        description: `Research just ran — try again in ${cooldownLabel}.`,
      });
      return;
    }
    setBusy(true);
    try {
      await retry({ id: sub._id });
      sileo.success({
        title: "Checking again",
        description: `Re-researching ${sub.merchant}. Steps update in a bit.`,
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      if (raw.includes("Wait a few minutes")) {
        sileo.error({
          title: "Hold on",
          description: `Research just ran — try again in ${cooldownLabel || "a few minutes"}.`,
        });
      } else if (raw.includes("Nothing left to check")) {
        sileo.error({
          title: "Nothing to check",
          description: "This subscription is no longer tracked.",
        });
      } else {
        sileo.error({
          title: "Something went wrong",
          description: "Try again in a bit.",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-start gap-3">
        <ManageRowIcon icon={Search01Icon} />
        <div>
          <p className="text-sm font-medium text-foreground">Refresh steps</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isPending
              ? isStalePending
                ? "Taking longer than usual — you can retry shortly."
                : `Checking ${sub.merchant} help center… auto-updates in a bit.`
              : sub.researchStatus === "failed"
                ? "That check came up empty. Try it again."
                : inCooldown
                  ? lastChecked
                    ? `Last checked ${lastChecked}. Research just ran — try again in ${cooldownLabel}.`
                    : `Research just ran — try again in ${cooldownLabel}.`
                  : lastChecked
                    ? `Last checked ${lastChecked}. Looks off? Pull fresh steps. The old ones stay.`
                    : "Looks off? Pull fresh steps. The old ones stay."}
          </p>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy || isPending || inCooldown}
        onClick={() => void handleRefresh()}
        className="h-8 shrink-0 gap-1.5 text-xs font-medium"
      >
        <HugeiconsIcon
          icon={
            RefreshIcon as unknown as Parameters<
              typeof HugeiconsIcon
            >[0]["icon"]
          }
          size={14}
          color="currentColor"
          className={busy || isPending ? "animate-spin" : undefined}
        />
        {busy
          ? "Checking..."
          : isPending
            ? "Researching…"
            : inCooldown
              ? `Next check in ${cooldownLabel}`
              : "Refresh"}
      </Button>
    </div>
  );
}
