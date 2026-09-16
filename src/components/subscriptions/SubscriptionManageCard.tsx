"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/material-design-3-switch";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { SubscriptionResearchRefresh } from "./SubscriptionResearchRefresh";

type ManageSub = {
  _id: Id<"subscriptions">;
  merchant: string;
  status: string;
  muted?: boolean;
  researchStatus?: string;
  researchedAt?: number;
};

export function SubscriptionManageCard({ sub }: { sub: ManageSub }) {
  const router = useRouter();
  const setMuted = useMutation(api.actions.setMuted);
  const markCancelled = useMutation(api.actions.markCancelled);
  const markActive = useMutation(api.actions.markActive);
  const deleteSubscription = useMutation(api.actions.deleteSubscription);

  const [busy, setBusy] = useState<null | "mute" | "cancel" | "remove">(null);
  const [confirming, setConfirming] = useState<null | "cancel" | "remove">(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const isCancelled = sub.status === "cancelled";
  const muted = sub.muted === true;

  const run = async (
    key: "mute" | "cancel" | "remove",
    fn: () => Promise<unknown>,
  ) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setConfirming(null);
    } catch {
      setError("Something went wrong. Try again in a bit.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-10 space-y-3 border-t border-border/40 pt-8">
      <h2 className="font-heading text-base font-semibold tracking-tight">
        Manage
      </h2>

      <div className="rounded-xl border border-border bg-card divide-y divide-border/40">
        {/* Research refresh */}
        <SubscriptionResearchRefresh sub={sub} />

        {/* Mute */}
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              Mute notifications
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {isCancelled
                ? "Cancelled subscriptions never send alerts."
                : "Renewal alerts stop for this one. We still tell you if it gets cancelled."}
            </p>
          </div>
          <Switch
            size="sm"
            checked={muted}
            disabled={isCancelled || busy !== null}
            onCheckedChange={() =>
              run("mute", async () => {
                await setMuted({ id: sub._id, muted: !muted });
                sileo.success({
                  title: muted ? "Alerts back on" : "Muted",
                  description: muted
                    ? `Renewal alerts for ${sub.merchant} are back on.`
                    : `No more renewal alerts for ${sub.merchant}.`,
                });
              })
            }
            aria-label="Mute notifications for this subscription"
            className="shrink-0"
          />
        </div>

        {/* Cancel / restore */}
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {isCancelled ? "Restore to active" : "Mark as cancelled"}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {isCancelled
                ? "Bring this back to your active list with alerts on."
                : "Already cancelled outside SubZero? Mark it so tracking and alerts stop."}
            </p>
          </div>
          {confirming === "cancel" && !isCancelled ? (
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:items-center">
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  run("cancel", () => markCancelled({ id: sub._id }))
                }
                className="h-9 justify-center text-xs font-semibold sm:h-8"
              >
                {busy === "cancel" ? "Marking..." : "Yes, mark cancelled"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy !== null}
                onClick={() => setConfirming(null)}
                className="h-9 justify-center text-xs font-medium sm:h-8"
              >
                Keep tracking
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy !== null}
              onClick={() => {
                if (isCancelled) {
                  run("cancel", () => markActive({ id: sub._id }));
                } else {
                  setConfirming("cancel");
                }
              }}
              className="h-9 w-full justify-center text-xs font-medium sm:h-8 sm:w-auto"
            >
              {busy === "cancel"
                ? "Working..."
                : isCancelled
                  ? "Restore"
                  : "Mark as cancelled"}
            </Button>
          )}
        </div>
      </div>

      {/* Danger zone — separated so Remove never reads as a normal setting */}
      <div className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-4 sm:px-5">
        <p className="text-sm font-medium text-foreground">
          Remove from SubZero
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Permanently deletes receipts and history. Your inbox is untouched
          and it won&apos;t come back on rescan.
        </p>
        {confirming === "remove" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button
              variant="destructive"
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                run("remove", async () => {
                  await deleteSubscription({ id: sub._id });
                  sileo.success({
                    title: "Deleted",
                    description: `${sub.merchant} is permanently gone.`,
                  });
                  router.push("/dashboard/subscriptions");
                })
              }
              className="h-9 justify-center text-xs font-semibold sm:h-8"
            >
              {busy === "remove" ? "Removing..." : "Yes, remove"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy !== null}
              onClick={() => setConfirming(null)}
              className="h-9 justify-center text-xs font-medium sm:h-8"
            >
              Keep it
            </Button>
          </div>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            disabled={busy !== null}
            onClick={() => setConfirming("remove")}
            className="mt-3 h-9 w-full justify-center text-xs font-medium sm:h-8 sm:w-auto"
          >
            Remove
          </Button>
        )}
      </div>

      {error && (
        <p role="status" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
