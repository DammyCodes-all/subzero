"use client";

import { MailSearch01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { SubzeroMark } from "@/components/brand/SubzeroLogo";
import { ConnectGmailButton } from "@/components/ConnectGmailButton";
import { ScanEmailDialog } from "@/components/ScanEmailDialog";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/button";

export function Topbar() {
  const [scanDialogOpen, setScanDialogOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
        {/* Left — brand mark on mobile (nav lives in bottom bar) */}
        <div className="flex items-center gap-3">
          <span className="md:hidden" aria-hidden="true">
            <SubzeroMark size={24} className="h-6 w-6" />
          </span>
        </div>

        {/* Right section — CTA actions + account */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScanDialogOpen(true)}
            className="h-8 gap-1.5 rounded-lg border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-secondary"
          >
            <HugeiconsIcon
              icon={
                MailSearch01Icon as unknown as Parameters<
                  typeof HugeiconsIcon
                >[0]["icon"]
              }
              size={15}
              strokeWidth={1.8}
              color="currentColor"
            />
            <span>Scan Email</span>
          </Button>

          {/* Connect Gmail action */}
          <ConnectGmailButton className="h-8 gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            <span className="hidden sm:inline">Connect Gmail</span>
          </ConnectGmailButton>

          <UserMenu />
        </div>
      </header>

      {/* Dialog for Email Scan CTA */}
      <ScanEmailDialog open={scanDialogOpen} onOpenChange={setScanDialogOpen} />
    </>
  );
}
