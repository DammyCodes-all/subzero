"use client";

export type InboxHealth =
  | "live"
  | "polling"
  | "never"
  | "reauth"
  | "disconnected";

export function inboxHealth(args: {
  status: string;
  scopeGranted?: boolean;
  lastScanAt?: number;
  watchExpiration?: number;
}): InboxHealth {
  if (args.status !== "connected" || args.scopeGranted === false)
    return args.status !== "connected" ? "disconnected" : "reauth";
  if (!args.lastScanAt) return "never";
  if (args.watchExpiration && args.watchExpiration > Date.now()) return "live";
  return "polling";
}

const STYLES: Record<InboxHealth, string> = {
  live: "bg-emerald-500/15 text-emerald-300",
  polling: "bg-primary/10 text-primary",
  never: "bg-muted text-muted-foreground",
  reauth: "bg-amber-500/15 text-amber-300",
  disconnected: "bg-muted text-muted-foreground",
};

const LABELS: Record<InboxHealth, string> = {
  live: "Live",
  polling: "Connected",
  never: "Not scanned yet",
  reauth: "Reconnect needed",
  disconnected: "Disconnected",
};

export function ConnectionStatusPill({ health }: { health: InboxHealth }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] ${STYLES[health]}`}
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${
          health === "live"
            ? "bg-emerald-400 animate-pulse"
            : health === "reauth"
              ? "bg-amber-400"
              : health === "polling"
                ? "bg-primary"
                : "bg-current opacity-60"
        }`}
      />
      {LABELS[health]}
    </span>
  );
}
