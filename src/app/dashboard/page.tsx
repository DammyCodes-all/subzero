"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { api } from "../../../convex/_generated/api";

export default function Dashboard() {
  const all = useQuery(api.subscriptions.list);
  const attention = useQuery(api.subscriptions.needsAttention, {});
  const seed = useMutation(api.seed.seed);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seed({});
      setSeeded(true);
    } catch {
      setSeeded(true);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
          <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
            <span className="font-heading font-semibold">SubZero</span>
            <UserMenu />
          </div>
        </div>

        <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-heading font-bold tracking-tight">
              What needs your attention
            </h1>
            <p className="text-sm text-muted-foreground">
              Renewals in the next 7 days — act before you’re charged.
            </p>
          </div>

          <section className="space-y-3">
            {attention === undefined ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : attention.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-2 bg-card">
                <p className="text-sm text-muted-foreground">
                  Nothing due soon — you’re clear.
                </p>
              </div>
            ) : (
              attention.map((s) => {
                const days = s.nextRenewalAt
                  ? Math.max(
                      0,
                      Math.ceil(
                        (s.nextRenewalAt - Date.now()) / (24 * 60 * 60 * 1000),
                      ),
                    )
                  : null;
                const urgent = days !== null && days <= 2;
                return (
                  <div
                    key={s._id}
                    className="rounded-lg border p-4 bg-card hover:bg-[var(--card-hover)]"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{
                              background: urgent ? "#F2664B" : "#2DD4BF",
                            }}
                          />
                          <span className="font-heading font-medium">
                            {s.merchant}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded-full border border-border text-muted-foreground font-mono">
                            {s.cancellationDifficulty ?? "unknown"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {s.product ?? "Subscription"} ·{" "}
                          <span className="font-mono text-foreground">
                            ${s.price}
                          </span>
                          {s.billingProvider
                            ? ` · via ${s.billingProvider}`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`font-mono text-sm font-medium ${urgent ? "text-[#F2664B]" : "text-foreground"}`}
                        >
                          {days !== null ? `${days}d` : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {urgent ? "act now" : "tracked"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <div>
            <Button
              onClick={handleSeed}
              disabled={seeding || seeded}
              className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/80"
            >
              {seeded ? "Seeded ✓" : seeding ? "Seeding…" : "Seed 8 mocks"}
            </Button>
          </div>

          <h2 className="text-lg font-heading font-semibold">
            All subscriptions
          </h2>
          <div className="space-y-2">
            {all === undefined ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : all.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No subscriptions yet.
              </p>
            ) : (
              all.map((s) => (
                <div
                  key={s._id}
                  className="rounded-lg border border-border p-3 bg-card"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{s.merchant}</span>
                    <span className="text-sm font-mono text-muted-foreground">
                      ${s.price}/{s.billingInterval}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
