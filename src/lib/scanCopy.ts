export function scanReasonCopy(reason?: string): string | null {
  if (!reason) return null;
  if (reason === "cooldown")
    return "You scanned recently. Wait a few minutes and try again.";
  if (reason === "no_consent" || reason === "token_failed")
    return "Gmail access not granted. Reconnect your Google account from the Connections page.";
  if (reason === "scan_failed")
    return "Gmail scan hit a temporary error. Try again in a moment.";
  return reason.slice(0, 300);
}

export function scanResultCopy(res: {
  scanned: number;
  created: number;
  reason?: string;
}): { title: string; description: string; kind: "success" | "error" } {
  const mapped = scanReasonCopy(res.reason);
  if (mapped) {
    return {
      title: "Couldn't complete Gmail scan",
      description: mapped,
      kind: "error",
    };
  }
  return {
    title: "Gmail scan finished",
    description: `Checked ${res.scanned} recent emails and found ${res.created} new subscription${res.created === 1 ? "" : "s"}`,
    kind: "success",
  };
}
