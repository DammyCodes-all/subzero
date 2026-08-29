"use client";

import { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import { Check } from "lucide-react";
import { useConvexAuth } from "convex/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "../../convex/_generated/api";

export function ZeroAttentionState() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-6 text-center">
      <Check className="size-4 shrink-0 text-primary" />
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
        onClick={() => void signIn("google", { redirectTo: "/dashboard" })}
      >
        Connect Google
      </Button>
    </div>
  );
}

function AuthenticatedEmptyState() {
  const status = useQuery(api.gmail.getGmailStatus);
  const scan = useAction(api.gmailActions.scanGmail);
  const disconnect = useMutation(api.gmail.disconnectGmail);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<null | { scanned: number; created: number; reason?: string }>(null);
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
        .then((r) => setResult(r as any))
        .catch((e) => setResult({ scanned: 0, created: 0, reason: String(e).slice(0, 200) }))
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
      setResult(r as any);
    } catch (e: any) {
      setResult({ scanned: 0, created: 0, reason: String(e).slice(0, 200) });
    } finally {
      setScanning(false);
    }
  };

  const authToken = useAuthToken();

  const handleConnect = async () => {
    try {
      // React provider keeps JWT in localStorage, not nextjs cookies.
      // POST it to set a httpOnly cookie that the server routes can read.
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
    <div className="rounded-lg border border-dashed bg-card p-10 text-center">
        <h3 className="font-heading text-base font-semibold">No subscriptions yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          You&apos;re signed in. Connect Gmail to auto-find receipts/trials (last 60 days), or forward an email. Results appear here.
        </p>

      <div className="mx-auto mt-6 max-w-sm space-y-3 text-left">
        {status === undefined ? (
          <div className="h-24 animate-pulse rounded-lg border bg-card" />
        ) : !isConnected ? (
          <Button onClick={handleConnect} size="sm" className="w-full">
            Connect Gmail
          </Button>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {status.accountEmail ? `Connected as ${status.accountEmail}` : "Gmail connected"}
              </p>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-300">
                Connected
              </span>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleScan} disabled={scanning} size="sm" variant="outline" className="flex-1">
                {scanning ? "Scanning..." : "Scan now"}
              </Button>
              <Button onClick={() => void disconnect({})} size="sm" variant="ghost">
                Disconnect
              </Button>
            </div>
            {status.lastGmailScanAt && (
              <p className="text-xs text-muted-foreground font-mono text-center">
                last scan {new Date(status.lastGmailScanAt).toLocaleString()}
              </p>
            )}
          </>
        )}

        {result && (
          <p className="text-xs font-mono text-muted-foreground text-center">
            {result.reason === "cooldown"
              ? "Recently scanned — try again in a few minutes."
              : result.reason === "no_consent"
                ? "No Gmail permission — connect first."
                : result.reason
                  ? `Error: ${result.reason}`
                  : `Scanned ${result.scanned} · created ${result.created}`}
          </p>
        )}
        {scanning && <p className="text-xs text-muted-foreground text-center">Scanning Gmail for subscription mails…</p>}
      </div>
    </div>
  );
}
