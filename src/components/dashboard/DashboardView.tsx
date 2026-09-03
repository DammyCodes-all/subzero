"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { sileo } from "sileo";
import { ActionCard } from "@/components/ActionCard";
import { CompactAttentionRow } from "@/components/CompactAttentionRow";
import { NoSubscriptionsState } from "@/components/EmptyState";
import { ProcessingRows } from "@/components/ingestion/ProcessingRows";
import { DashboardSkeleton } from "@/components/Skeleton";
import { SummaryHeader } from "@/components/SummaryHeader";
import {
  LinkPendingDot,
  LinkPendingOverlay,
  PendingWrap,
} from "@/components/ui/LinkPending";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";

export function DashboardView() {
  const attention = useQuery(api.subscriptions.needsAttention, { days: 7 });
  const all = useQuery(api.subscriptions.list);
  const gmailStatus = useQuery(api.gmail.getGmailStatus);

  const isLoading = attention === undefined || all === undefined;

  const searchParams = useSearchParams();
  const router = useRouter();
  const gmailError = searchParams.get("gmail_error");
  const gmailConnected = searchParams.get("gmail_connected");

  useEffect(() => {
    if (gmailError) {
      sileo.error({
        title: "Gmail connection failed",
        description: gmailError,
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("gmail_error");
      url.searchParams.delete("gmail_connected");
      router.replace(
        url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash,
        { scroll: false },
      );
    } else if (gmailConnected) {
      sileo.success({
        title: "Gmail connected successfully",
        description:
          "We're now scanning your inbox for subscription receipts and trial emails",
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("gmail_error");
      url.searchParams.delete("gmail_connected");
      router.replace(
        url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash,
        { scroll: false },
      );
    }
  }, [gmailError, gmailConnected, router]);

  // Determine what to show in the sub list:
  // - Urgent items (renewing ≤7d) if any exist
  // - Otherwise the 3 closest upcoming renewals
  const urgentSubs = attention ?? [];
  const hasUrgent = urgentSubs.length > 0;

  const fallbackSubs = hasUrgent
    ? []
    : [...(all ?? [])]
        .filter((s) => s.status !== "cancelled" && s.nextRenewalAt)
        .sort((a, b) => (a.nextRenewalAt ?? 0) - (b.nextRenewalAt ?? 0))
        .slice(0, 3);

  const displaySubs = hasUrgent ? urgentSubs : fallbackSubs;
  const hero = displaySubs[0];
  const rest = displaySubs.slice(1);

  return (
    <div className="space-y-8">
      <ProcessingRows />
      {gmailStatus?.needsReauth && !gmailStatus?.connected && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px]">
          <span>Gmail needs reconnect — auto-watch paused. Reconnect to resume.</span>
          <Link href="/dashboard/connections" className="font-mono text-[11px] underline underline-offset-2">
            Reconnect
          </Link>
        </div>
      )}
      {gmailStatus?.connected && (
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
          {gmailStatus.gmailWatchExpiration && gmailStatus.gmailWatchExpiration > Date.now()
            ? `Watching Gmail · push active · last sync ${gmailStatus.lastGmailScanAt ? new Date(gmailStatus.lastGmailScanAt).toLocaleTimeString() : "just now"}`
            : `Auto-watching Gmail · syncs every 15m${gmailStatus.lastGmailScanAt ? ` · last ${new Date(gmailStatus.lastGmailScanAt).toLocaleTimeString()}` : ""}`}
        </div>
      )}
      {isLoading ? (
        <DashboardSkeleton />
      ) : (all?.length ?? 0) === 0 ? (
        /* ── Zero-state ── */
        <div className="space-y-8">
          <SummaryHeader subscriptions={[]} attentionCount={0} />
          <NoSubscriptionsState />
        </div>
      ) : (
        /* ── Populated state ── */
        <div className="space-y-8">
          <SummaryHeader
            subscriptions={all as Doc<"subscriptions">[]}
            attentionCount={urgentSubs.length}
          />

          {/* Attention / Upcoming section */}
          <section className="space-y-5">
            <div className="flex items-end justify-between">
              <h1 className="font-heading text-[26px] font-bold leading-none tracking-tight md:text-[28px]">
                {hasUrgent ? "Needs your attention" : "Coming up next"}
              </h1>
              <Link
                href="/dashboard/subscriptions"
                className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
                <HugeiconsIcon
                  icon={
                    ArrowRight02Icon as unknown as Parameters<
                      typeof HugeiconsIcon
                    >[0]["icon"]
                  }
                  size={14}
                  strokeWidth={2}
                  color="currentColor"
                  className="ml-0.5 inline"
                />
                <LinkPendingDot />
              </Link>
            </div>

            {hero ? (
              <div className="space-y-4">
                {/* Hero card */}
                <Link
                  href={`/subscriptions/${hero._id}`}
                  className="group relative block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span className="relative block rounded-lg">
                    <PendingWrap>
                      <ActionCard sub={hero} />
                    </PendingWrap>
                    <LinkPendingOverlay variant="card" />
                  </span>
                </Link>

                {/* Rest as compact rows */}
                {rest.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {hasUrgent ? "Also due this week" : "Also upcoming"}
                    </p>
                    <div className="space-y-2">
                      {rest.map((sub: Doc<"subscriptions">) => (
                        <Link
                          key={sub._id}
                          href={`/subscriptions/${sub._id}`}
                          className="group relative block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <span className="relative block rounded-md">
                            <PendingWrap>
                              <CompactAttentionRow sub={sub} />
                            </PendingWrap>
                            <LinkPendingOverlay variant="row" />
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
