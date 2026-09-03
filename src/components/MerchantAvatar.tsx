"use client";

import { useState } from "react";

// Merchant identity mark — real favicon when we have one, initial-letter
// disc otherwise (and while loading / on error, with no layout shift).
export function MerchantAvatar({
  merchant,
  faviconUrl,
  size = 28,
}: {
  merchant: string;
  faviconUrl?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      aria-hidden="true"
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-semibold text-foreground"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {merchant.charAt(0).toUpperCase()}
      {faviconUrl && !failed && (
        <img
          src={faviconUrl}
          alt=""
          loading="lazy"
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full bg-card object-cover"
        />
      )}
    </span>
  );
}
