"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { DashboardSkeleton } from "@/components/Skeleton";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/auth");
  }, [isAuthenticated, isLoading, router]);
  if (isLoading)
    return (
      <div className="min-h-screen bg-background">
        <div className="h-14 border-b border-border bg-background" />
        <DashboardSkeleton />
      </div>
    );
  if (!isAuthenticated) return null;
  return <>{children}</>;
}
