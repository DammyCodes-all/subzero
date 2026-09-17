export function scanReasonCopy(reason?: string): string | null {
  if (!reason) return null;
  if (reason === "cooldown")
    return "That was quick. Give it a few minutes, then try again.";
  if (reason === "no_consent" || reason === "token_failed")
    return "SubZero lost access to that Gmail account. Reconnect it and scan again.";
  if (reason === "scan_failed")
    return "Something hiccuped on our side. Try again in a bit.";
  // Unknown reason codes are never shown raw. Log server-side instead.
  return "Something hiccuped on our side. Try again in a bit.";
}

export interface ScanTotals {
  scanned: number;
  created: number;
  merged?: number;
  skipped?: number;
  unparsed?: number;
  duplicate?: number;
  cancelled?: number;
  failed?: number;
  reason?: string;
  remaining?: boolean;
}

export function scanBreakdown(res: ScanTotals): string {
  const parts: string[] = [`${res.scanned} emails`];
  if (res.created) parts.push(`${res.created} new`);
  if (res.merged) parts.push(`${res.merged} updated`);
  if (res.cancelled) parts.push(`${res.cancelled} cancelled`);
  if (res.duplicate) parts.push(`${res.duplicate} dupes`);
  if (res.skipped) parts.push(`${res.skipped} skipped`);
  if (res.unparsed) parts.push(`${res.unparsed} unclear`);
  if (res.failed) parts.push(`${res.failed} failed`);
  if (parts.length === 1) return `Synced ${res.scanned} emails, nothing new.`;
  const [first, ...rest] = parts;
  return `Synced ${first}: ${rest.join(", ")}.`;
}

export function scanResultCopy(res: ScanTotals): {
  title: string;
  description: string;
  kind: "success" | "error" | "progress";
} {
  const mapped = scanReasonCopy(res.reason);
  if (mapped) {
    return {
      title: "Scan didn't finish",
      description: mapped,
      kind: "error",
    };
  }
  // Partial: action returned but backfill/drain still working through the
  // remainder. Never present this as the final breakdown.
  if (res.remaining) {
    return {
      title: "First pass done",
      description: `${scanBreakdown(res)} Deep scan continues in the background — final totals when it lands.`,
      kind: "progress",
    };
  }
  return {
    title: "Scan done",
    description: scanBreakdown(res),
    kind: "success",
  };
}
