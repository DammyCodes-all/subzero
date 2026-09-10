"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LegalNavProps } from "./legal-types";

export function LegalDesktopNav({ sections, activeId }: LegalNavProps) {
  return (
    <aside className="hidden lg:block">
      <nav
        aria-label="On this page"
        className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto border-l border-border"
      >
        <ul className="space-y-0.5">
          {sections.map((s) => {
            const isActive = activeId === s.id;
            return (
              <li key={s.id}>
                <Link
                  href={`#${s.id}`}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "-ml-px block border-l-2 py-1.5 pr-2 pl-4 text-sm transition-colors",
                    isActive
                      ? "border-primary font-semibold text-foreground"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
