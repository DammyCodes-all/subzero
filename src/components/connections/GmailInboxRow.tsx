"use client";

import {
  Loading03Icon,
  MailSearch01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/timeAgo";
import {
  ConnectionStatusPill,
  inboxHealth,
} from "./ConnectionStatusPill";

export const SCAN_COOLDOWN_MS = 10 * 60 * 1000;

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface InboxConn {
  _id: string;
  status: string;
  accountEmail?: string;
  lastGmailScanAt?: number;
  gmailScopeGranted?: boolean;
  gmailWatchExpiration?: number;
  hasHistoryId?: boolean;
}

export interface InboxHealth {
  queued: number;
  dead: number;
  backfillActive: boolean;
  backfillProcessed: number;
}

export type ScanResult =
  | {
      ok: true;
      scanned: number;
      created: number;
      merged?: number;
      skipped?: number;
      unparsed?: number;
      duplicate?: number;
      cancelled?: number;
      failed?: number;
      remaining?: boolean;
    }
  | { ok: false; message: string };

function breakdownLine(r: Extract<ScanResult, { ok: true }>): string {
  const parts: string[] = [];
  if (r.created) parts.push(`${r.created} new`);
  if (r.merged) parts.push(`${r.merged} updated`);
  if (r.cancelled) parts.push(`${r.cancelled} cancelled`);
  if (r.duplicate) parts.push(`${r.duplicate} dupes`);
  if (r.skipped) parts.push(`${r.skipped} skipped`);
  if (r.unparsed) parts.push(`${r.unparsed} unclear`);
  if (r.failed) parts.push(`${r.failed} failed`);
  if (parts.length === 0) return `Synced ${r.scanned} emails, nothing new`;
  return `Synced ${r.scanned} emails: ${parts.join(", ")}`;
}

export function GmailInboxRow({
  conn,
  syncHealth,
  scanning,
  scanBusy,
  lastResult,
  disconnecting,
  onScan,
  onDisconnect,
  onReconnect,
}: {
  conn: InboxConn;
  syncHealth?: InboxHealth | null;
  scanning: boolean;
  scanBusy: boolean;
  lastResult: ScanResult | null;
  disconnecting: boolean;
  onScan: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  const now = useNow(30_000);
  const [armDisconnect, setArmDisconnect] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    };
  }, []);

  const isDisconnected = conn.status !== "connected";

  // Drop a stale confirm so a reconnected row never opens pre-armed.
  useEffect(() => {
    if (isDisconnected) {
      if (armTimer.current) clearTimeout(armTimer.current);
      setArmDisconnect(false);
    }
  }, [isDisconnected]);

  const health = inboxHealth({
    status: conn.status,
    scopeGranted: conn.gmailScopeGranted,
    lastScanAt: conn.lastGmailScanAt,
    watchExpiration: conn.gmailWatchExpiration,
  });
  // Explicit Rescans pass force:true, so the backend cooldown doesn't apply.
  // The button stays enabled — progress/backfill state is the guard, not a timer.

  const arm = () => {
    setArmDisconnect(true);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmDisconnect(false), 5000);
  };

  const disarm = () => {
    if (armTimer.current) clearTimeout(armTimer.current);
    setArmDisconnect(false);
  };

  return (
    <div className="py-4 first:pt-3 last:pb-1">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {conn.accountEmail ? (
                <a
                  href={`mailto:${conn.accountEmail}`}
                  className="min-w-0 break-all font-mono text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {conn.accountEmail}
                </a>
              ) : (
                <p className="min-w-0 break-all font-mono text-sm font-medium text-foreground">
                  Connected Gmail
                </p>
              )}
              <ConnectionStatusPill health={health} />
            </div>
            <p
              className="mt-0.5 text-xs text-muted-foreground"
              title={
                conn.lastGmailScanAt
                  ? new Date(conn.lastGmailScanAt).toLocaleString()
                  : undefined
              }
            >
              {isDisconnected
                ? "Not connected. Reconnect to resume."
                : health === "reauth"
                  ? "Gmail cut off access. Reconnect to resume."
                  : health === "never"
                    ? "Connected. Waiting for first sync."
                    : conn.lastGmailScanAt
                      ? `Last synced ${timeAgo(conn.lastGmailScanAt, now)}`
                      : "Connected"}
            </p>
            {lastResult ? (
              <p
                className={`mt-0.5 font-mono text-[11px] ${
                  lastResult.ok ? "text-muted-foreground" : "text-amber-300"
                }`}
              >
                {lastResult.ok
                  ? lastResult.remaining || syncHealth?.backfillActive
                    ? `First pass: ${breakdownLine(lastResult)} · deep scan continues`
                    : breakdownLine(lastResult)
                  : lastResult.message}
              </p>
            ) : null}
            {!isDisconnected && syncHealth?.backfillActive ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Deep scan in progress
                {syncHealth!.backfillProcessed > 0
                  ? ` · ${syncHealth!.backfillProcessed} processed`
                  : ""}
                . New mail still syncs first.
              </p>
            ) : null}
            {!isDisconnected && (syncHealth?.dead ?? 0) > 0 ? (
              <p className="mt-0.5 text-[11px] text-amber-300">
                {syncHealth!.dead} email{syncHealth!.dead === 1 ? "" : "s"} couldn't
                be read after retries. Reconnecting or rescanning may pick{" "}
                {syncHealth!.dead === 1 ? "it" : "them"} up.
              </p>
            ) : null}
          </div>

        <div className="flex shrink-0 items-center gap-1.5 pt-0.5 sm:pt-0 sm:pl-4">
          {isDisconnected || health === "reauth" ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onReconnect}
              className="h-8 flex-none gap-1.5 px-3 text-xs font-medium"
            >
              Reconnect
            </Button>
          ) : armDisconnect ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                disabled={disconnecting}
                onClick={onDisconnect}
                className="h-8 flex-none px-3 text-xs font-medium"
              >
                {disconnecting ? "Disconnecting…" : "Yes, disconnect"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={disconnecting}
                onClick={disarm}
                className="h-8 flex-none px-2 text-xs"
              >
                Keep it
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={scanning || scanBusy || disconnecting}
                onClick={onScan}
                title="Scan this inbox now"
                className="h-8 flex-none gap-1.5 px-3 text-xs font-medium"
              >
                {scanning ? (
                  <>
                    <HugeiconsIcon
                      icon={
                        Loading03Icon as unknown as Parameters<
                          typeof HugeiconsIcon
                        >[0]["icon"]
                      }
                      size={14}
                      color="currentColor"
                      className="animate-spin"
                    />
                    Scanning…
                  </>
                ) : (
                  <>
                    <HugeiconsIcon
                      icon={
                        MailSearch01Icon as unknown as Parameters<
                          typeof HugeiconsIcon
                        >[0]["icon"]
                      }
                      size={14}
                      color="currentColor"
                    />
                    "Scan now"
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={disconnecting || scanning}
                onClick={arm}
                className="h-8 flex-none gap-1 px-2 text-xs text-muted-foreground hover:bg-transparent hover:text-destructive"
              >
                Disconnect
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
