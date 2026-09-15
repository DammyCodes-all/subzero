"use client";

import { RefreshIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation } from "convex/react";
import { useState } from "react";
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

  const lastChecked = sub.researchedAt
    ? new Date(sub.researchedAt).toLocaleDateString()
    : null;

  async function handleRefresh() {
    setBusy(true);
    try {
      await retry({ id: sub._id });
      sileo.success({
        title: "Checking again",
        description: `Re-researching ${sub.merchant}. Steps update in a bit.`,
      });
    } catch (e) {
      sileo.error({
        title: "Hold on",
        description: e instanceof Error ? e.message : "Try again in a bit.",
      });
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
            {sub.researchStatus === "failed"
              ? "That check came up empty. Try it again."
              : lastChecked
                ? `Last checked ${lastChecked}. Looks off? Pull fresh steps. The old ones stay.`
                : "Looks off? Pull fresh steps. The old ones stay."}
          </p>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
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
          className={busy ? "animate-spin" : undefined}
        />
        {busy ? "Checking..." : "Refresh"}
      </Button>
    </div>
  );
}
