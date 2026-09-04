// Never ingest SubZero's own outbound mail (renewal nudges, trial alerts,
// test mails) as subscriptions. All our templates sign with SubZero and our
// test/nudge sender is AgentMail — a real receipt never mentions SubZero.
// Keep markers in sync with lib/emailTemplates.ts and notifications.ts.
export function isSelfEmail(args: {
  from?: string;
  subject?: string;
  text?: string;
}): boolean {
  const from = (args.from ?? "").toLowerCase();
  const subject = (args.subject ?? "").toLowerCase();
  const body = (args.text ?? "").toLowerCase();
  if (from.includes("agentmail.to") || from.includes("subzero")) return true;
  if (subject.includes("renewal alert")) return true;
  if (subject.startsWith("trial ending:")) return true;
  if (subject.startsWith("cancelled:")) return true;
  if (subject.startsWith("still need to cancel")) return true;
  if (body.includes("subzero")) return true;
  return false;
}
