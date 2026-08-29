"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "../../convex/_generated/api";

export function ForwardingCard() {
  const inbox = useQuery(api.agentmail.getInbox);
  const getOrCreate = useMutation(api.agentmail.getOrCreateInbox);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleCopy(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select
      setCopied(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      await getOrCreate({});
    } finally {
      setCreating(false);
    }
  }

  if (inbox === undefined) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-transparent p-5">
        <div className="h-4 w-32 animate-pulse rounded bg-border/60" />
        <div className="mt-3 h-8 w-full animate-pulse rounded bg-border/60" />
      </div>
    );
  }

  if (inbox === null) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-transparent p-5">
        <h3 className="text-sm font-medium text-foreground">
          Forward any receipt
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Don&apos;t want Gmail connected? Forward to your SubZero address and
          it appears here with evidence.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 font-mono text-xs"
          onClick={() => void handleCreate()}
          disabled={creating}
        >
          {creating ? "Creating..." : "Generate your address"}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-dashed border-border/60 bg-transparent p-5">
      <h3 className="text-sm font-medium text-foreground">
        Forward any receipt
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Forward any subscription receipt or trial email to your personal
        address. SubZero extracts it and adds evidence.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-secondary px-2.5 py-2 font-mono text-xs tabular-nums text-foreground">
          {inbox}
        </code>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 font-mono text-xs shrink-0"
          onClick={() => void handleCopy(inbox)}
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
