"use client";

import { ExternalLinkIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MerchantAvatar } from "@/components/MerchantAvatar";
import { Button } from "@/components/ui/button";
import { getCancellationCTA, openExternalUrl } from "@/lib/cancellation";
import {
  displayNames,
  formatPrice,
  frictionLabel,
  isUrgent,
  urgencyLabel,
} from "@/lib/format";
import { merchantFaviconUrl } from "@/lib/merchantFavicon";

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

export function ActionCard({
  sub,
  evidence,
  quiet = false,
}: {
  sub: Sub;
  evidence?: string;
  // Quiet mode: nothing needs doing today, so drop the prominent CTA and
  // let the card read as information, not an alarm.
  quiet?: boolean;
}) {
  const cta = getCancellationCTA(sub);
  const urgent = isUrgent(sub.nextRenewalAt) || isUrgent(sub.trialEndsAt);
  const badge = urgencyLabel(sub.nextRenewalAt, sub.trialEndsAt);
  const { title, subtitle } = displayNames(sub.merchant, sub.product);

  return (
    <div
      className={`rounded-lg border bg-card hover:bg-[var(--card-hover)] overflow-hidden transition-colors ${quiet ? "p-5" : "p-6"} ${urgent ? "border-l border-l-destructive/70" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          {/* Product owns the headline — it's what users recognize.
              Merchant drops to the subtitle, only when different. */}
          <div className="flex items-center gap-3">
            <MerchantAvatar
              merchant={sub.merchant}
              faviconUrl={merchantFaviconUrl(sub)}
              size={32}
            />
            <div className="min-w-0">
              <h3
                className={`truncate font-heading font-bold leading-none tracking-tight ${quiet ? "text-[17px]" : "text-[19px]"}`}
              >
                {title}
              </h3>
              {subtitle && (
                <p className="mt-1 truncate text-xs leading-none text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {/* Price · billing route — one line */}
          <p className="mt-2 text-sm leading-none">
            <span className="font-numeric text-[14px] font-semibold tabular-nums tracking-tight text-foreground">
              {formatPrice(sub.price, sub.currency, sub.billingInterval)}
            </span>
            {sub.billingProvider && (
              <span className="text-xs text-muted-foreground">
                {" "}
                via {sub.billingProvider}
              </span>
            )}
          </p>
          {/* Cancel effort — badge owns the date, so no duplication here */}
          {sub.cancellationDifficulty && (
            <p className="mt-2 text-xs leading-none text-muted-foreground">
              {frictionLabel(sub.cancellationDifficulty)}
            </p>
          )}
          {/* Evidence excerpt — the closest thing to "what this gets you"
              until extraction captures a description field */}
          {evidence && (
            <div className="mt-3">
              <p className="text-xs leading-relaxed text-muted-foreground line-clamp-1">
                {evidence}
              </p>
            </div>
          )}
        </div>
        {/* CTA — sole solid chartreuse, bottom-right */}
        <div className="flex shrink-0 flex-col items-end justify-between self-stretch">
          {badge && (
            <span className="font-mono text-xs font-medium tabular-nums tracking-wide text-muted-foreground">
              {badge}
            </span>
          )}
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
