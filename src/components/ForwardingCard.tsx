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
  const connections = useQuery(api.connections.getMyConnections);
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
  const googleEmails = (connections ?? [])
    .filter((c) => c.provider === "google" && c.status === "connected")
    .map((c) => c.accountEmail)
    .filter((e): e is string => Boolean(e));

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
    <div className="rounded-md border border-dashed border-border/60 bg-transparent p-5">
      <h3 className="text-sm font-medium text-foreground">Forward any receipt</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Forward any subscription receipt or trial email to your personal address. SubZero extracts it and adds evidence.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-secondary px-2.5 py-2 font-mono text-xs tabular-nums text-foreground">
          {displayInbox}
        </code>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 font-mono text-xs shrink-0"
          onClick={() => void handleCopy()}
        >
          {copied ? (
            <>
              <HugeiconsIcon
                icon={CheckmarkCircle01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                size={14}
                strokeWidth={1.8}
                color="currentColor"
                className="text-primary"
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
      {googleEmails.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Set up forwarding from each connected account so SubZero can monitor it:
          </p>
          {googleEmails.map((email) => (
            <div key={email} className="flex items-center gap-2 font-mono text-[11px]">
              <HugeiconsIcon
                icon={CheckmarkCircle01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                size={12}
                strokeWidth={1.8}
                color="currentColor"
                className="text-primary/70"
              />
              <span className="truncate text-foreground/80">{email}</span>
              <span className="text-muted-foreground/70">→ {displayInbox}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        Works with any email client. Same pipeline as Gmail — with evidence.
      </p>
    </div>
  );
}
