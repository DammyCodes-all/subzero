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
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="size-3 animate-pulse rounded-full bg-primary/60" />
      </div>
    );
  if (!isAuthenticated) return null;
  return <>{children}</>;
}
