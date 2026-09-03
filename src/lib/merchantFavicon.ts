// Merchant favicon via the researched cancellation URL hostname.
// No key, no new deps — Google's s2 service. Unknown/blocked hosts fall
// back to the initial-letter disc in MerchantAvatar.
export function merchantFaviconUrl(sub: {
  cancellationUrl?: string | null;
}): string | null {
  const raw = sub.cancellationUrl?.trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (!host || !host.includes(".")) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return null;
  }
}
