"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { DashboardLayoutShell } from "@/components/layout/DashboardLayoutShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <DashboardLayoutShell>{children}</DashboardLayoutShell>
    </AuthGuard>
  );
}
