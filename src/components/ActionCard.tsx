"use client";

import { ExternalLinkIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { getCancellationCTA, openExternalUrl } from "@/lib/cancellation";
import { merchantFaviconUrl } from "@/lib/merchantFavicon";
import { MerchantAvatar } from "@/components/MerchantAvatar";
import {
  formatPrice,
  formatRenewalDate,
  frictionLabel,
  isUrgent,
} from "@/lib/format";

type Sub = {
  _id: string;
  merchant: string;
  product?: string;
  price: number;
  currency: string;
  billingInterval: string;
  nextRenewalAt?: number;
  trialEndsAt?: number;
  cancellationDifficulty?: string;
  cancellationMethod?: string;
  cancellationUrl?: string;
  billingProvider?: string;
  researchStatus?: string;
};

export function ActionCard({ sub, evidence }: { sub: Sub; evidence?: string }) {
  const cta = getCancellationCTA(sub);
  const urgent = isUrgent(sub.nextRenewalAt) || isUrgent(sub.trialEndsAt);

  return (
    <div
      className={`rounded-lg border bg-card p-6 hover:bg-[var(--card-hover)] overflow-hidden transition-colors ${urgent ? "border-l border-l-destructive/70" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          {/* Merchant — editorial, owns weight */}
          <div className="flex items-center gap-3">
            <MerchantAvatar
              merchant={sub.merchant}
              faviconUrl={merchantFaviconUrl(sub)}
              size={32}
            />
            <h3 className="truncate font-heading text-[19px] font-bold leading-none tracking-tight">
              {sub.merchant}
            </h3>
          </div>
          {/* Product · price — collapsed to one line, denser */}
          <p className="mt-2 text-sm leading-none">
            <span className="text-xs text-muted-foreground">
              {sub.product ?? "Subscription"} ·{" "}
            </span>
            <span className="font-numeric text-[14px] font-semibold tabular-nums tracking-tight text-foreground">
              {formatPrice(sub.price, sub.currency, sub.billingInterval)}
            </span>
          </p>
          {/* Renew date + friction — single line, no duplicate countdown */}
          <p className="mt-2 text-xs leading-none text-muted-foreground">
            Renews {formatRenewalDate(sub.nextRenewalAt)}
            {sub.cancellationDifficulty && (
              <>
                <span className="mx-1.5 text-muted-foreground">·</span>
                <span>{frictionLabel(sub.cancellationDifficulty)}</span>
              </>
            )}
          </p>
          {/* Evidence / provider — only when present */}
          {(evidence || sub.billingProvider) && (
            <div className="mt-3">
              {evidence ? (
                <p className="text-xs leading-relaxed text-muted-foreground line-clamp-1">
                  {evidence}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Billed through {sub.billingProvider}
                </p>
              )}
            </div>
          )}
        </div>
        {/* CTA — sole solid chartreuse, bottom-right */}
        <div className="flex shrink-0 flex-col items-end justify-between self-stretch">
          <span className="font-mono text-xs font-medium tabular-nums tracking-wide text-muted-foreground">
            {urgent ? "Action needed" : "Due soon"}
          </span>
          {cta.href ? (
            <Button
              variant={cta.variant}
              size="sm"
              className="gap-1.5 font-medium"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openExternalUrl(cta.href!, sub.billingProvider);
              }}
            >
              {cta.label}
              <HugeiconsIcon
                icon={
                  ExternalLinkIcon as unknown as Parameters<
                    typeof HugeiconsIcon
                  >[0]["icon"]
                }
                size={14}
                strokeWidth={1.8}
                color="currentColor"
                className="opacity-70"
              />
            </Button>
          ) : (
            <Button
              variant={cta.variant}
              size="sm"
              disabled={(cta as { disabled?: boolean }).disabled}
              className="gap-1.5 font-medium"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {cta.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
