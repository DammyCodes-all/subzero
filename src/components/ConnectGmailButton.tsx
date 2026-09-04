"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { useConnectGmail } from "@/hooks/useConnectGmail";

interface ConnectGmailButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function ConnectGmailButton({
  className,
  children,
}: ConnectGmailButtonProps) {
  const connectGmail = useConnectGmail();

  return (
    <Button
      size="sm"
      onClick={connectGmail}
      className={
        className ??
        "gap-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
      }
    >
      <HugeiconsIcon
        icon={
          Add01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]
        }
        size={15}
        strokeWidth={2}
        color="currentColor"
      />
      {children ?? "Connect Gmail"}
    </Button>
  );
}
