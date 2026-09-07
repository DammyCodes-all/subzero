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

export function scanResultCopy(res: {
  scanned: number;
  created: number;
  reason?: string;
}): { title: string; description: string; kind: "success" | "error" } {
  const mapped = scanReasonCopy(res.reason);
  if (mapped) {
    return {
      title: "Scan didn't finish",
      description: mapped,
      kind: "error",
    };
  }
  return {
    title: "Scan done",
    description: `Synced ${res.scanned} emails, ${res.created} new.`,
    kind: "success",
  };
}
