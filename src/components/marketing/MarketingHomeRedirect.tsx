"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Signed-in visitors should never sit on the marketing page: OAuth drops
// users at `/` when redirectTo isn't honored, and the static host's SPA
// fallback also serves `/` for unknown paths. Bounce them to the app.
export function MarketingHomeRedirect() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, isLoading, router]);
  return null;
}
