"use client";

import { useState } from "react";
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

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
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
        <main className="flex-1 overflow-y-auto px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
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
