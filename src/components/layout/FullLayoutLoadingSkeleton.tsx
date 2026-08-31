"use client";

import { SidebarSkeleton, TopbarSkeleton } from "@/components/layout/LayoutSkeleton";
import { DashboardSkeleton } from "@/components/Skeleton";

export function FullLayoutLoadingSkeleton() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Desktop Sidebar Skeleton */}
      <div className="hidden md:flex">
        <SidebarSkeleton />
      </div>

      {/* Main View Area Skeleton */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopbarSkeleton />
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <DashboardSkeleton />
          </div>
        </main>
      </div>
    </div>
  );
}
