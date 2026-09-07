"use client";

import {
  AiMagicIcon,
  ArrowRight02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { sileo } from "sileo";
import { ActionCard } from "@/components/ActionCard";
import { ShimmeringText } from "@/components/animate-ui/primitives/texts/shimmering";
import { BlackHoleScan } from "@/components/BlackHoleScan";
import { CompactAttentionRow } from "@/components/CompactAttentionRow";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import {
  NoSubscriptionsState,
  ZeroAttentionState,
} from "@/components/EmptyState";
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
  const [previewFirstScan, setPreviewFirstScan] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);
  const [previewScanSize, setPreviewScanSize] = useState(260);
  useEffect(() => {
    const upd = () => {
      const w = window.innerWidth;
      if (w < 360) setPreviewScanSize(220);
      else if (w < 480) setPreviewScanSize(240);
      else if (w < 768) setPreviewScanSize(260);
      else if (w < 1280) setPreviewScanSize(280);
      else setPreviewScanSize(300);
    };
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

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

  useEffect(() => {
    if (!previewFirstScan) return;
    setPreviewCount(0);
    const id = setInterval(() => {
      setPreviewCount((c) => (c >= 9 ? c : c + (Math.random() < 0.55 ? 1 : 0)));
    }, 1200);
    return () => clearInterval(id);
  }, [previewFirstScan]);

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

  const now = Date.now();
  const trialCount = (all ?? []).filter(
    (s) =>
      s.status !== "cancelled" &&
      s.trialEndsAt !== undefined &&
      s.trialEndsAt > now,
  ).length;

  const paceItems = (all ?? []).filter((s) => s.status !== "cancelled");

  const firstName =
    viewer?.name?.split(" ")[0] ?? viewer?.email?.split("@")[0] ?? null;

  if (previewFirstScan) {
    return (
      <div className="w-full space-y-8">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setPreviewFirstScan(false)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-secondary px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <HugeiconsIcon
              icon={Cancel01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
              size={12}
              strokeWidth={1.8}
              color="currentColor"
            />
            Exit preview
          </button>
        </div>
        <div className="flex flex-col gap-4 py-2">
          <DashboardGreeting name={firstName} />
          <div className="mx-auto max-w-2xl px-6 py-2 text-center sm:py-4">
            <div className="relative flex justify-center">
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,_rgba(249,247,242,0.04)_0%,_transparent_68%)] blur-[16px]"
                style={{ width: previewScanSize * 2.15, height: previewScanSize * 1.32 }}
              />
              <BlackHoleScan
                size={previewScanSize}
                isScanning
                label="Scanning your Gmail…"
                sublabel={gmailStatus?.accountEmail ?? undefined}
              />
            </div>
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <ShimmeringText
                text="Looking for subscription receipts and trials…"
                duration={1.8}
                color="var(--muted-foreground)"
                shimmeringColor="var(--foreground)"
                className="font-mono text-[11px] tracking-wide"
              />
              <ShimmeringText
                key={previewCount}
                text={`${previewCount} ${previewCount === 1 ? "receipt" : "receipts"} found`}
                duration={1.4}
                color="var(--foreground)"
                shimmeringColor="var(--muted-foreground)"
                className="font-mono text-xs font-medium"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setPreviewFirstScan(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-card px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          title="Preview the first-scan black-hole state"
        >
          <HugeiconsIcon
            icon={AiMagicIcon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
            size={12}
            strokeWidth={1.8}
            color="currentColor"
            className="text-primary"
          />
          Preview first scan
        </button>
      </div>
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
        <div className="flex flex-col gap-4 py-2">
          <DashboardGreeting name={firstName} />
          <NoSubscriptionsState />
        </div>
      ) : (
        /* ── Populated state: greeting → overview → hero → list ── */
        <>
          <DashboardGreeting name={firstName} />

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
