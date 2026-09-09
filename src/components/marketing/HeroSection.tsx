"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HeroSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="overflow-hidden px-4 pt-16 pb-0 text-center md:px-8 md:pt-24">
      <div
        className={cn(
          "transition-all duration-700 ease-out motion-reduce:transition-none",
          mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        )}
      >
        <h1 className="mx-auto mt-0 max-w-4xl text-[clamp(1.875rem,4vw,3rem)] leading-[1.05] font-bold tracking-tight text-balance">
          Stop paying for subscriptions you&apos;ve forgotten
        </h1>
        <p className="mx-auto mt-5 max-w-[700px] text-base leading-relaxed text-muted-foreground md:text-lg">
          SubZero scans your Gmail for receipts and trials, warns you days
          before every renewal, and shows you exactly how to cancel.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/auth?mode=signup" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="h-13 w-full px-8 text-[15px] font-bold sm:w-auto"
            >
              Scan my inbox
            </Button>
          </Link>
          <Link href="/auth?mode=login" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="outline"
              className="h-13 w-full px-8 text-[15px] font-bold sm:w-auto"
            >
              Sign in
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative mx-auto -mt-2 w-full md:-mt-4">
        <div className="perspective-[1600px]">
          <div className="relative overflow-hidden rounded-xl bg-card  [transform:rotateX(14deg)] md:[transform:rotateX(38deg)]">
            <Image
              src="/images/dashboard.webp"
              alt="SubZero dashboard showing subscriptions that need attention before they renew"
              width={2414}
              height={1409}
              priority
              className="h-auto w-full"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 shadow-[inset_0_0_100px_50px_var(--background)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
