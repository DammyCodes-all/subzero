"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { api } from "../../convex/_generated/api";

const FALLBACK_INBOX = "subzero-agent@agentmail.to";

export function ForwardingCard() {
  const inbox = useQuery(api.agentmail.getInbox);
  const getOrCreate = useMutation(api.agentmail.getOrCreateInbox);
  const [copied, setCopied] = useState(false);

  // Ensure the DB connection row exists so resolveUserByInbox can route.
  useEffect(() => {
    if (inbox === null) void getOrCreate({});
  }, [inbox, getOrCreate]);

  // Use the inbox from the query (set from env.AGENTMAIL_INBOX), fallback to default.
  const displayInbox = inbox ?? FALLBACK_INBOX;

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
              <Check className="size-3.5 text-primary" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              Copy
            </>
          )}
        </Button>
      </div>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        Works with any email client. Same pipeline as Gmail — with evidence.
      </p>
    </div>
  );
}
