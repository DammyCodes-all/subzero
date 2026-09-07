"use client";

import {
  CheckmarkCircle01Icon,
  Delete02Icon,
  Notification01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { type ComponentProps, useState } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/material-design-3-switch";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type ManageSub = {
  _id: Id<"subscriptions">;
  merchant: string;
  status: string;
  muted?: boolean;
};

type Icon = ComponentProps<typeof HugeiconsIcon>["icon"];

function RowIcon({ icon }: { icon: Icon }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <HugeiconsIcon
        icon={icon}
        size={18}
        strokeWidth={1.8}
        color="currentColor"
      />
    </div>
  );
}

export function SubscriptionManageCard({ sub }: { sub: ManageSub }) {
  const router = useRouter();
  const setMuted = useMutation(api.actions.setMuted);
  const markCancelled = useMutation(api.actions.markCancelled);
  const markActive = useMutation(api.actions.markActive);
  const hideSubscription = useMutation(api.actions.hideSubscription);

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
        {/* Mute */}
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-start gap-3">
            <RowIcon icon={Notification01Icon} />
            <div>
              <p className="text-sm font-medium text-foreground">
                Mute notifications
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isCancelled
                  ? "Cancelled subscriptions never send alerts."
                  : "Renewal alerts stop for this one. We still tell you if it gets cancelled."}
              </p>
            </div>
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
          />
        </div>

        {/* Cancel / restore */}
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <RowIcon icon={CheckmarkCircle01Icon} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {isCancelled ? "Restore to active" : "Mark as cancelled"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isCancelled
                  ? "Bring this back to your active list with alerts on."
                  : "Already cancelled outside SubZero? Mark it so tracking and alerts stop."}
              </p>
            </div>
          </div>
          {confirming === "cancel" && !isCancelled ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  run("cancel", () => markCancelled({ id: sub._id }))
                }
                className="h-8 text-xs font-semibold"
              >
                {busy === "cancel" ? "Marking..." : "Yes, mark cancelled"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy !== null}
                onClick={() => setConfirming(null)}
                className="h-8 text-xs font-medium"
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
              className="h-8 shrink-0 text-xs font-medium"
            >
              {busy === "cancel"
                ? "Working..."
                : isCancelled
                  ? "Restore"
                  : "Mark as cancelled"}
            </Button>
          )}
        </div>

        {/* Remove */}
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <HugeiconsIcon
                icon={
                  Delete02Icon as unknown as Parameters<
                    typeof HugeiconsIcon
                  >[0]["icon"]
                }
                size={18}
                strokeWidth={1.8}
                color="currentColor"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Remove from SubZero
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Hides this entry and its receipts and history. Your inbox is
                untouched. You can restore it from the Cancelled tab.
              </p>
            </div>
          </div>
          {confirming === "remove" ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  run("remove", async () => {
                    await hideSubscription({ id: sub._id });
                    sileo.success({
                      title: "Removed",
                      description: `${sub.merchant} is out of your list.`,
                    });
                    router.push("/dashboard/subscriptions");
                  })
                }
                className="h-8 text-xs font-semibold"
              >
                {busy === "remove" ? "Removing..." : "Yes, remove"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy !== null}
                onClick={() => setConfirming(null)}
                className="h-8 text-xs font-medium"
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
              className="h-8 shrink-0 text-xs font-medium"
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p role="status" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
