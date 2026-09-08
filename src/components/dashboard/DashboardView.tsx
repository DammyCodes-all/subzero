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
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import {
  NoSubscriptionsState,
  ZeroAttentionState,
} from "@/components/EmptyState";
import { FirstScanSummary } from "@/components/ingestion/FirstScanSummary";
import { FirstScanView } from "@/components/ingestion/FirstScanView";
import { ProcessingRows } from "@/components/ingestion/ProcessingRows";
import { DashboardSkeleton } from "@/components/Skeleton";
import { SummaryHeader } from "@/components/SummaryHeader";
import {
  LinkPendingDot,
  LinkPendingOverlay,
  PendingWrap,
} from "@/components/ui/LinkPending";
import { useFirstScan } from "@/hooks/useFirstScan";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";

export function DashboardView() {
  const attention = useQuery(api.subscriptions.needsAttention, { days: 7 });
  const all = useQuery(api.subscriptions.list);
  const gmailStatus = useQuery(api.gmail.getGmailStatus);
  const viewer = useQuery(api.users.getViewer);
  const subCount = all?.length ?? 0;
  const {
    showFullFirstScan,
    showFirstSummary,
    dismissSummary,
    showScanBanner,
    scanning: firstScanScanning,
    scanError: firstScanError,
    retry: retryFirstScan,
    email: scanEmail,
    foundCount: scanCount,
  } = useFirstScan({ gmailStatus, subCount });

  const dataLoading = attention === undefined || all === undefined;
  const statusLoading = gmailStatus === undefined;

  const searchParams = useSearchParams();
  const router = useRouter();
  const gmailError = searchParams.get("gmail_error");
  const gmailConnected = searchParams.get("gmail_connected");
  const gmailCancelled = searchParams.get("gmail_cancelled");

  useEffect(() => {
    if (gmailCancelled) {
      sileo.info({
        title: "Connection cancelled",
        description: "No problem. You can connect Gmail any time.",
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("gmail_error");
      url.searchParams.delete("gmail_connected");
      url.searchParams.delete("gmail_cancelled");
      router.replace(
        url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash,
        { scroll: false },
      );
    } else if (gmailError) {
      sileo.error({
        title: "Couldn't connect Gmail",
        description: gmailError,
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("gmail_error");
      url.searchParams.delete("gmail_connected");
      url.searchParams.delete("gmail_cancelled");
      router.replace(
        url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash,
        { scroll: false },
      );
    } else if (gmailConnected) {
      sileo.success({
        title: "Gmail connected",
        description:
          "Scanning your inbox for subscription receipts and trial emails now.",
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("gmail_error");
      url.searchParams.delete("gmail_connected");
      url.searchParams.delete("gmail_cancelled");
      router.replace(
        url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash,
        { scroll: false },
      );
    }
  }, [gmailError, gmailConnected, gmailCancelled, router]);

  // Determine what to show in the sub list:
  // - Urgent items (renewing ≤7d) if any exist
  // - Otherwise the 3 closest upcoming renewals
  const urgentSubs = (attention ?? []).filter((s) => s.hidden !== true);
  const hasUrgent = urgentSubs.length > 0;

  const fallbackSubs = hasUrgent
    ? []
    : [...(all ?? [])]
        .filter(
          (s) =>
            s.status !== "cancelled" && s.hidden !== true && s.nextRenewalAt,
        )
        .sort((a, b) => (a.nextRenewalAt ?? 0) - (b.nextRenewalAt ?? 0))
        .slice(0, 3);

  const displaySubs = hasUrgent ? urgentSubs : fallbackSubs;
  const hero = displaySubs[0];
  const rest = displaySubs.slice(1);

  const activeCount = (all ?? []).filter(
    (s) => s.status !== "cancelled" && s.hidden !== true,
  ).length;

  const now = Date.now();
  const trialCount = (all ?? []).filter(
    (s) =>
      s.status !== "cancelled" &&
      s.hidden !== true &&
      s.trialEndsAt !== undefined &&
      s.trialEndsAt > now,
  ).length;

  const paceItems = (all ?? []).filter(
    (s) => s.status !== "cancelled" && s.hidden !== true,
  );

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
      {dataLoading ? (
        <DashboardSkeleton />
      ) : statusLoading && subCount === 0 ? (
        /* Status pending and nothing to show yet — avoid mockup flash. */
        <DashboardSkeleton />
      ) : showFullFirstScan || showFirstSummary ? (
        /* ── First scan owns the screen until lastGmailScanAt is set.
            Latched to zero-sub start so streaming receipts don't unmount
            it mid-scan (previously flipped to populated on first sub).
            On a productive first scan, hands off once to the results
            summary instead of dropping straight into the dashboard. ── */
        <div className="flex flex-col gap-4 py-2">
          <DashboardGreeting name={firstName} />
          {showFirstSummary ? (
            <FirstScanSummary
              total={activeCount}
              needCount={urgentSubs.length}
              topSubs={displaySubs.slice(0, 2)}
              moreCount={Math.max(0, activeCount - 2)}
              onShowMe={dismissSummary}
            />
          ) : (
            <FirstScanView
              email={scanEmail ?? undefined}
              foundCount={scanCount}
              scanning={firstScanScanning}
              error={firstScanError}
              onRetry={retryFirstScan}
            />
          )}
        </div>
      ) : subCount === 0 ? (
        /* ── Zero-state ── */
        <div className="flex flex-col gap-4 py-2">
          <DashboardGreeting name={firstName} />
          <NoSubscriptionsState />
        </div>
      ) : (
        /* ── Populated state: greeting → overview → hero → list ── */
        <>
          <DashboardGreeting name={firstName} />

          {showScanBanner ? (
            <div
              className="flex items-center gap-3 rounded-lg border border-dashed bg-card px-4 py-3"
              role="status"
            >
              <span
                className="size-2 shrink-0 rounded-full bg-primary animate-pulse"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">
                  {firstScanError
                    ? "This scan needs another try"
                    : `Scanning ${scanEmail ?? "new inbox"} for receipts… ${scanCount} found so far`}
                </p>
                {firstScanError ? (
                  <p className="text-xs text-muted-foreground">
                    {firstScanError}
                  </p>
                ) : null}
              </div>
              {firstScanError ? (
                <button
                  type="button"
                  onClick={retryFirstScan}
                  className="ml-auto shrink-0 rounded-full border border-white/[0.08] bg-secondary px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Try again
                </button>
              ) : null}
            </div>
          ) : null}

          <SummaryHeader
            paceItems={paceItems as Doc<"subscriptions">[]}
            attentionCount={urgentSubs.length}
            activeCount={activeCount}
            trialCount={trialCount}
          />

          {hero && (
            <section className="space-y-4">
              {!hasUrgent && <ZeroAttentionState />}
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
                className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <ActionCard sub={hero} quiet={!hasUrgent} />
              </Link>
            </section>
          )}

          {rest.length > 0 && (
            <section className="space-y-4">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {hasUrgent ? "Upcoming" : "Also upcoming"}
              </p>
              <div className="divide-y divide-border/40 border-t border-border/40">
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
            </section>
          )}
        </>
      )}
    </div>
  );
}
