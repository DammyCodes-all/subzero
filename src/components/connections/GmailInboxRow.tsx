"use client";

import {
  Cancel01Icon,
  CheckmarkCircle01Icon,
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

export type ScanResult =
  | { ok: true; scanned: number; created: number }
  | { ok: false; message: string };

export function GmailInboxRow({
  conn,
  scanning,
  scanBusy,
  lastResult,
  disconnecting,
  onScan,
  onDisconnect,
  onReconnect,
}: {
  conn: InboxConn;
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
  const cooldownLeft =
    !isDisconnected && conn.lastGmailScanAt
      ? conn.lastGmailScanAt + SCAN_COOLDOWN_MS - now
      : 0;
  const onCooldown = cooldownLeft > 0 && !scanning;
  const cooldownLabel =
    onCooldown && cooldownLeft > 60_000
      ? `${Math.ceil(cooldownLeft / 60_000)}m`
      : onCooldown
        ? `${Math.ceil(cooldownLeft / 1000)}s`
        : null;

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
    <div className="rounded-lg border border-border/80 bg-background/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={
              isDisconnected
                ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                : health === "reauth"
                  ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-300"
                  : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400"
            }
          >
            <HugeiconsIcon
              icon={
                (isDisconnected || health === "reauth"
                  ? Cancel01Icon
                  : CheckmarkCircle01Icon) as unknown as Parameters<
                  typeof HugeiconsIcon
                >[0]["icon"]
              }
              size={16}
              strokeWidth={1.8}
              color="currentColor"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {conn.accountEmail ? (
                <a
                  href={`mailto:${conn.accountEmail}`}
                  className="truncate font-mono text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {conn.accountEmail}
                </a>
              ) : (
                <p className="truncate font-mono text-sm font-medium text-foreground">
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
                  ? `Synced ${lastResult.scanned} emails, ${lastResult.created} new`
                  : lastResult.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isDisconnected || health === "reauth" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onReconnect}
              className="h-8 gap-1.5 text-xs font-medium"
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
                className="h-8 text-xs font-medium"
              >
                {disconnecting ? "Disconnecting…" : "Yes, disconnect"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={disconnecting}
                onClick={disarm}
                className="h-8 text-xs"
              >
                Keep it
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={scanning || scanBusy || onCooldown || disconnecting}
                onClick={onScan}
                title={
                  onCooldown
                    ? `Try again in ${cooldownLabel}`
                    : "Scan this inbox now"
                }
                className="h-8 gap-1.5 text-xs font-medium"
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
                    {onCooldown ? `Try again in ${cooldownLabel}` : "Scan now"}
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={disconnecting || scanning}
                onClick={arm}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
