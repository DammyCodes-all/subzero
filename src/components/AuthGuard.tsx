"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/auth");
  }, [isAuthenticated, isLoading, router]);
  if (isLoading)
    return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}
