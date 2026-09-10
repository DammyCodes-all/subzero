"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { CheckmarkCircle01Icon, Copy01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { sileo } from "sileo";
import { ConnectGmailButton } from "@/components/ConnectGmailButton";
import { Button } from "@/components/ui/button";
import {
  GOOGLE_OAUTH_REDIRECT,
  markGoogleOAuthAttempt,
} from "@/lib/googleAuth";
import { scanResultCopy } from "@/lib/scanCopy";
import { api } from "../../convex/_generated/api";

async function copyInbox(inbox: string, setCopied: (v: boolean) => void) {
  try {
    await navigator.clipboard.writeText(inbox);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    setCopied(false);
  }
}

export function ZeroAttentionState() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-6 text-center">
      <HugeiconsIcon
        icon={
          CheckmarkCircle01Icon as unknown as Parameters<
            typeof HugeiconsIcon
          >[0]["icon"]
        }
        size={16}
        strokeWidth={1.8}
        color="currentColor"
        className="shrink-0 text-primary"
      />
      <p className="text-sm font-medium text-primary">
        You&apos;re all caught up. Nothing renews this week.
      </p>
    </div>
  );
}

export function NoSubscriptionsState() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();

  if (isLoading) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-10 text-center">
        <div className="mx-auto h-5 w-40 animate-pulse rounded bg-border/60" />
      </div>
    );
  }

  // Authenticated but empty — empty state owns Gmail work (button inside card).
  if (isAuthenticated) {
    return <AuthenticatedEmptyState />;
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-2 text-center sm:py-4">
      <Image
        src="/mail-mockup.png"
        alt="Mailbox syncing Gmail"
        width={768}
        height={512}
        priority
        className="mx-auto h-auto max-h-[30vh] w-auto max-w-full"
      />
      <h3 className="mt-4 font-heading text-xl font-semibold tracking-tight sm:text-2xl">
        No subscriptions yet
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Connect your Google account and SubZero will find your subscriptions for
        you.
      </p>
      <Button
        className="mt-4 font-medium"
        onClick={() => {
          markGoogleOAuthAttempt();
          void signIn("google", { redirectTo: GOOGLE_OAUTH_REDIRECT });
        }}
      >
        Connect Google
      </Button>
    </div>
  );
}

function AuthenticatedEmptyState() {
  const status = useQuery(api.gmail.getGmailStatus);
  const inbox = useQuery(api.agentmail.getInbox);
  const scan = useAction(api.gmailManualScan.scanGmail);
  const getOrCreateInbox = useMutation(api.agentmail.getOrCreateInbox);
  const [scanning, setScanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (inbox === null) void getOrCreateInbox({});
  }, [inbox, getOrCreateInbox]);

  // NOTE: first-scan auto-trigger lives in useFirstScan (DashboardView).
  // This component only handles manual re-scans so the two can't run
  // concurrently and unmount each other's UI.

  const isConnected = !!status?.connected;

  const handleScan = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setScanning(true);
    try {
      const r = await scan({});
      const res = r as { scanned: number; created: number; reason?: string };
      const copy = scanResultCopy(res);
      if (copy.kind === "error") {
        sileo.error({ title: copy.title, description: copy.description });
      } else {
        sileo.success({ title: copy.title, description: copy.description });
      }
    } catch {
      sileo.error({
        title: "Scan failed",
        description: "Something hiccuped on our side. Try again in a bit.",
      });
    } finally {
      inFlightRef.current = false;
      setScanning(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-2 text-center sm:py-4">
      <Image
        src="/mail-mockup.png"
        alt="Mailbox syncing Gmail"
        width={768}
        height={512}
        priority
        className="mx-auto h-auto max-h-[30vh] w-auto max-w-full"
      />
      <h3 className="mt-4 font-heading text-xl font-semibold tracking-tight sm:text-2xl">
        No subscriptions yet
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Connect Gmail and SubZero tracks every renewal for you.
        {inbox ? (
          <>
            {" "}
            Or forward any receipt to{" "}
            <button
              type="button"
              onClick={() => void copyInbox(inbox, setCopied)}
              title="Copy forwarding address"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-xs whitespace-nowrap text-foreground transition-colors hover:bg-secondary/70"
            >
              {copied ? "copied!" : inbox}
              <HugeiconsIcon
                icon={
                  (copied
                    ? CheckmarkCircle01Icon
                    : Copy01Icon) as unknown as Parameters<
                    typeof HugeiconsIcon
                  >[0]["icon"]
                }
                size={12}
                strokeWidth={1.8}
                color="currentColor"
                className={
                  copied
                    ? "shrink-0 text-primary"
                    : "shrink-0 text-muted-foreground"
                }
              />
            </button>
            .
          </>
        ) : null}
      </p>

      <div className="mx-auto mt-4 max-w-xs">
        {status === undefined ? (
          <div className="h-10 animate-pulse rounded-lg bg-border/40" />
        ) : !isConnected ? (
          <ConnectGmailButton className="w-full" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm text-muted-foreground">
                {status.accountEmail
                  ? `Connected as ${status.accountEmail}`
                  : "Gmail connected"}
              </p>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-300">
                Connected
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleScan}
                disabled={scanning}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                {scanning ? "Scanning..." : "Scan now"}
              </Button>
            </div>
            {status.lastGmailScanAt && (
              <p className="text-xs text-muted-foreground font-mono text-center">
                last scan {new Date(status.lastGmailScanAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {scanning && (
          <p className="mt-3 text-xs text-muted-foreground text-center">
            Scanning Gmail for subscription mails…
          </p>
        )}
      </div>
    </div>
  );
}
