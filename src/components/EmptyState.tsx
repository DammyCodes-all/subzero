"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { sileo } from "sileo";
import { ConnectGmailButton } from "@/components/ConnectGmailButton";
import { Button } from "@/components/ui/button";
import {
  GOOGLE_OAUTH_REDIRECT,
  markGoogleOAuthAttempt,
} from "@/lib/googleAuth";
import { api } from "../../convex/_generated/api";

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
        Nothing needs you right now
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
    <div className="rounded-lg border border-dashed bg-card p-10 text-center">
      <h3 className="font-heading text-base font-semibold">
        No subscriptions yet
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Connect your Google account and SubZero will find recurring
        subscriptions and trials in your inbox.
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
  const scan = useAction(api.gmailActions.scanGmail);
  const [scanning, setScanning] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  useEffect(() => {
    if (!status) return;
    if (!status.connected) {
      if (autoTried) setAutoTried(false);
      return;
    }
    if (autoTried) return;
    const last = status.lastGmailScanAt ?? 0;
    const shouldAuto = Date.now() - last > 10 * 60 * 1000;
    if (shouldAuto) {
      setAutoTried(true);
      setScanning(true);
      scan({})
        .then((r) => {
          const res = r as {
            scanned: number;
            created: number;
            reason?: string;
          };
          if (res.reason) {
            const desc =
              res.reason === "cooldown"
                ? "You scanned recently. Wait a few minutes and try again."
                : res.reason === "no_consent"
                  ? "Gmail access not granted. Reconnect your Google account from the Connections page."
                  : res.reason;
            sileo.error({
              title: "Couldn't complete Gmail scan",
              description: desc,
            });
          } else {
            sileo.success({
              title: "Gmail scan finished",
              description: `Checked ${res.scanned} recent emails and found ${res.created} new subscription${res.created === 1 ? "" : "s"}`,
            });
          }
        })
        .catch((e) =>
          sileo.error({
            title: "Gmail scan failed",
            description: `Something went wrong while scanning your inbox: ${String(e).slice(0, 200)}`,
          }),
        )
        .finally(() => setScanning(false));
    } else {
      setAutoTried(true);
    }
  }, [status, autoTried, scan]);

  const isConnected = !!status?.connected;

  const handleScan = async () => {
    setScanning(true);
    try {
      const r = await scan({});
      const res = r as { scanned: number; created: number; reason?: string };
      if (res.reason) {
        const desc =
          res.reason === "cooldown"
            ? "You scanned recently. Wait a few minutes and try again."
            : res.reason === "no_consent"
              ? "Gmail access not granted. Reconnect your Google account from the Connections page."
              : res.reason;
        sileo.error({
          title: "Couldn't complete Gmail scan",
          description: desc,
        });
      } else {
        sileo.success({
          title: "Gmail scan finished",
          description: `Checked ${res.scanned} recent emails and found ${res.created} new subscription${res.created === 1 ? "" : "s"}`,
        });
      }
    } catch (e: unknown) {
      sileo.error({
        title: "Gmail scan failed",
        description: `Something went wrong while scanning your inbox: ${String(e).slice(0, 200)}`,
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="rounded-lg border border-dashed bg-card p-10 text-center">
      <h3 className="font-heading text-base font-semibold">
        No subscriptions yet
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        You&apos;re signed in. Connect Gmail to auto-find receipts/trials (last
        60 days), or forward an email. Results appear here.
      </p>

      <div className="mx-auto mt-6 max-w-sm space-y-3 text-left">
        {status === undefined ? (
          <div className="h-24 animate-pulse rounded-lg border bg-card" />
        ) : !isConnected ? (
          <ConnectGmailButton className="w-full" />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
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
          </>
        )}

        {scanning && (
          <p className="text-xs text-muted-foreground text-center">
            Scanning Gmail for subscription mails…
          </p>
        )}
      </div>
    </div>
  );
}
