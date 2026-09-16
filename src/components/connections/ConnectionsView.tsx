"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { sileo } from "sileo";
import { ConnectGmailButton } from "@/components/ConnectGmailButton";
import { ForwardingCard } from "@/components/ForwardingCard";
import { ConnectionsSkeleton } from "@/components/Skeleton";
import { useConnectGmail } from "@/hooks/useConnectGmail";
import { scanResultCopy } from "@/lib/scanCopy";
import { timeAgo } from "@/lib/timeAgo";
import { api } from "../../../convex/_generated/api";
import {
  GmailInboxRow,
  type ScanResult,
} from "./GmailInboxRow";

export function ConnectionsView() {
  const connections = useQuery(api.connections.getMyConnections);
  const scanHealth = useQuery(api.gmailRetries.getScanHealth);
  const scan = useAction(api.gmailManualScan.scanGmail);
  const disconnect = useMutation(api.gmail.disconnectGmail);
  const connectGmail = useConnectGmail();

  const [scanningId, setScanningId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<Record<string, ScanResult>>(
    {},
  );

  const handleScan = async (connId: string) => {
    if (scanningId !== null) return;
    setScanningId(connId);
    try {
      const res = await scan({ connectionId: connId as never });
      const r = res as {
        scanned: number;
        created: number;
        reason?: string;
        remaining?: boolean;
      };
      const copy = scanResultCopy(r);
      if (copy.kind === "error") {
        setLastResults((p) => ({
          ...p,
          [connId]: { ok: false, message: copy.description },
        }));
        sileo.error({ title: copy.title, description: copy.description });
      } else {
        setLastResults((p) => ({
          ...p,
          [connId]: {
            ok: true,
            scanned: r.scanned,
            created: r.created,
            remaining: r.remaining,
          },
        }));
        sileo.success({
          title: copy.title,
          description: r.remaining
            ? `${copy.description} Deep scan continues in the background.`
            : copy.description,
        });
      }
    } catch {
      const message = "Something hiccuped on our side. Try again in a bit.";
      setLastResults((p) => ({ ...p, [connId]: { ok: false, message } }));
      sileo.error({ title: "Scan failed", description: message });
    } finally {
      setScanningId(null);
    }
  };

  const handleDisconnect = async (connId: string, accountEmail?: string) => {
    setDisconnectingId(connId);
    try {
      const res = await disconnect({
        connectionId: connId as unknown as Parameters<typeof disconnect>[0]["connectionId"],
      });
      if ((res as { ok: boolean } | null)?.ok === false) {
        sileo.error({
          title: "Couldn't disconnect",
          description: "That connection no longer exists.",
        });
      } else {
        setLastResults((p) => {
          const next = { ...p };
          delete next[connId];
          return next;
        });
        sileo.success({
          title: "Gmail disconnected",
          description: accountEmail
            ? `${accountEmail} will no longer sync.`
            : "That inbox will no longer sync.",
        });
      }
    } catch (e: unknown) {
      sileo.error({
        title: "Couldn't disconnect",
        description:
          e instanceof Error ? e.message : "Something went wrong. Try again.",
      });
    } finally {
      setDisconnectingId(null);
    }
  };

  const googleConns =
    connections?.filter((c) => c.provider === "google") ?? [];
  const healthByConn = new Map(
    (scanHealth ?? []).map((h) => [String(h.connId), h]),
  );
  const lastSync = googleConns.reduce<number | undefined>(
    (m, c) => (c.lastGmailScanAt && (!m || c.lastGmailScanAt > m) ? c.lastGmailScanAt : m),
    undefined,
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Connections
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            SubZero automatically picks up new subscription receipts and
            keeps your data up to date. Anything else, just forward it.
          </p>
        </div>
        {googleConns.length > 0 ? (
          <ConnectGmailButton className="h-9 w-full justify-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-xs font-medium text-foreground/80 hover:border-primary hover:bg-primary hover:text-primary-foreground sm:h-8 sm:w-auto">
            Add another inbox
          </ConnectGmailButton>
        ) : null}
      </div>

      {connections === undefined ? (
        <ConnectionsSkeleton />
      ) : (
        <>
          <p className="font-mono text-[11px] tracking-wide text-muted-foreground">
            {googleConns.length} inbox{googleConns.length === 1 ? "" : "es"}
            {lastSync ? ` · last synced ${timeAgo(lastSync)}` : ""}
          </p>

          {/* Gmail inboxes — single flat card, rows divide, no inner box */}
          <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-heading text-base font-semibold">Gmail</h2>
              <p className="shrink-0 font-mono text-[11px] text-muted-foreground">
                Auto-sync
              </p>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              New subscription emails keep SubZero up to date.
            </p>

            <div className="mt-2 divide-y divide-border/40 border-t border-border/40">
              {googleConns.map((conn) => (
                <GmailInboxRow
                  key={conn._id}
                  conn={conn}
                  syncHealth={healthByConn.get(conn._id) ?? null}
                  scanning={scanningId === conn._id}
                  scanBusy={scanningId !== null}
                  lastResult={lastResults[conn._id] ?? null}
                  disconnecting={disconnectingId === conn._id}
                  onScan={() => void handleScan(conn._id)}
                  onDisconnect={() =>
                    void handleDisconnect(conn._id, conn.accountEmail)
                  }
                  onReconnect={() => void connectGmail()}
                />
              ))}

              {googleConns.length === 0 && (
                <div className="py-6 text-center">
                  <p className="text-sm font-medium text-foreground">
                    Nothing connected yet
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                    Hook up Gmail and SubZero quietly picks up your
                    subscriptions and trials in the background.
                  </p>
                  <ConnectGmailButton className="mx-auto mt-4 h-9 justify-center gap-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                    Connect Gmail
                  </ConnectGmailButton>
                </div>
              )}
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground">
              Read-only access. SubZero looks for receipts, nothing else.
            </p>
          </section>

          {/* Forwarding */}
          <ForwardingCard />
        </>
      )}
    </div>
  );
}
