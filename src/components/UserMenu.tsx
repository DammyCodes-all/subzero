"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.users.getViewer);

  if (isLoading)
    return <span className="text-xs font-mono text-muted-foreground">...</span>;
  if (!isAuthenticated) return null;

  const label = viewer?.name ?? viewer?.email ?? null;

  return (
    <div className="flex items-center gap-2">
      {label && <span className="hidden sm:inline text-xs text-muted-foreground max-w-[14ch] truncate">{label}</span>}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void signOut()}
        className="rounded-lg font-mono text-xs"
      >
        Sign out
      </Button>
    </div>
  );
}
