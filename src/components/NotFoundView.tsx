"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { LinkPendingDot, PendingWrap } from "@/components/ui/LinkPending";

export function NotFoundView() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-6 text-center text-foreground">
      {/* Decorative zero background tag */}
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-border bg-card shadow-2xl">
        <HugeiconsIcon
          icon={Search01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
          size={44}
          strokeWidth={1.5}
          color="currentColor"
          className="text-primary"
        />
        <div className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary font-heading text-xs font-bold text-primary-foreground">
          404
        </div>
      </div>

      {/* Main headings */}
      <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The link you followed might be broken, or the page may have been moved or deleted.
      </p>

      {/* Primary navigation CTA */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/dashboard" className="inline-flex">
          <Button size="sm" className="h-9 gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            <HugeiconsIcon
              icon={ArrowLeft02Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
              size={16}
              strokeWidth={1.8}
              color="currentColor"
            />
            <PendingWrap>Back to Dashboard</PendingWrap>
            <LinkPendingDot />
          </Button>
        </Link>
      </div>
    </div>
  );
}
