"use client";

import { useQuery } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ExternalLinkIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { EvidenceBlock } from "@/components/detail/EvidenceBlock";
import { HowToCancel } from "@/components/detail/HowToCancel";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { formatPrice, formatRenewalDate, isUrgent, needsAttention } from "@/lib/format";
import { useEffect, useState } from "react";
import { ReviewAndSendModal } from "@/components/detail/ReviewAndSendModal";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

function DetailInner() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsModalOpen(true);
    document.addEventListener("open-email-modal", handleOpen);
    return () => document.removeEventListener("open-email-modal", handleOpen);
  }, []);
  const params = useParams<{ id: string }>();
  const id = params.id as Id<"subscriptions">;

  const sub = useQuery(api.subscriptions.get, { id });
  const evidence = useQuery(api.evidence.getBySubscription, {
    subscriptionId: id,
  });

  if (sub === undefined || evidence === undefined) {
    return (
      <div className="mx-auto max-w-[680px] px-6 py-10">
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="h-4 w-28 rounded bg-border/60" />
          <div className="h-7 w-48 rounded bg-border" />
          <div className="h-20 rounded-lg border bg-card" />
        </div>
      </div>
    );
  }

  if (sub === null) {
    return (
      <div className="mx-auto max-w-[680px] px-6 py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← All subscriptions
        </Link>
        <div className="mt-8 rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium">Subscription not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been removed or you don&apos;t have access.
          </p>
          <Link href="/dashboard" className="mt-4 inline-block">
            <Button variant="outline" size="sm">
              Back to dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const urgent = isUrgent(sub.nextRenewalAt) || isUrgent(sub.trialEndsAt);
  const attention = needsAttention(sub.nextRenewalAt) || needsAttention(sub.trialEndsAt);
  const cta = getDetailCTA(sub);

  return (
    <div className="mx-auto max-w-[680px] px-6 py-10">
      {/* Back — spatial consistency: same path out as in */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← All subscriptions
      </Link>

      {/* Identity — editorial, owns weight (Emil: unseen details compound) */}
      <div className="mt-6 space-y-6">
        <div>
          <h1 className="font-heading text-[28px] font-bold leading-none tracking-tight md:text-[30px]">
            {sub.merchant}
          </h1>
          <p className="mt-2 text-sm leading-none">
            <span className="text-xs text-muted-foreground">
              {sub.product ?? "Subscription"} ·{" "}
            </span>
            <span className="font-mono text-[14px] font-semibold tabular-nums tracking-tight text-foreground">
              {formatPrice(sub.price, sub.currency, sub.billingInterval)}
            </span>
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs leading-none text-muted-foreground">
            <span>Renews {formatRenewalDate(sub.nextRenewalAt)}</span>
            {sub.cancellationDifficulty && (
              <>
                <span className="text-muted-foreground">·</span>
                <span>
                  {sub.cancellationDifficulty === "very_high"
                    ? "Very high friction"
                    : sub.cancellationDifficulty === "high"
                      ? "High friction"
                      : sub.cancellationDifficulty === "medium"
                        ? "Medium friction"
                        : "Low friction"}
                </span>
              </>
            )}
            {sub.billingProvider && (
              <>
                <span className="text-muted-foreground">·</span>
                <span>Billed through {sub.billingProvider}</span>
              </>
            )}
          </p>
          {/* Single signal: urgency as muted mono, not red fill (calm until urgent) */}
          {attention && (
            <p className="mt-3 font-mono text-xs font-medium tabular-nums tracking-wide text-muted-foreground">
              {urgent ? "Action needed" : "Due soon"}
            </p>
          )}
        </div>

        {/* Primary action — sole solid chartreuse (restraint) */}
        <div className="flex flex-wrap items-center gap-3">
          {cta.href ? (
            <a href={cta.href} target="_blank" rel="noopener noreferrer">
              <Button className="gap-1.5 font-medium">
                {cta.label}
                <HugeiconsIcon
                  icon={ExternalLinkIcon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                  size={14}
                  strokeWidth={1.8}
                  color="currentColor"
                  className="opacity-70"
                />
              </Button>
            </a>
          ) : (
            <Button
              variant={cta.variant}
              disabled={cta.disabled}
              className="font-medium"
              onClick={() => {
                if (sub.cancellationMethod === "send_email") {
                  document.dispatchEvent(new CustomEvent("open-email-modal"));
                }
              }}
            >
              {cta.label}
            </Button>
          )}
          <span className="font-mono text-xs text-muted-foreground">
            {cta.helper}
          </span>
        </div>
      </div>

      {/* How to cancel — progressive disclosure, one level deeper (Apple: Simplicity) */}
      <section className="mt-10 space-y-3 border-t border-border/40 pt-8">
        <h2 className="font-heading text-base font-semibold tracking-tight">
          How to cancel
        </h2>
        <HowToCancel sub={sub} />
      </section>

      {/* Evidence — why we believe it (spec: if we can't back it, don't show it) */}
      <section className="mt-10 space-y-3 border-t border-border/40 pt-8">
        <h2 className="font-heading text-base font-semibold tracking-tight">
          Why we believe this
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Every field keeps its source. If we say you renew on a date, you see
          the email and help page it came from.
        </p>
        <EvidenceBlock evidence={evidence as never} />
      </section>

      {/* Footer — calm, no trap (Apple: Wayfinding) */}
      <div className="mt-10 flex justify-center border-t border-border/40 pt-6">
        <Link
          href="/dashboard"
          className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to dashboard →
        </Link>
      </div>

      {isModalOpen && (
        <ReviewAndSendModal
          subscriptionId={sub._id}
          merchant={sub.merchant}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}

function getDetailCTA(sub: {
  cancellationMethod?: string;
  cancellationUrl?: string;
  billingProvider?: string;
}) {
  const m = sub.cancellationMethod ?? "unknown";
  if (m === "open_web" && sub.cancellationUrl)
    return {
      label: "Open cancellation",
      href: sub.cancellationUrl,
      variant: "default" as const,
      helper: "Opens merchant site in new tab",
    };
  if (m === "open_web")
    return {
      label: "Open cancellation",
      variant: "default" as const,
      helper: "",
    };
  if (m === "open_provider")
    return {
      label: `Open ${sub.billingProvider ?? "provider"}`,
      href: sub.cancellationUrl,
      variant: "default" as const,
      helper: "Cancel where you were billed",
    };
  if (m === "send_email")
    return {
      label: "Review & send",
      variant: "default" as const,
      helper: "Draft sent via SubZero",
    };
  if (m === "contact_support")
    return {
      label: "Contact support",
      href: sub.cancellationUrl,
      variant: "default" as const,
      helper: "Requires support request",
    };
  if (m === "manual")
    return {
      label: "View steps",
      variant: "outline" as const,
      helper: "Manual steps below",
    };
  return {
    label: "No verified route",
    variant: "outline" as const,
    disabled: true,
    helper: "We'll update when verified",
  };
}

export default function SubscriptionDetailPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Header />
        <DetailInner />
      </div>
    </AuthGuard>
  );
}
