"use client";

import Image from "next/image";
import { useState } from "react";

// Merchant identity mark in three states:
// - loading (favicon known): skeleton shimmer, same shape
// - loaded: real favicon, faded in
// - failed / unknown: initial-letter disc
export function MerchantAvatar({
  merchant,
  faviconUrl,
  size = 28,
}: {
  merchant: string;
  faviconUrl?: string | null;
  size?: number;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  const showImg = !!faviconUrl && status !== "failed";

  return (
    <span
      aria-hidden="true"
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-semibold text-foreground"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {showImg && status === "loading" && (
        <span className="absolute inset-0 animate-pulse rounded-full bg-border/60" />
      )}
      {(!faviconUrl || status === "failed") && merchant.charAt(0).toUpperCase()}
      {showImg && (
        <Image
          src={faviconUrl}
          alt=""
          width={size}
          height={size}
          unoptimized
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
          className={`absolute inset-0 h-full w-full bg-card object-cover transition-opacity ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </span>
  );
}
