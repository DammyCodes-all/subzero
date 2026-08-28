"use client";

import { useQuery } from "convex/react";
import { AuthGuard } from "@/components/AuthGuard";
import { api } from "../../../convex/_generated/api";

export default function Dashboard() {
  const all = useQuery(api.subscriptions.list);
  const attention = useQuery(api.subscriptions.needsAttention, {});

  return (
    <AuthGuard>
      <main className="min-h-screen p-8 space-y-8 bg-background">
        <h1 className="text-2xl font-heading font-bold">
          What needs your attention
        </h1>
        <section className="space-y-3">
          {attention === undefined ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : attention.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing due soon — you’re clear.
            </p>
          ) : (
            attention.map((s) => (
              <div
                key={s._id}
                className="rounded-lg border border-border p-4 bg-card"
              >
                <div className="flex justify-between">
                  <span className="font-medium">{s.merchant}</span>
                  <span className="font-mono text-sm">${s.price}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {s.product ?? ""} — {s.cancellationDifficulty ?? "unknown"}
                  {s.billingProvider ? ` · via ${s.billingProvider}` : ""}
                </p>
              </div>
            ))
          )}
        </section>

        <h2 className="text-lg font-heading font-semibold">
          All subscriptions
        </h2>
        <section className="space-y-2">
          {all === undefined ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            all.map((s) => (
              <div
                key={s._id}
                className="rounded-lg border border-border p-3 bg-card"
              >
                <span className="font-medium">{s.merchant}</span>
                <span className="ml-2 text-sm text-muted-foreground font-mono">
                  ${s.price}/{s.billingInterval}
                </span>
              </div>
            ))
          )}
        </section>
      </main>
    </AuthGuard>
  );
}
