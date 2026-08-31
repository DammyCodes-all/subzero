"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { FullLayoutLoadingSkeleton } from "@/components/layout/FullLayoutLoadingSkeleton";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/auth");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return <FullLayoutLoadingSkeleton />;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}
