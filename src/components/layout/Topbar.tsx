"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MailSearch01Icon,
  Menu01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { ScanEmailDialog } from "@/components/ScanEmailDialog";
import { ConnectGmailButton } from "@/components/ConnectGmailButton";

interface TopbarProps {
  onMobileMenuToggle: () => void;
}

export function Topbar({ onMobileMenuToggle }: TopbarProps) {
  const [scanDialogOpen, setScanDialogOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
        {/* Left section — mobile menu toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMobileMenuToggle}
            aria-label="Open menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden"
          >
            <HugeiconsIcon
              icon={Menu01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
              size={18}
              strokeWidth={1.8}
              color="currentColor"
            />
          </button>
        </div>

        {/* Right section — CTA actions */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScanDialogOpen(true)}
            className="h-8 gap-1.5 rounded-lg border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-secondary"
          >
            <HugeiconsIcon
              icon={MailSearch01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
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
        </div>
      </header>

      {/* Dialog for Email Scan CTA */}
      <ScanEmailDialog
        open={scanDialogOpen}
        onOpenChange={setScanDialogOpen}
      />
    </>
  );
}
