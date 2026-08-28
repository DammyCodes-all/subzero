"use client";

import { useMutation, useQuery } from "convex/react";
import { ActionCard } from "@/components/ActionCard";
import { AuthGuard } from "@/components/AuthGuard";
import { CompactAttentionRow } from "@/components/CompactAttentionRow";
import {
  NoSubscriptionsState,
  ScanningState,
  ZeroAttentionState,
} from "@/components/EmptyState";
import { Header } from "@/components/Header";
import { SubscriptionRow } from "@/components/SubscriptionRow";
import { SummaryStrip } from "@/components/SummaryStrip";
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

  // Compute summary only when loaded
  const count = all?.length ?? 0;
  const attentionCount = attention?.length ?? 0;
  const total = all ? all.reduce((sum, s) => sum + s.price, 0) : 0;

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
      <main className="mx-auto max-w-[680px] px-6 py-8">
        {isLoading ? (
          <ScanningState />
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
          <div className="space-y-7">
            <SummaryStrip
              count={count}
              total={total}
              attentionCount={attentionCount}
            />

            {/* Needs Attention — hero zone */}
            <section className="space-y-4">
              <div>
                <h1 className="font-heading text-[28px] font-bold leading-none tracking-tight md:text-[30px]">
                  What needs your attention
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Renewals in the next 7 days
                </p>
              </div>

              {attentionCount === 0 ? (
                <ZeroAttentionState />
              ) : (
                <div className="space-y-3">
                  {/* Hero — most urgent, full detail, sole solid chartreuse CTA */}
                  {(() => {
                    const list = attention ?? [];
                    const hero = list[0];
                    if (!hero) return null;
                    const rest = list.slice(1);
                    return (
                      <>
                        <ActionCard
                          key={hero._id}
                          sub={hero}
                          evidence={
                            hero.merchant === "Adobe"
                              ? "Renews Sep 3 — Source: Adobe email “Your trial ends September 3, 2026…”"
                              : undefined
                          }
                        />
                        {rest.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs font-mono text-muted-foreground">
                              Also due this week
                            </p>
                            <div className="space-y-2">
                              {rest.map((sub) => (
                                <CompactAttentionRow key={sub._id} sub={sub} />
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

            {/* 48px breathing gap */}
            <div className="pt-5" />

            {/* All Subscriptions — dense quiet list */}
            <section className="space-y-4">
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                All subscriptions
              </h2>
              <div className="space-y-2">
                {sortedAll.map((sub) => (
                  <SubscriptionRow key={sub._id} sub={sub} />
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
