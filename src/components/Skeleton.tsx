// Shared loading skeletons — single source of truth for route loading.tsx
// (server) and in-component fallbacks (client).
// Pure static markup, intentionally no "use client" so route shells stay
// server-rendered. Each skeleton mirrors its view's real containers,
// spacing, and block counts so loading looks like the app, not a guess.

function Line({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-border/60 ${className ?? ""}`} />
  );
}

function Card({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`animate-pulse rounded-lg border bg-card ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/** "Good morning, Name" + date line (DashboardGreeting). */
function GreetingSkeleton() {
  return (
    <div className="space-y-1.5">
      <Line className="h-7 w-64" />
      <Line className="h-4 w-48" />
    </div>
  );
}

/** Typographic 3-metric strip (SummaryHeader) — borderless, hairline divide. */
function SummaryStripSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border/40">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-1.5 sm:px-6 sm:first:pl-0">
          <Line className="h-3 w-24" />
          <Line className="h-7 w-32" />
          <Line className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Receipt card shape (ActionCard): avatar + headline, price, CTA right. */
function ActionCardSkeleton() {
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-border/60" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Line className="h-5 w-40" />
              <Line className="h-3 w-24" />
            </div>
          </div>
          <Line className="mt-2 h-4 w-28" />
          <Line className="mt-2 h-3 w-36" />
        </div>
        <div className="flex w-full shrink-0 flex-row items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end">
          <Line className="h-3 w-20" />
          <Line className="h-8 w-28" />
        </div>
      </div>
    </Card>
  );
}

/** Mono uppercase section label row (dashboard list sections). */
function SectionLabelSkeleton({ className }: { className?: string }) {
  return <Line className={`h-3 w-44 ${className ?? ""}`} />;
}

/** Page title + subtitle + optional right-side control (subscriptions). */
function PageHeaderSkeleton({ withControl }: { withControl?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Line className="h-7 w-48" />
        <Line className="mt-1 h-4 w-80 max-w-full" />
      </div>
      {withControl && <Line className="h-9 w-20 shrink-0 self-start rounded-lg border border-border sm:self-auto" />}
    </div>
  );
}

/** Icon tile + section title (settings / connections section headers). */
function SectionHeaderSkeleton({ iconSize = "h-8 w-8" }: { iconSize?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`animate-pulse rounded-lg bg-primary/10 ${iconSize}`} />
      <Line className="h-5 w-36" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="w-full space-y-8">
      <GreetingSkeleton />
      <SummaryStripSkeleton />

      {/* Hero: label row + receipt card */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionLabelSkeleton />
          <Line className="h-4 w-16" />
        </div>
        <ActionCardSkeleton />
      </div>

      {/* Rest: label + divided rows */}
      <div className="space-y-4">
        <SectionLabelSkeleton className="w-28" />
        <div className="divide-y divide-border/40 border-t border-border/40">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="space-y-2">
                <Line className="h-4 w-32" />
                <Line className="h-3 w-24" />
              </div>
              <Line className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SubscriptionsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withControl />

      {/* Filter tabs + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5">
          {[64, 56, 52, 96, 72].map((w, i) => (
            <div
              key={i}
              style={{ width: w }}
              className="h-8 animate-pulse rounded-lg bg-card"
            />
          ))}
        </div>
        <Line className="h-8 w-full rounded-lg border border-input bg-card sm:w-64" />
      </div>

      {/* Card grid (default view, 8 per page) */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <ActionCardSkeleton key={i} />
        ))}
      </div>

      {/* Pagination footer */}
      <div className="flex flex-col gap-3 border-t border-border/40 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Line className="h-4 w-48" />
        <div className="flex items-center gap-2">
          <Line className="h-8 w-20" />
          <Line className="h-4 w-24" />
          <Line className="h-8 w-16" />
        </div>
      </div>
    </div>
  );
}

function SwitchRowSkeleton() {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div>
        <Line className="h-4 w-32" />
        <Line className="mt-1 h-3 w-52 max-w-full" />
      </div>
      <div className="h-5 w-9 shrink-0 animate-pulse rounded-full bg-border/60" />
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Line className="h-7 w-28" />
        <Line className="mt-1 h-4 w-80 max-w-full" />
      </div>

      {/* Notifications */}
      <section className="space-y-4">
        <SectionHeaderSkeleton />
        <div className="rounded-xl border border-border bg-card divide-y divide-border/40">
          <SwitchRowSkeleton />
          <SwitchRowSkeleton />
          <SwitchRowSkeleton />
          <SwitchRowSkeleton />
        </div>
        <div className="flex items-center gap-3">
          <Line className="h-8 w-32" />
          <Line className="h-4 w-56 max-w-full" />
        </div>
      </section>

      {/* Your Data */}
      <section className="space-y-4">
        <SectionHeaderSkeleton />
        <div className="rounded-xl border border-border bg-card p-5">
          <Line className="h-4 w-52" />
          <Line className="mt-1 h-3 w-full" />
          <Line className="mt-1 h-3 w-3/4" />
        </div>
      </section>

      {/* Data Export */}
      <section className="space-y-4">
        <SectionHeaderSkeleton />
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <Line className="h-4 w-48" />
              <Line className="mt-1 h-3 w-72 max-w-full" />
            </div>
            <Line className="h-8 w-32 shrink-0" />
          </div>
        </div>
      </section>

      {/* Notification History */}
      <section className="space-y-4">
        <SectionHeaderSkeleton />
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Line key={i} className="h-8" />
            ))}
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="space-y-4">
        <SectionHeaderSkeleton />
        <div className="rounded-xl border border-destructive/30 bg-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <Line className="h-4 w-56 max-w-full" />
              <Line className="mt-1 h-3 w-80 max-w-full" />
            </div>
            <Line className="h-8 w-32 shrink-0" />
          </div>
        </div>
      </section>
    </div>
  );
}

function InboxRowSkeleton() {
  return (
    <div className="rounded-lg border border-border/80 bg-background/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Line className="h-4 w-44" />
              <Line className="h-5 w-16 rounded-full" />
            </div>
            <Line className="mt-1.5 h-3 w-40" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Line className="h-8 w-24" />
          <Line className="h-8 w-20" />
        </div>
      </div>
    </div>
  );
}

export function ConnectionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Line className="h-7 w-40" />
          <Line className="mt-1 h-4 w-96 max-w-full" />
        </div>
      </div>
      <Line className="h-3 w-48 font-mono" />

      {/* Gmail section card */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="border-b border-border pb-4">
          <SectionHeaderSkeleton iconSize="h-9 w-9" />
          <Line className="mt-1 h-3 w-72 max-w-full" />
        </div>
        <InboxRowSkeleton />
        <InboxRowSkeleton />
        <p className="border-t border-border pt-3">
          <Line className="h-3 w-64" />
        </p>
      </section>

      {/* Forwarding card */}
      <ForwardingCardSkeleton />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      {/* Identity: avatar + merchant, product · price, renewal line */}
      <div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-border/60" />
          <Line className="h-7 w-52" />
        </div>
        <Line className="mt-2 h-4 w-64" />
        <Line className="mt-2 h-3 w-72 max-w-full" />
        <Line className="mt-3 h-3 w-40" />
      </div>

      {/* Primary action */}
      <div className="flex flex-wrap items-center gap-3">
        <Line className="h-9 w-40 rounded-lg" />
        <Line className="h-3 w-48" />
      </div>

      {/* How to cancel */}
      <section className="mt-10 space-y-3 border-t border-border/40 pt-8">
        <Line className="h-5 w-36" />
        <Card className="p-5">
          <div className="space-y-3">
            <Line className="h-4 w-full" />
            <Line className="h-4 w-full" />
            <Line className="h-4 w-3/4" />
          </div>
        </Card>
      </section>

      {/* Evidence */}
      <section className="mt-10 space-y-3 border-t border-border/40 pt-8">
        <Line className="h-5 w-44" />
        <Line className="h-4 w-full" />
        <Line className="h-4 w-3/4" />
        <div className="space-y-3">
          <Card className="h-28 w-full" />
          <Card className="h-24 w-full" />
        </div>
      </section>

      {/* Manage card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <Line className="h-4 w-40" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-primary/10" />
              <Line className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ForwardingCardSkeleton() {
  return (
    <div className="animate-pulse rounded-md border border-dashed border-border/60 bg-transparent p-5">
      <Line className="h-4 w-32" />
      <Line className="mt-2.5 h-3.5 w-full" />
      <div className="mt-4 flex items-center gap-2">
        <Line className="h-9 flex-1" />
        <Line className="h-8 w-16 shrink-0" />
      </div>
      <Line className="mt-2 h-3 w-48" />
    </div>
  );
}

export function ConnectionsAgentMailSkeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-3 rounded-lg border border-border/80 bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-muted" />
        <div>
          <Line className="h-4 w-48" />
          <Line className="mt-1.5 h-3 w-56" />
        </div>
      </div>
      <Line className="h-8 w-20" />
    </div>
  );
}
