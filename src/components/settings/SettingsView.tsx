"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Notification01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Download04Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { api } from "../../../convex/_generated/api";
import type { NotificationPrefs } from "./types";
import { formatRenewalDate } from "@/lib/format";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusPill(status: string) {
  if (status === "sent")
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
        Sent
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400">
        Failed
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
      Pending
    </span>
  );
}

function leadLabel(type: string) {
  if (type === "7d") return "7 days before renewal";
  if (type === "3d") return "3 days before renewal";
  if (type === "24h") return "24 hours before renewal";
  return type;
}

// ---------------------------------------------------------------------------
// Export CSV helper
// ---------------------------------------------------------------------------

function exportToCsv(rows: readonly Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const lines = [
    keys.join(","),
    ...rows.map((r) =>
      keys.map((k) => JSON.stringify(r[k] ?? "")).join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsView() {
  const notifications = useQuery(api.userNotifications.getMyNotifications);
  const subscriptions = useQuery(api.subscriptions.list);

  const [prefs, setPrefs] = useState<NotificationPrefs>({
    enabled7d: true,
    enabled3d: true,
    enabled24h: true,
  });
  const [savedPrefs, setSavedPrefs] = useState(false);

  const handleToggle = (key: keyof NotificationPrefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setSavedPrefs(false);
  };

  const handleSavePrefs = () => {
    // Prefs are currently client-side only (no user settings table in schema).
    // When a settings table is added to schema, persist here.
    setSavedPrefs(true);
    setTimeout(() => setSavedPrefs(false), 2500);
  };

  const handleExportSubs = () => {
    if (!subscriptions?.length) return;
    const rows = subscriptions.map((s) => ({
      merchant: s.merchant,
      product: s.product ?? "",
      price: s.price,
      currency: s.currency,
      billingInterval: s.billingInterval,
      status: s.status,
      nextRenewalAt: s.nextRenewalAt
        ? new Date(s.nextRenewalAt).toISOString()
        : "",
      cancellationDifficulty: s.cancellationDifficulty ?? "",
    }));
    exportToCsv(rows as unknown as Record<string, unknown>[], "subzero-subscriptions.csv");
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage notification lead-times, data export, and account preferences.
        </p>
      </div>

      {/* ── Notification Preferences ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HugeiconsIcon
              icon={Notification01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
              size={18}
              strokeWidth={1.8}
              color="currentColor"
            />
          </div>
          <h2 className="font-heading text-base font-semibold">Renewal Notification Lead-Times</h2>
        </div>

        <div className="rounded-xl border border-border bg-card divide-y divide-border/40">
          {(
            [
              {
                key: "enabled7d" as keyof NotificationPrefs,
                label: "7-day warning",
                desc: "Email alert 7 days before a subscription renews.",
              },
              {
                key: "enabled3d" as keyof NotificationPrefs,
                label: "3-day warning",
                desc: "Email alert 3 days before a subscription renews.",
              },
              {
                key: "enabled24h" as keyof NotificationPrefs,
                label: "24-hour warning",
                desc: "Final email alert the day before renewal.",
              },
            ] as const
          ).map(({ key, label, desc }) => (
            <div
              key={key}
              className="flex items-center justify-between px-5 py-4"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[key]}
                onClick={() => handleToggle(key)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  prefs[key] ? "bg-primary" : "bg-secondary"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                    prefs[key] ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleSavePrefs}
            className="h-8 gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {savedPrefs ? (
              <>
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                  size={14}
                  color="currentColor"
                />
                Saved
              </>
            ) : (
              "Save preferences"
            )}
          </Button>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <HugeiconsIcon
              icon={InformationCircleIcon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
              size={13}
              color="currentColor"
            />
            Alerts are sent to your connected account email.
          </p>
        </div>
      </section>

      {/* ── Data Export ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HugeiconsIcon
              icon={Download04Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
              size={18}
              strokeWidth={1.8}
              color="currentColor"
            />
          </div>
          <h2 className="font-heading text-base font-semibold">Data Export</h2>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Export all subscriptions as CSV
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Downloads a CSV file with merchant, price, interval, status, and renewal date for all{" "}
                {subscriptions?.length ?? 0} tracked subscriptions.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSubs}
              disabled={!subscriptions?.length}
              className="h-8 gap-1.5 shrink-0 text-xs font-medium"
            >
              <HugeiconsIcon
                icon={Download04Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                size={14}
                color="currentColor"
              />
              Download CSV
            </Button>
          </div>
        </div>
      </section>

      {/* ── Notification History ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HugeiconsIcon
              icon={Clock01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
              size={18}
              strokeWidth={1.8}
              color="currentColor"
            />
          </div>
          <h2 className="font-heading text-base font-semibold">Notification History</h2>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {notifications === undefined ? (
            <div className="space-y-2 p-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded-lg bg-border/40" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No notifications sent yet. They appear here once your first renewal warning fires.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-secondary/40 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Scheduled</th>
                    <th className="px-4 py-3">Sent At</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {notifications.map((n) => (
                    <tr key={n._id} className="transition-colors hover:bg-secondary/20">
                      <td className="px-4 py-3 text-foreground">{leadLabel(n.type)}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {formatRenewalDate(n.scheduledAt)}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {n.attemptedAt ? formatRenewalDate(n.attemptedAt) : "—"}
                      </td>
                      <td className="px-4 py-3">{statusPill(n.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
