"use client";

import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MailAccount01Icon,
  Copy01Icon,
  CheckmarkCircle01Icon,
  MailSearch01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { ConnectGmailButton } from "@/components/ConnectGmailButton";
import { ForwardingCard } from "@/components/ForwardingCard";
import { ConnectionsAgentMailSkeleton } from "@/components/Skeleton";
import { api } from "../../../convex/_generated/api";

export function ConnectionsView() {
  const connections = useQuery(api.connections.getMyConnections);
  const inbox = useQuery(api.agentmail.getInbox);
  const scan = useAction(api.gmailActions.scanGmail);
  const disconnect = useMutation(api.gmail.disconnectGmail);

  const [copied, setCopied] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const handleCopyAlias = async () => {
    if (!inbox) return;
    try {
      await navigator.clipboard.writeText(inbox);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleScan = async (connId: string) => {
    setScanningId(connId);
    setScanResult(null);
    try {
      const res = await scan({});
      const r = res as { scanned: number; created: number; reason?: string };
      if (r.reason) {
        setScanResult(`Scan result: ${r.reason}`);
      } else {
        setScanResult(`Scanned ${r.scanned} emails · found ${r.created} subscriptions`);
      }
    } catch (e: unknown) {
      setScanResult(`Scan failed: ${String(e)}`);
    } finally {
      setScanningId(null);
    }
  };

  const googleConns = connections?.filter((c) => c.provider === "google") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Inboxes &amp; Connections
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your connected email inboxes, AgentMail forwarding alias, and passive sync status.
        </p>
      </div>

      {scanResult && (
        <div className="rounded-lg border border-border bg-card p-3 font-mono text-xs text-foreground">
          {scanResult}
        </div>
      )}

      {/* Main Connections Card */}
      <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HugeiconsIcon
                icon={MailAccount01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                size={20}
                strokeWidth={1.8}
                color="currentColor"
              />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold">
                Connected Inboxes &amp; Accounts
              </h2>
              <p className="text-xs text-muted-foreground">
                All connected sources feed into your unified subscription engine.
              </p>
            </div>
          </div>

          <ConnectGmailButton />
        </div>

        {/* Connections List */}
        <div className="space-y-3">
          {/* AgentMail Inbound Alias Row */}
          {inbox === undefined ? (
            <ConnectionsAgentMailSkeleton />
          ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                  size={16}
                  strokeWidth={1.8}
                  color="currentColor"
                />
              </div>
              <div>
                <p className="font-mono text-sm font-medium text-foreground">
                  {inbox}
                </p>
                <p className="text-xs text-muted-foreground">
                  AgentMail Inbound Alias (Passive forwarding)
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAlias}
              className="h-8 gap-1.5 font-mono text-xs"
            >
              <HugeiconsIcon
                icon={Copy01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                size={14}
                color="currentColor"
              />
              {copied ? "Copied" : "Copy Alias"}
            </Button>
          </div>
          )}

          {/* Google Connections Rows */}
          {googleConns.map((conn) => (
            <div
              key={conn._id}
              className="flex flex-col gap-3 rounded-lg border border-border/80 bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <HugeiconsIcon
                    icon={CheckmarkCircle01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                    size={16}
                    strokeWidth={1.8}
                    color="currentColor"
                  />
                </div>
                <div>
                  <p className="font-mono text-sm font-medium text-foreground">
                    {conn.accountEmail ?? "Connected Gmail"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Gmail API Sync · {conn.lastGmailScanAt ? `Last scan ${new Date(conn.lastGmailScanAt).toLocaleDateString()}` : "Never scanned"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={scanningId === conn._id}
                  onClick={() => handleScan(conn._id)}
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  {scanningId === conn._id ? (
                    <>
                      <HugeiconsIcon
                        icon={Loading03Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                        size={14}
                        color="currentColor"
                        className="animate-spin"
                      />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <HugeiconsIcon
                        icon={MailSearch01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                        size={14}
                        color="currentColor"
                      />
                      Scan Now
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void disconnect({})}
                  className="h-8 text-xs text-muted-foreground hover:text-destructive"
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ))}

          {googleConns.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
              <p className="text-xs text-muted-foreground">
                No Gmail accounts connected yet. Connect your Google account to automatically scan for subscription receipts.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Auxiliary Forwarding Card */}
      <ForwardingCard />
    </div>
  );
}
