"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ActionCard } from "@/components/ActionCard";
import { CompactAttentionRow } from "@/components/CompactAttentionRow";
import { NoSubscriptionsState } from "@/components/EmptyState";
import { DashboardSkeleton } from "@/components/Skeleton";
import { SummaryHeader } from "@/components/SummaryHeader";
import { ProcessingRows } from "@/components/ingestion/ProcessingRows";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";

export function DashboardView() {
  const attention = useQuery(api.subscriptions.needsAttention, { days: 7 });
  const all = useQuery(api.subscriptions.list);
  const seed = useMutation(api.seed.seed);

  const isLoading = attention === undefined || all === undefined;

  // Gmail OAuth banner state
  const searchParams = useSearchParams();
  const router = useRouter();
  const gmailError = searchParams.get("gmail_error");
  const gmailConnected = searchParams.get("gmail_connected");

  useEffect(() => {
    if (gmailError || gmailConnected) {
      const t = setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete("gmail_error");
        url.searchParams.delete("gmail_connected");
        router.replace(
          url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash,
          { scroll: false },
        );
      }, 8000);
      return () => clearTimeout(t);
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
      {/* Gmail OAuth banners */}
      {gmailError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-sm font-medium text-destructive">
            Couldn&apos;t connect Gmail
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {gmailError}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-7 text-xs"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete("gmail_error");
              url.searchParams.delete("gmail_connected");
              router.replace(
                url.pathname +
                  (url.search ? `?${url.searchParams}` : "") +
                  url.hash,
                { scroll: false },
              );
            }}
          >
            Dismiss
          </Button>
        </div>
      )}
      {gmailConnected && !gmailError && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3">
          <p className="text-sm font-medium text-green-700 dark:text-green-300">
            Gmail connected
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Scanning your inbox for receipts and trials…
          </p>
        </div>
      )}

      {isLoading ? (
        <DashboardSkeleton />
      ) : (all?.length ?? 0) === 0 ? (
        /* ── Zero-state ── */
        <div className="space-y-8">
          <SummaryHeader subscriptions={[]} attentionCount={0} />
          <NoSubscriptionsState />
          {process.env.NODE_ENV !== "production" && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={() => void seed({})}
              >
                Seed 8 mocks (dev)
              </Button>
            </div>
          )}
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
                className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
                <HugeiconsIcon
                  icon={ArrowRight02Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                  size={14}
                  strokeWidth={2}
                  color="currentColor"
                  className="ml-0.5 inline"
                />
              </Link>
            </div>

            {hero ? (
              <div className="space-y-4">
                {/* Hero card */}
                <Link
                  href={`/dashboard/subscriptions/${hero._id}`}
                  className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <ActionCard sub={hero} />
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
                          href={`/dashboard/subscriptions/${sub._id}`}
                          className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <CompactAttentionRow sub={sub} />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : null}
          </section>

          {process.env.NODE_ENV !== "production" && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={() => void seed({})}
              >
                Seed 8 mocks (dev)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
