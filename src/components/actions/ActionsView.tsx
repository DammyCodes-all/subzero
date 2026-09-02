"use client";

import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  CheckmarkCircle01Icon,
  ExternalLinkIcon,
  Loading03Icon,
  Mail01Icon,
  Link01Icon,
  CustomerService01Icon,
  TaskDone01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  LinkPendingDot,
  PendingWrap,
} from "@/components/ui/LinkPending";
import { formatPrice, formatRenewalDate, frictionLabel } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  METHOD_LABELS,
  type ActionItem,
} from "./types";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Action Card
// ---------------------------------------------------------------------------

function methodIcon(method?: string) {
  if (method === "send_email")
    return Mail01Icon;
  if (method === "open_web" || method === "open_provider")
    return ExternalLinkIcon;
  if (method === "contact_support")
    return CustomerService01Icon;
  return Link01Icon;
}

function ActionCard({ item }: { item: ActionItem }) {
  const markCancelled = useMutation(api.actions.markCancelled);
  const markStarted = useMutation(api.actions.markStarted);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState<"start" | "done" | null>(null);

  const handleStart = async () => {
    setLoading("start");
    try {
      await markStarted({ id: item._id });
    } finally {
      setLoading(null);
    }
  };

  const handleConfirmDone = async () => {
    setLoading("done");
    try {
      await markCancelled({ id: item._id });
    } finally {
      setLoading(null);
      setConfirming(false);
    }
  };

  const Icon = methodIcon(item.cancellationMethod);
  const statusLabel = STATUS_LABELS[item.status] ?? item.status;
  const statusColor = STATUS_COLORS[item.status] ?? "bg-border text-muted-foreground";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md sm:flex-row sm:items-start sm:justify-between">
      {/* Left — identity + meta */}
      <div className="flex min-w-0 gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HugeiconsIcon
            icon={Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
            size={20}
            strokeWidth={1.8}
            color="currentColor"
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/subscriptions/${item._id}`}
              className="inline-flex items-center gap-1.5 font-heading text-base font-semibold hover:underline"
            >
              <PendingWrap className="inline-flex">
                {item.merchant}
              </PendingWrap>
              <LinkPendingDot />
            </Link>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor}`}
            >
              {statusLabel}
            </span>
          </div>

          <p className="mt-0.5 font-mono text-sm text-foreground">
            {formatPrice(item.price, item.currency, item.billingInterval)}
          </p>

          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {item.nextRenewalAt && (
              <span>Renews {formatRenewalDate(item.nextRenewalAt)}</span>
            )}
            {item.cancellationDifficulty && (
              <span>· {frictionLabel(item.cancellationDifficulty)}</span>
            )}
            {item.cancellationMethod && (
              <span>· {METHOD_LABELS[item.cancellationMethod]}</span>
            )}
          </div>
        </div>
      </div>

      {/* Right — CTAs */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
        {!confirming ? (
          <>
            {/* Primary action: open cancel page or mark started */}
            {(item.cancellationMethod === "open_web" ||
              item.cancellationMethod === "open_provider") &&
            item.cancellationUrl ? (
              <a
                href={item.cancellationUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void markStarted({ id: item._id })}
              >
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <HugeiconsIcon
                    icon={ExternalLinkIcon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                    size={13}
                    color="currentColor"
                  />
                  Open cancellation
                </Button>
              </a>
            ) : item.status === "action_ready" ? (
              <Button
                size="sm"
                disabled={loading === "start"}
                onClick={handleStart}
                className="h-8 gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {loading === "start" ? (
                  <HugeiconsIcon
                    icon={Loading03Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                    size={13}
                    color="currentColor"
                    className="animate-spin"
                  />
                ) : null}
                Start cancellation
              </Button>
            ) : null}

            {/* Confirm done */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirming(true)}
              className="h-8 gap-1.5 text-xs"
            >
              <HugeiconsIcon
                icon={CheckmarkCircle01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                size={13}
                color="currentColor"
              />
              Mark as cancelled
            </Button>
          </>
        ) : (
          /* Confirm step */
          <div className="flex flex-col items-end gap-2">
            <p className="text-xs text-muted-foreground">
              Confirm {item.merchant} is cancelled?
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setConfirming(false)}
              >
                No, go back
              </Button>
              <Button
                size="sm"
                disabled={loading === "done"}
                onClick={handleConfirmDone}
                className="h-7 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
              >
                {loading === "done" ? (
                  <HugeiconsIcon
                    icon={Loading03Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                    size={12}
                    color="currentColor"
                    className="animate-spin"
                  />
                ) : (
                  <HugeiconsIcon
                    icon={TaskDone01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                    size={12}
                    color="currentColor"
                  />
                )}
                Yes, confirmed
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------

export function ActionsView() {
  const items = useQuery(api.actions.listActionable);

  const ready = items?.filter((i) => i.status === "action_ready") ?? [];
  const inProgress = items?.filter((i) => i.status === "user_started") ?? [];
  const pending = items?.filter((i) => i.status === "cancellation_pending") ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Action Center
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Subscriptions with verified cancellation routes, in-progress cancellations,
          and ones awaiting your confirmation.
        </p>
      </div>

      {/* Loading */}
      {items === undefined && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      )}

      {/* Empty */}
      {items !== undefined && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 bg-card p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HugeiconsIcon
              icon={Alert02Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
              size={24}
              strokeWidth={1.5}
              color="currentColor"
            />
          </div>
          <p className="font-heading text-base font-semibold">No actions pending</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Once SubZero researches cancellation routes for your subscriptions,
            actionable items will appear here.
          </p>
          <Link href="/dashboard/subscriptions" className="inline-flex items-center">
            <Button variant="outline" size="sm" className="mt-5 gap-1.5 text-xs">
              <PendingWrap className="inline-flex items-center gap-1.5">
                View all subscriptions
              </PendingWrap>
              <LinkPendingDot />
            </Button>
          </Link>
        </div>
      )}

      {/* Ready to cancel */}
      {ready.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Ready to cancel
            </h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
              {ready.length}
            </span>
          </div>
          <div className="space-y-3">
            {ready.map((item) => (
              <ActionCard key={item._id} item={item as ActionItem} />
            ))}
          </div>
        </section>
      )}

      {/* In progress */}
      {inProgress.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              In progress
            </h2>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-amber-400">
              {inProgress.length}
            </span>
          </div>
          <div className="space-y-3">
            {inProgress.map((item) => (
              <ActionCard key={item._id} item={item as ActionItem} />
            ))}
          </div>
        </section>
      )}

      {/* Pending confirmation */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Pending confirmation
            </h2>
            <span className="rounded-full bg-violet-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-violet-400">
              {pending.length}
            </span>
          </div>
          <div className="space-y-3">
            {pending.map((item) => (
              <ActionCard key={item._id} item={item as ActionItem} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
