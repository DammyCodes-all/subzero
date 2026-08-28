"use client";

import Link from "next/link";
import { UserMenu } from "./UserMenu";

export function Header() {
  return (
    <header className="h-14 border-b border-border bg-background">
      <div className="mx-auto flex h-full max-w-[680px] items-center justify-between px-6">
        <Link
          href="/"
          className="font-heading text-[17px] font-bold tracking-tight text-primary"
        >
          SubZero
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
