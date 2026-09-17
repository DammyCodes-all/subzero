"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "sileo";
import { IngestionToasts } from "@/components/ingestion/IngestionToasts";
import { MobileBottomBar } from "@/components/layout/MobileBottomBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export function DashboardLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  // The <main> scroller stays mounted across /dashboard/* routes, and Next
  // only auto-scrolls window — not nested overflow containers. Without this,
  // sidebar navigation keeps the previous page's scrollTop, so Settings can
  // open mid-page and the bottom Danger Zone card looks missing. Reset to top
  // on every route change; late-growing Convex sections below then expand
  // downward from a known position instead of stranding content below the fold.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground supports-[height:100dvh]:h-dvh">
      {/* Desktop Sidebar — 68px rail collapsed, 232px expanded */}
      <div className="hidden md:flex">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Main View Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8"
        >
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Bar */}
      <MobileBottomBar />

      <Toaster position="top-right" theme="dark" />
      <IngestionToasts />
    </div>
  );
}
