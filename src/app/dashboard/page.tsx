"use client";

import { AuthGuard } from "@/components/AuthGuard";

export default function Dashboard() {
  return (
    <AuthGuard>
      <main className="min-h-screen p-8 space-y-8 bg-background">
        <h1 className="text-2xl font-heading font-bold">
          What needs your attention
        </h1>
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Nothing due soon — you’re clear.
          </p>
        </section>

        <h2 className="text-lg font-heading font-semibold">
          All subscriptions
        </h2>
        <section className="space-y-2">
          <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
        </section>
      </main>
    </AuthGuard>
  );
}
