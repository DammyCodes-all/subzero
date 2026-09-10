"use client";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./navigation";

interface SidebarSkeletonProps {
  collapsed?: boolean;
}

// Mirrors Sidebar.tsx: transparent 68px rail (or 232px panel) with no
// header/footer chrome — logo block, centered icon column, edge hairline.
export function SidebarSkeleton({ collapsed = true }: SidebarSkeletonProps) {
  return (
    <aside
      style={{ width: collapsed ? 68 : 232, flexShrink: 0 }}
      className="relative flex h-screen flex-col py-4"
      aria-hidden="true"
    >
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-r-2xl bg-transparent">
        {/* Edge hairline, same as the real rail */}
        <div className="absolute top-20 right-0 bottom-0 w-px bg-[linear-gradient(to_bottom,transparent_0%,var(--border)_15%,var(--border)_85%,transparent_100%)]" />

        {/* Logo block */}
        <div
          className={cn(
            "flex items-center pt-5 pb-2",
            collapsed ? "justify-center px-0" : "justify-between px-5",
          )}
        >
          {collapsed ? (
            <div className="h-[28px] w-[28px] animate-pulse rounded-lg bg-border/60" />
          ) : (
            <>
              <div className="h-5 w-32 animate-pulse rounded bg-border/60" />
              <div className="h-8 w-8 animate-pulse rounded-md bg-border/40" />
            </>
          )}
        </div>

        {/* Nav items — same count, spacing, and sizes as the real sidebar */}
        <div
          className={cn(
            "flex flex-1 flex-col",
            collapsed
              ? "items-center justify-center gap-6 overflow-visible"
              : "gap-1.5 overflow-y-auto pt-6 pb-6",
          )}
        >
          {NAV_ITEMS.map((item) =>
            collapsed ? (
              <div
                key={item.href}
                className="h-5 w-5 animate-pulse rounded bg-border/60"
              />
            ) : (
              <div
                key={item.href}
                className="flex h-11 items-center gap-3 px-5"
              >
                <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-border/60" />
                <div className="h-4 w-24 animate-pulse rounded bg-border/60" />
              </div>
            ),
          )}
        </div>
      </div>
    </aside>
  );
}

export function TopbarSkeleton() {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      {/* Mobile toggle skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-border/60 md:hidden" />
      </div>

      {/* Action buttons skeleton */}
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-24 animate-pulse rounded-lg bg-border/60" />
        <div className="h-8 w-32 animate-pulse rounded-lg bg-primary/40" />
      </div>
    </header>
  );
}
