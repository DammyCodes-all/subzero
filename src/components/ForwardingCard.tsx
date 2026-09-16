"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon, Copy01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { ForwardingCardSkeleton } from "@/components/Skeleton";
import { api } from "../../convex/_generated/api";

export function ForwardingCard() {
  const inbox = useQuery(api.agentmail.getInbox);
  const getOrCreate = useMutation(api.agentmail.getOrCreateInbox);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ensure the DB connection row exists so resolveUserByInbox can route.
  useEffect(() => {
    if (inbox === null) void getOrCreate({});
  }, [inbox, getOrCreate]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  if (inbox === undefined) {
    return <ForwardingCardSkeleton />;
  }

  if (!inbox) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
        <h3 className="text-sm font-medium text-foreground">Forward any receipt</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Your forwarding address is being set up. Check back in a moment.
        </p>
      </div>
    );
  }

  const displayInbox = inbox;

  function flagCopied() {
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(displayInbox);
      flagCopied();
    } catch {
      // Clipboard API unavailable (permissions, insecure context). Fall back.
      try {
        const ta = document.createElement("textarea");
        ta.value = displayInbox;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        flagCopied();
      } catch {
        setCopied(false);
      }
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
      <h3 className="text-sm font-medium text-foreground">Forward any receipt</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Send any subscription receipt here and it will appear in SubZero
        automatically.
      </p>
      <div className="mt-3 flex min-w-0 items-center gap-2">
        <code className="h-9 min-w-0 flex-1 truncate rounded-md border border-border bg-secondary px-3 py-2 font-mono text-[12px] font-medium tabular-nums text-foreground sm:text-[13px]">
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
