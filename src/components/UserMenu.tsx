"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (isLoading)
    return <span className="text-xs font-mono text-muted-foreground">...</span>;
  if (!isAuthenticated) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void signOut()}
      className="rounded-lg font-mono text-xs"
    >
      Sign out
    </Button>
  );
}
