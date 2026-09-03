"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MerchantAvatar } from "@/components/MerchantAvatar";
import { daysUntil, formatPrice } from "@/lib/format";
import { merchantFaviconUrl } from "@/lib/merchantFavicon";

type Sub = {
  _id: string;
  merchant: string;
  product?: string;
  price: number;
  currency: string;
  billingInterval: string;
  nextRenewalAt?: number;
  cancellationUrl?: string;
};

function countdownLabel(ts?: number): string {
  const d = daysUntil(ts);
  if (d === null) return "—";
  if (d <= 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `In ${d} days`;
}

// Upcoming-list row — lives inside the single list container, separated by
// hairlines. Initial disc for identity, price and countdown in Lato, arrow
// that wakes lime on hover.
export function CompactAttentionRow({ sub }: { sub: Sub }) {
  const price = formatPrice(sub.price, sub.currency, sub.billingInterval);
  const countdown = countdownLabel(sub.nextRenewalAt);

  return (
    <div className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 rounded-lg px-1 py-4 transition-colors hover:bg-white/[0.02] sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_120px_16px] sm:gap-x-6">
      <div className="flex min-w-0 items-center gap-3">
        <MerchantAvatar
          merchant={sub.merchant}
          faviconUrl={merchantFaviconUrl(sub)}
          size={28}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {sub.merchant}
          </p>
          <p className="font-numeric mt-1 text-[13px] tabular-nums leading-none text-muted-foreground sm:hidden">
            {price}
          </p>
        </div>
      </div>
      <p className="font-numeric hidden text-right text-sm tabular-nums text-foreground sm:block">
        {price}
      </p>
      <p className="font-numeric hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
        {countdown}
      </p>
      <span className="flex items-center gap-2">
        <span className="font-numeric text-xs tabular-nums text-muted-foreground sm:hidden">
          {countdown}
        </span>
        <HugeiconsIcon
          icon={
            ArrowRight02Icon as unknown as Parameters<
              typeof HugeiconsIcon
            >[0]["icon"]
          }
          size={14}
          strokeWidth={2}
          color="currentColor"
          className="shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary"
        />
      </span>
    </div>
  );
}
