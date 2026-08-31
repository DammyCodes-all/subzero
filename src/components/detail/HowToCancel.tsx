"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ExternalLinkIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { frictionLabel } from "@/lib/format";

type Sub = {
  merchant: string;
  product?: string;
  cancellationDifficulty?: string;
  cancellationMethod?: string;
  cancellationUrl?: string;
  billingProvider?: string;
};

type Action = {
  instructions?: string[];
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

  // Shared header: difficulty reasoning
  const difficultyBlock = difficulty ? (
    <p className="font-mono text-xs tabular-nums text-muted-foreground">
      {frictionLabel(difficulty)}
      {provider ? " · billed through provider" : ""}
    </p>
  ) : null;

  // Render per 6 types — spec: never invent route, but always a scannable list
  if (method === "open_provider" && provider) {
    const providerSteps = action?.instructions?.length
      ? action.instructions
      : [
          `Open ${provider} → Subscriptions`,
          `Find ${sub.merchant}${sub.product ? ` · ${sub.product}` : ""}`,
          "Tap Cancel subscription → Confirm",
          "Save the confirmation email — SubZero marks it cancelled",
        ];
    return (
      <div className="space-y-4">
        {difficultyBlock}
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm leading-relaxed text-foreground">
            Billed through <span className="font-medium">{provider}</span> — you
            need to cancel there, not on {sub.merchant}&apos;s site.
          </p>
          <ol className="mt-4 space-y-2.5">
            {providerSteps.map((step, i) => (
              <li
                key={`${i}-${step}`}
                className="flex gap-3 text-sm leading-relaxed"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex"
            >
              <Button className="gap-1.5 font-medium">
                Open {provider}
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
            <a
              href="https://play.google.com/store/account/subscriptions"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex"
            >
              <Button className="gap-1.5 font-medium">
                Open {provider}
                <HugeiconsIcon
                  icon={ExternalLinkIcon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                  size={14}
                  strokeWidth={1.8}
                  color="currentColor"
                  className="opacity-70"
                />
              </Button>
            </a>
          )}
        </div>
      </div>
    );
  }

  if (method === "open_web") {
    const steps = action?.instructions?.length
      ? action.instructions
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
          <p className="text-sm leading-relaxed text-foreground">
            Cancel directly on {sub.merchant}&apos;s site.
          </p>
          <ol className="mt-4 space-y-2.5">
            {steps.map((step, i) => (
              <li
                key={`${i}-${step}`}
                className="flex gap-3 text-sm leading-relaxed"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-muted-foreground break-all">
                  {step}
                </span>
              </li>
            ))}
          </ol>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex"
            >
              <Button className="gap-1.5 font-medium">
                Open cancellation
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
            <Button disabled variant="outline" size="sm" className="mt-5">
              No verified route yet
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (method === "send_email") {
    const steps = action?.instructions?.length
      ? action.instructions
      : [
          "Review the draft email SubZero prepared",
          "Send via SubZero (AgentMail)",
          "Keep the confirmation — SubZero marks it cancelled on reply",
        ];
    return (
      <div className="space-y-4">
        {difficultyBlock}
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm leading-relaxed text-foreground">
            This merchant accepts cancellation by email.
          </p>
          <ol className="mt-4 space-y-2.5">
            {steps.map((s, i) => (
              <li
                key={`${i}-${s}`}
                className="flex gap-3 text-sm leading-relaxed"
              >
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
            onClick={() => {
               // Use standard browser DOM event to trigger modal open from parent,
               // or better yet we can convert HowToCancel to use a local state.
               document.dispatchEvent(new CustomEvent("open-email-modal"));
            }}
          >
            Review &amp; send
          </Button>
        </div>
      </div>
    );
  }

  if (method === "contact_support") {
    const steps = action?.instructions?.length
      ? action.instructions
      : [
          url ? `Open support: ${url}` : "Open merchant support / Help center",
          `Request cancellation for ${sub.merchant}${sub.product ? ` · ${sub.product}` : ""}`,
          "Save the confirmation email",
        ];
    return (
      <div className="space-y-4">
        {difficultyBlock}
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm leading-relaxed text-foreground">
            Requires contacting support.
          </p>
          <ol className="mt-4 space-y-2.5">
            {steps.map((s, i) => (
              <li
                key={`${i}-${s}`}
                className="flex gap-3 text-sm leading-relaxed"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-muted-foreground break-all">
                  {s}
                </span>
              </li>
            ))}
          </ol>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex"
            >
              <Button variant="default" size="sm" className="gap-1.5">
                Contact support
                <HugeiconsIcon
                  icon={LinkExternal02Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                  size={14}
                  strokeWidth={1.8}
                  color="currentColor"
                  className="opacity-70"
                />
              </Button>
            </a>
          )}
        </div>
      </div>
    );
  }

  if (method === "manual") {
    const steps = action?.instructions?.length
      ? action.instructions
      : [
          "Settings → Account → Subscription",
          "Select Cancel → Confirm",
          "Save the confirmation",
        ];
    return (
      <div className="space-y-4">
        {difficultyBlock}
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm font-medium text-foreground">Steps</p>
          <ol className="mt-4 space-y-2.5">
            {steps.map((s, i) => (
              <li
                key={`${i}-${s}`}
                className="flex gap-3 text-sm leading-relaxed"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-muted-foreground">{s}</span>
              </li>
            ))}
          </ol>
          <Button variant="outline" size="sm" className="mt-5">
            View steps
          </Button>
        </div>
      </div>
    );
  }

  // unknown — critical per spec: never invent
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-border/60 bg-transparent p-5">
        <p className="text-sm font-medium text-foreground">
          No verified route yet
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          We couldn&apos;t verify a current cancellation path for {sub.merchant}
          . We won&apos;t guess — check the merchant&apos;s help center or
          contact support. This page updates when we find a verified source.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled
          className="mt-4 font-mono text-xs"
        >
          No verified route
        </Button>
      </div>
    </div>
  );
}
