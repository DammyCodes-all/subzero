"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ActionCard } from "@/components/ActionCard";
import { AuthGuard } from "@/components/AuthGuard";
import { CompactAttentionRow } from "@/components/CompactAttentionRow";
import {
  NoSubscriptionsState,
  ZeroAttentionState,
} from "@/components/EmptyState";
import { Header } from "@/components/Header";
import { SubscriptionRow } from "@/components/SubscriptionRow";
import { SummaryStrip } from "@/components/SummaryStrip";
import { DashboardSkeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { api } from "../../../convex/_generated/api";

export default function Dashboard() {
  return (
    <AuthGuard>
      <DashboardInner />
    </AuthGuard>
  );
}

function DashboardInner() {
  const all = useQuery(api.subscriptions.list);
  const attention = useQuery(api.subscriptions.needsAttention, { days: 7 });
  const seed = useMutation(api.seed.seed);

  const isLoading = all === undefined || attention === undefined;

  // Compute summary only when loaded — total filtered to next 30d (Stripe pattern)
  const count = all?.length ?? 0;
  const attentionCount = attention?.length ?? 0;
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const total = all
    ? all
        .filter((s) => s.nextRenewalAt && s.nextRenewalAt <= now + thirtyDays)
        .reduce((sum, s) => sum + s.price, 0)
    : 0;

  // Sort all by nextRenewalAt ascending (nulls last)
  const sortedAll = all
    ? [...all].sort((a, b) => {
        if (!a.nextRenewalAt) return 1;
        if (!b.nextRenewalAt) return -1;
        return a.nextRenewalAt - b.nextRenewalAt;
      })
    : [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-[680px] px-6 py-10">
        {isLoading ? (
          <DashboardSkeleton />
        ) : count === 0 ? (
          <div className="space-y-8">
            <SummaryStrip count={0} total={0} attentionCount={0} />
            <NoSubscriptionsState />
            {process.env.NODE_ENV !== "production" && (
              <div className="flex justify-center pt-4">
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
          <div className="space-y-8">
            <SummaryStrip
              count={count}
              total={total}
              attentionCount={attentionCount}
            />

            {/* Needs Attention — hero zone */}
            <section className="space-y-6">
              <h1 className="font-heading text-[28px] font-bold leading-none tracking-tight md:text-[30px]">
                What needs your attention
              </h1>

              {attentionCount === 0 ? (
                <ZeroAttentionState />
              ) : (
                <div className="space-y-4">
                  {/* Hero — most urgent, full detail, sole solid chartreuse CTA */}
                  {(() => {
                    const list = attention ?? [];
                    const hero = list[0];
                    if (!hero) return null;
                    const rest = list.slice(1);
                    return (
                      <>
                        <Link
                          href={`/subscriptions/${hero._id}`}
                          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <ActionCard key={hero._id} sub={hero} />
                        </Link>
                        {rest.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs text-muted-foreground">
                              Also due this week
                            </p>
                            <div className="space-y-2">
                              {rest.map((sub) => (
                                <Link
                                  key={sub._id}
                                  href={`/subscriptions/${sub._id}`}
                                  className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                >
                                  <CompactAttentionRow sub={sub} />
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </section>

            {/* 48px breathing gap — editorial whitespace */}
            <div className="pt-3" />

            {/* All Subscriptions — plain list, no card */}
            <section className="space-y-3">
              <h2 className="font-heading text-base font-semibold tracking-tight">
                All subscriptions
              </h2>
              <div>
                {sortedAll.map((sub) => (
                  <Link
                    key={sub._id}
                    href={`/subscriptions/${sub._id}`}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <SubscriptionRow sub={sub} />
                  </Link>
                ))}
              </div>
            </section>

            {process.env.NODE_ENV !== "production" && (
              <div className="flex justify-center pt-6">
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
      </main>
    </div>
  );
}
