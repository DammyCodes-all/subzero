"use client";

import Link from "next/link";
import { SubzeroWithWordmark } from "@/components/brand/SubzeroLogo";
import { ConnectGmailButton } from "@/components/ConnectGmailButton";
import { UserMenu } from "@/components/UserMenu";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between bg-background/80 px-4 backdrop-blur-md md:px-6">
      {/* Left — wordmark on mobile (nav lives in bottom bar) */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          aria-label="SubZero dashboard"
          className="md:hidden"
        >
          <SubzeroWithWordmark className="h-6 w-auto" width={120} height={27} />
        </Link>
      </div>

      {/* Right section — CTA + account */}
      <div className="flex items-center gap-2.5">
        {/* Connect Gmail action */}
        <ConnectGmailButton className="h-8 gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
          <span className="hidden sm:inline">Connect Gmail</span>
        </ConnectGmailButton>

        <div aria-hidden="true" className="h-5 w-px bg-border" />

        <UserMenu />
      </div>
    </header>
  );
}
