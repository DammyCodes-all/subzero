"use client";

import { SubzeroMark } from "@/components/brand/SubzeroLogo";
import { ConnectGmailButton } from "@/components/ConnectGmailButton";
import { UserMenu } from "@/components/UserMenu";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between bg-background/80 px-4 backdrop-blur-md md:px-6">
      {/* Left — brand mark on mobile (nav lives in bottom bar) */}
      <div className="flex items-center gap-3">
        <span className="md:hidden" aria-hidden="true">
          <SubzeroMark size={24} className="h-6 w-6" />
        </span>
      </div>

      {/* Right section — CTA + account */}
      <div className="flex items-center gap-2.5">
        {/* Connect Gmail action */}
        <ConnectGmailButton className="h-8 gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
          <span className="hidden sm:inline">Connect Gmail</span>
        </ConnectGmailButton>

        <UserMenu />
      </div>
    </header>
  );
}
