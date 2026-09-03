"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { sileo } from "sileo";
import { CompactAttentionRow } from "@/components/CompactAttentionRow";
import { AttentionHero } from "@/components/dashboard/AttentionHero";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
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
  const viewer = useQuery(api.users.getViewer);

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

  const activeCount = (all ?? []).filter(
    (s) => s.status !== "cancelled",
  ).length;

  const firstName =
    viewer?.name?.split(" ")[0] ?? viewer?.email?.split("@")[0] ?? null;

  return (
    <div className="w-full space-y-8">
      <ProcessingRows />
      {gmailStatus?.needsReauth && !gmailStatus?.connected && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px]">
          <span>
            Gmail needs reconnect — auto-watch paused. Reconnect to resume.
          </span>
          <Link
            href="/dashboard/connections"
            className="font-mono text-[11px] underline underline-offset-2"
          >
            Reconnect
          </Link>
        </div>
      )}
      {isLoading ? (
        <DashboardSkeleton />
      ) : (all?.length ?? 0) === 0 ? (
        /* ── Zero-state ── */
        <div className="space-y-8">
          <DashboardGreeting name={firstName} />
          <NoSubscriptionsState />
        </div>
      ) : (
        /* ── Populated state: greeting → overview → hero → list ── */
        <>
          <DashboardGreeting name={firstName} />

          <SummaryHeader
            items={displaySubs as Doc<"subscriptions">[]}
            attentionCount={urgentSubs.length}
            activeCount={activeCount}
          />

          {hero && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  {hasUrgent ? "Needs your attention" : "Coming up next"}
                </p>
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

              <Link
                href={`/subscriptions/${hero._id}`}
                className="group relative block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span className="relative block rounded-xl">
                  <PendingWrap>
                    <AttentionHero sub={hero} />
                  </PendingWrap>
                  <LinkPendingOverlay variant="card" />
                </span>
              </Link>
            </section>
          )}

          {rest.length > 0 && (
            <section className="space-y-4">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {hasUrgent ? "Upcoming" : "Also upcoming"}
              </p>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="divide-y divide-border/40">
                  {rest.map((sub: Doc<"subscriptions">) => (
                    <Link
                      key={sub._id}
                      href={`/subscriptions/${sub._id}`}
                      className="relative block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="relative block">
                        <PendingWrap>
                          <CompactAttentionRow sub={sub} />
                        </PendingWrap>
                        <LinkPendingOverlay variant="row" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
