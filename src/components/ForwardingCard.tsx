"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon, Copy01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { ForwardingCardSkeleton } from "@/components/Skeleton";
import { api } from "../../convex/_generated/api";

export function ForwardingCard() {
  const inbox = useQuery(api.agentmail.getInbox);
  const getOrCreate = useMutation(api.agentmail.getOrCreateInbox);
  const [copied, setCopied] = useState(false);

  // Ensure the DB connection row exists so resolveUserByInbox can route.
  useEffect(() => {
    if (inbox === null) void getOrCreate({});
  }, [inbox, getOrCreate]);

  if (inbox === undefined) {
    return <ForwardingCardSkeleton />;
  }

  if (!inbox) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-transparent p-5">
        <h3 className="text-sm font-medium text-foreground">Forward any receipt</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Your forwarding address is being set up. Check back in a moment.
        </p>
      </div>
    );
  }

  const displayInbox = inbox;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(displayInbox);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-md border border-dashed border-border/60 bg-transparent p-4">
      <h3 className="text-sm font-medium text-foreground">Forward any receipt</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Send any subscription receipt here and it will appear in SubZero
        automatically.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-border bg-secondary px-3 py-2 font-mono text-[13px] font-medium tabular-nums text-foreground">
          {displayInbox}
        </code>
        <Button
          size="sm"
          className="h-9 shrink-0 gap-1.5 font-mono text-xs"
          onClick={() => void handleCopy()}
        >
          {copied ? (
            <>
              <HugeiconsIcon
                icon={CheckmarkCircle01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                size={14}
                strokeWidth={1.8}
                color="currentColor"
              />
              Copied
            </>
          ) : (
            <>
              <HugeiconsIcon
                icon={Copy01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                size={14}
                strokeWidth={1.8}
                color="currentColor"
              />
              Copy
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
