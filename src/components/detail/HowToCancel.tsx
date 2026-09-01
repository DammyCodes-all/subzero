"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ExternalLinkIcon } from "@hugeicons/core-free-icons";
import { Loading03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { openExternalUrl } from "@/lib/cancellation";
import { frictionLabel } from "@/lib/format";

type Sub = {
  merchant: string;
  product?: string;
  cancellationDifficulty?: string;
  cancellationMethod?: string;
  cancellationUrl?: string;
  billingProvider?: string;
  researchStatus?: string;
};

type Action = {
  instructions?: string[];
  status?: string;
};

export function HowToCancel({
  sub,
  action,
}: {
  sub: Sub;
  action?: Action | null;
}) {
  const method = sub.cancellationMethod ?? "unknown";
  const difficulty = sub.cancellationDifficulty;
  const provider = sub.billingProvider;
  const url = sub.cancellationUrl;
  const pending = sub.researchStatus === "pending";

  const difficultyBlock = difficulty ? (
    <p className="font-mono text-xs tabular-nums text-muted-foreground">
      {frictionLabel(difficulty)}
      {action?.instructions?.length ? ` · ${action.instructions.length} steps` : ""}
    </p>
  ) : null;

  if (pending) {
    return (
      <div className="space-y-4">
        {difficultyBlock}
        <div className="rounded-lg border border-dashed bg-card p-5 flex items-center gap-3">
          <HugeiconsIcon icon={Loading03Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]} size={16} strokeWidth={1.8} color="currentColor" className="animate-spin text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Researching cancellation route…</p>
            <p className="text-xs text-muted-foreground">Checking {sub.merchant} help center via Firecrawl. This takes ~5s.</p>
          </div>
        </div>
      </div>
    );
  }

  // Research output is source of truth — use it when present
  const hasResearchedSteps = !!(action?.instructions && action.instructions.length > 0);

  // open_provider — must cancel where billed (no hardcoded fallback URL; use verified url only)
  if (method === "open_provider" && provider) {
    const rawSteps = hasResearchedSteps
      ? action!.instructions!
      : [
          `Open ${provider} → Subscriptions`,
          `Find ${sub.merchant}${sub.product ? ` · ${sub.product}` : ""}`,
          "Tap Cancel subscription → Confirm",
          "Save the confirmation email. SubZero marks it cancelled",
        ];
    // Strip raw URLs from steps — URL is shown as button, not as step text
    const providerSteps = rawSteps
      .map((s) => s.replace(/https?:\/\/\S+/g, "").replace(/\s{2,}/g, " ").replace(/\s+at\s*$/i, "").trim())
      .filter(Boolean);
    const providerUrl = url ?? undefined;
    return (
      <div className="space-y-4">
        {difficultyBlock}
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm leading-relaxed text-foreground">
            This subscription is billed through <span className="font-medium">{provider}</span>. Cancel in {provider}, not on {sub.merchant}&apos;s site.
          </p>
          <ol className="mt-4 space-y-2.5">
            {providerSteps.map((step, i) => (
              <li key={`${i}-${step}`} className="flex gap-3 text-sm leading-relaxed">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
          {providerUrl ? (
            <Button
              className="mt-5 gap-1.5 font-medium"
              onClick={() => openExternalUrl(providerUrl, provider)}
            >
              Open {provider}
              <HugeiconsIcon
                icon={ExternalLinkIcon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                size={14}
                strokeWidth={1.8}
                color="currentColor"
                className="opacity-70"
              />
            </Button>
          ) : (
            <Button disabled variant="outline" size="sm" className="mt-5">
              No verified route yet
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (method === "open_web") {
    const steps = hasResearchedSteps
      ? action!.instructions!
      : [
          url ? `Open ${url}` : `Open ${sub.merchant} → Account`,
          "Sign in → Manage plan / Subscription",
          "Select Cancel plan",
          "Confirm cancellation and save confirmation",
        ];
    return (
      <div className="space-y-4">
        {difficultyBlock}
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm leading-relaxed text-foreground">Cancel directly on {sub.merchant}&apos;s site.</p>
          <ol className="mt-4 space-y-2.5">
            {steps.map((step, i) => (
              <li key={`${i}-${step}`} className="flex gap-3 text-sm leading-relaxed">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-muted-foreground break-all">{step}</span>
              </li>
            ))}
          </ol>
          {url ? (
            <Button
              className="mt-5 gap-1.5 font-medium"
              onClick={() => openExternalUrl(url, provider)}
            >
              Open cancellation
              <HugeiconsIcon
                icon={ExternalLinkIcon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                size={14}
                strokeWidth={1.8}
                color="currentColor"
                className="opacity-70"
              />
            </Button>
          ) : (
            <Button disabled variant="outline" size="sm" className="mt-5">
              No verified route yet
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (method === "send_email") {
    const steps = hasResearchedSteps
      ? action!.instructions!
      : [
          "Review the draft email SubZero prepared",
          "Send via SubZero (AgentMail)",
          "Keep the confirmation. SubZero marks it cancelled on reply",
        ];
    return (
      <div className="space-y-4">
        {difficultyBlock}
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm leading-relaxed text-foreground">This merchant accepts cancellation by email.</p>
          <ol className="mt-4 space-y-2.5">
            {steps.map((s, i) => (
              <li key={`${i}-${s}`} className="flex gap-3 text-sm leading-relaxed">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-muted-foreground">{s}</span>
              </li>
            ))}
          </ol>
          <Button
            variant="default"
            size="sm"
            className="mt-5 font-medium"
            onClick={() => document.dispatchEvent(new CustomEvent("open-email-modal"))}
          >
            Review &amp; send
          </Button>
          {url && <p className="mt-2 font-mono text-xs text-muted-foreground break-all">{url}</p>}
        </div>
      </div>
    );
  }

  if (method === "contact_support") {
    const steps = hasResearchedSteps
      ? action!.instructions!
      : [
          url ? `Open support: ${url}` : "Open merchant support / Help center",
          `Request cancellation for ${sub.merchant}${sub.product ? ` · ${sub.product}` : ""}`,
          "Save the confirmation email",
        ];
    return (
      <div className="space-y-4">
        {difficultyBlock}
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm leading-relaxed text-foreground">Requires contacting support.</p>
          <ol className="mt-4 space-y-2.5">
            {steps.map((s, i) => (
              <li key={`${i}-${s}`} className="flex gap-3 text-sm leading-relaxed">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-muted-foreground break-all">{s}</span>
              </li>
            ))}
          </ol>
          {url && (
            <Button
              variant="default"
              size="sm"
              className="mt-5 gap-1.5"
              onClick={() => openExternalUrl(url, provider)}
            >
              Contact support
              <HugeiconsIcon
                icon={ExternalLinkIcon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                size={14}
                strokeWidth={1.8}
                color="currentColor"
                className="opacity-70"
              />
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (method === "manual") {
    const steps = hasResearchedSteps ? action!.instructions! : ["Settings → Account → Subscription", "Select Cancel → Confirm", "Save the confirmation"];
    return (
      <div className="space-y-4">
        {difficultyBlock}
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm font-medium text-foreground">Steps</p>
          <ol className="mt-4 space-y-2.5">
            {steps.map((s, i) => (
              <li key={`${i}-${s}`} className="flex gap-3 text-sm leading-relaxed">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-muted-foreground">{s}</span>
              </li>
            ))}
          </ol>
          {url ? (
            <Button
              variant="default"
              size="sm"
              className="mt-5 gap-1.5"
              onClick={() => openExternalUrl(url, provider)}
            >
              View steps
              <HugeiconsIcon
                icon={ExternalLinkIcon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                size={14}
                strokeWidth={1.8}
                color="currentColor"
                className="opacity-70"
              />
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="mt-5" disabled>
              View steps
            </Button>
          )}
        </div>
      </div>
    );
  }

  // unknown — never invent
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-border/60 bg-transparent p-5">
        <p className="text-sm font-medium text-foreground">No verified route yet</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          We could not verify a current cancellation path for {sub.merchant}. We will not guess. Check the merchant help center or contact support. This page updates when we find a verified source.
        </p>
        <Button variant="outline" size="sm" disabled className="mt-4 font-mono text-xs">
          No verified route
        </Button>
      </div>
    </div>
  );
}
