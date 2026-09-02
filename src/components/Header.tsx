"use client";

import Link from "next/link";
import { ScanEmailDialog } from "./ScanEmailDialog";
import { UserMenu } from "./UserMenu";
import { LinkPendingDot, PendingWrap } from "@/components/ui/LinkPending";
import { SubzeroMark } from "@/components/brand/SubzeroLogo";

export function Header() {
  return (
    <header className="h-14 border-b border-border bg-background">
      <div className="mx-auto flex h-full max-w-[680px] items-center justify-between px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 font-heading text-[17px] font-bold tracking-tight text-primary"
        >
          <SubzeroMark size={28} className="h-7 w-7" />
          <PendingWrap>SubZero</PendingWrap>
          <LinkPendingDot />
        </Link>
        <div className="flex items-center gap-3">
          <ScanEmailDialog />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

