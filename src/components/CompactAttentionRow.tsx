"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCountdownShort, formatPrice } from "@/lib/format";

type Sub = {
  _id: string;
  merchant: string;
  product?: string;
  price: number;
  currency: string;
  billingInterval: string;
  nextRenewalAt?: number;
  cancellationMethod?: string;
  cancellationUrl?: string;
  billingProvider?: string;
};

function getCompactCTA(sub: Sub) {
  const method = sub.cancellationMethod ?? "unknown";
  if (method === "open_web")
    return { label: "Open", href: sub.cancellationUrl };
  if (method === "open_provider")
    return { label: "Open", href: sub.cancellationUrl };
  if (method === "send_email") return { label: "Send", href: undefined };
  if (method === "contact_support")
    return { label: "Contact", href: sub.cancellationUrl };
  if (method === "manual") return { label: "Steps", href: undefined };
  return { label: "—", href: undefined, disabled: true };
}

export function CompactAttentionRow({ sub }: { sub: Sub }) {
  const cta = getCompactCTA(sub);
  const countdown = formatCountdownShort(sub.nextRenewalAt);

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border/60 bg-transparent px-3 py-2.5 hover:bg-card/50 hover:border-border transition-colors">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="truncate text-[13px] font-medium leading-none">
          {sub.merchant}
        </span>
        <span className="hidden sm:inline text-xs text-muted-foreground">
          ·
        </span>
        <span className="font-mono text-xs font-medium tabular-nums text-foreground hidden sm:inline">
          {formatPrice(sub.price, sub.currency, sub.billingInterval)}
        </span>
        <span className="font-mono text-xs font-medium tabular-nums text-foreground sm:hidden">
          {formatPrice(sub.price, sub.currency, sub.billingInterval)}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {countdown}
        </span>
        {cta.href ? (
          <a href={cta.href} target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              size="xs"
              className="h-6 gap-1 px-2 text-xs font-medium"
            >
              {cta.label}
              <ExternalLink className="size-3 opacity-60" />
            </Button>
          </a>
        ) : (
          <Button
            variant="outline"
            size="xs"
            disabled={cta.disabled}
            className="h-6 gap-1 px-2 text-xs font-medium"
          >
            {cta.label}
          </Button>
        )}
      </div>
    </div>
  );
}
