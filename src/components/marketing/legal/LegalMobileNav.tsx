"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LegalNavProps } from "./legal-types";

export function LegalMobileNav({ sections, activeId }: LegalNavProps) {
  return (
    <nav
      aria-label="On this page"
      className="sticky top-16 z-30 -mx-4 mt-8 border-y border-border bg-background/90 px-4 py-3 backdrop-blur-md lg:hidden"
    >
      <div className="flex gap-2 overflow-x-auto">
        {sections.map((s) => (
          <Link
            key={s.id}
            href={`#${s.id}`}
            aria-current={activeId === s.id ? "true" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              activeId === s.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
