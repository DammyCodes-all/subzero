"use client";

import { Cancel01Icon, Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { SubzeroWithWordmark } from "@/components/brand/SubzeroLogo";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, isLoading } = useConvexAuth();

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
        <Link
          href="/"
          aria-label="SubZero home"
          className="inline-flex items-center"
        >
          <SubzeroWithWordmark width={110} height={36} />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isLoading ? (
            <span
              aria-hidden="true"
              className="h-7 w-36 animate-pulse rounded-lg bg-border/60"
            />
          ) : isAuthenticated ? (
            <Link href="/dashboard">
              <Button size="sm">Go to dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/auth?mode=login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/auth?mode=signup">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
        >
          <HugeiconsIcon
            icon={(open ? Cancel01Icon : Menu01Icon) as never}
            size={20}
            color="currentColor"
          />
        </button>
      </div>

      {open && (
        <nav
          aria-label="Mobile"
          className="border-t border-border px-4 py-4 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 flex gap-2 border-t border-border pt-3">
              {isLoading ? (
                <span
                  aria-hidden="true"
                  className="h-7 w-full animate-pulse rounded-lg bg-border/60"
                />
              ) : isAuthenticated ? (
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex-1"
                >
                  <Button size="sm" className="w-full">
                    Go to dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth?mode=login"
                    onClick={() => setOpen(false)}
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      Sign in
                    </Button>
                  </Link>
                  <Link
                    href="/auth?mode=signup"
                    onClick={() => setOpen(false)}
                    className="flex-1"
                  >
                    <Button size="sm" className="w-full">
                      Get started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
