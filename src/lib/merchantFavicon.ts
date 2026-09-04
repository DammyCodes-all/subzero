// Brand favicons resolve to the MERCHANT's own domain — never the billing
// provider or cancellation URL host. A Play Store glyph standing in for
// Snapchat is worse than no icon, so unknown merchants return null and the
// caller falls back to the initial-letter disc. Extend the map as new
// brands appear; keep keys lowercase.
const MERCHANT_DOMAINS: Record<string, string> = {
  adobe: "adobe.com",
  amazon: "amazon.com",
  apple: "apple.com",
  canva: "canva.com",
  chatgpt: "chatgpt.com",
  "chatgpt plus": "chatgpt.com",
  figma: "figma.com",
  "google one": "google.com",
  linear: "linear.app",
  netflix: "netflix.com",
  notion: "notion.so",
  snap: "snapchat.com",
  "snap inc": "snapchat.com",
  snapchat: "snapchat.com",
  "snapchat+": "snapchat.com",
  spotify: "spotify.com",
  youtube: "youtube.com",
  "youtube premium": "youtube.com",
};

// Merchant favicon via the canonical brand domain. No key, no new deps —
// Google's s2 service. Unknown brands return null (initial-letter disc).
export function merchantFaviconUrl(sub: { merchant: string }): string | null {
  const domain = MERCHANT_DOMAINS[sub.merchant.toLowerCase().trim()];
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

// Favicon for any http(s) URL (evidence sources, help pages, …).
export function faviconUrlFor(rawUrl?: string | null): string | null {
  const raw = rawUrl?.trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (!host?.includes(".")) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return null;
  }
}
