"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SidebarSkeletonProps {
  collapsed?: boolean;
}

export function SidebarSkeleton({ collapsed = false }: SidebarSkeletonProps) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      className={cn(
        "relative flex h-screen flex-col border-r border-border bg-card",
        collapsed ? "overflow-visible" : "overflow-hidden",
      )}
      style={{ flexShrink: 0 }}
    >
      {/* Brand Header Skeleton */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-border transition-all",
          collapsed ? "justify-center px-0" : "justify-between px-4",
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-border/60" />
            <div className="h-4 w-20 animate-pulse rounded bg-border/60" />
          </div>
        )}
        <div className="h-8 w-8 animate-pulse rounded-lg bg-border/40" />
      </div>

      {/* Nav List Skeleton */}
      <div className="flex flex-1 flex-col gap-1.5 p-3 pt-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              "flex h-[42px] items-center gap-3 rounded-lg px-3.5",
              collapsed && "justify-center px-0 w-full",
            )}
          >
            <div className="h-[18px] w-[18px] shrink-0 animate-pulse rounded bg-border/60" />
            {!collapsed && (
              <div className="h-4 w-24 animate-pulse rounded bg-border/60" />
            )}
          </div>
        ))}
      </div>

      {/* Footer Sign-out Skeleton */}
      <div className="border-t border-border p-3">
        <div
          className={cn(
            "flex h-[42px] w-full items-center gap-3 rounded-lg px-3.5",
            collapsed && "justify-center px-0",
          )}
        >
          <div className="h-[18px] w-[18px] shrink-0 animate-pulse rounded bg-border/60" />
          {!collapsed && (
            <div className="h-4 w-16 animate-pulse rounded bg-border/60" />
          )}
        </div>
      </div>
    </motion.aside>
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
