"use client";

import { useEffect, useState } from "react";
import { ShimmeringText } from "@/components/animate-ui/primitives/texts/shimmering";
import { BlackHoleScan } from "@/components/BlackHoleScan";

function useResponsiveScanSize() {
  const [size, setSize] = useState(260);
  useEffect(() => {
    const upd = () => {
      const w = window.innerWidth;
      if (w < 360) setSize(220);
      else if (w < 480) setSize(240);
      else if (w < 768) setSize(260);
      else if (w < 1280) setSize(280);
      else setSize(300);
    };
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);
  return size;
}

export function FirstScanView({
  email,
  foundCount,
  scanning = true,
  error = null,
  onRetry,
}: {
  email?: string;
  foundCount: number;
  scanning?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const size = useResponsiveScanSize();
  return (
    <div className="mx-auto max-w-2xl px-6 py-2 text-center sm:py-4">
      <div className="relative flex justify-center">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,_rgba(249,247,242,0.04)_0%,_transparent_68%)] blur-[16px]"
          style={{ width: size * 2.15, height: size * 1.32 }}
        />
        <BlackHoleScan
          size={size}
          isScanning={scanning}
          label="Scanning your Gmail…"
          sublabel={email}
        />
      </div>
      <div className="mt-4 flex flex-col items-center gap-1.5" role="status">
        <ShimmeringText
          text="Looking for subscription receipts and trials…"
          duration={1.8}
          color="var(--muted-foreground)"
          shimmeringColor="var(--foreground)"
          className="font-mono text-[11px] tracking-wide"
        />
        <ShimmeringText
          key={foundCount}
          text={`${foundCount} ${foundCount === 1 ? "receipt" : "receipts"} found`}
          duration={1.4}
          color="var(--foreground)"
          shimmeringColor="var(--muted-foreground)"
          className="font-mono text-xs font-medium"
        />
        {error ? (
          <div className="mt-2 flex flex-col items-center gap-2">
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              {error}
            </p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-secondary px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Try scan again
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
