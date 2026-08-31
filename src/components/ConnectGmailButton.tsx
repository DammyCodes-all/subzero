"use client";

import { useAuthToken } from "@convex-dev/auth/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

interface ConnectGmailButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function ConnectGmailButton({
  className,
  children,
}: ConnectGmailButtonProps) {
  const authToken = useAuthToken();

  const handleConnect = async () => {
    try {
      // POST the JWT so the server route can set an httpOnly cookie.
      if (authToken) {
        await fetch("/api/gmail/oauth", {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    } catch {}
    window.location.href = "/api/gmail/oauth";
  };

  return (
    <Button
      size="sm"
      onClick={handleConnect}
      className={
        className ??
        "gap-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
      }
    >
      <HugeiconsIcon
        icon={Add01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
        size={15}
        strokeWidth={2}
        color="currentColor"
      />
      {children ?? "Connect Gmail"}
    </Button>
  );
}
