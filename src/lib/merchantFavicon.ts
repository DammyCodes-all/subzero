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
  duolingo: "duolingo.com",
  figma: "figma.com",
  "google one": "google.com",
  "i-fitness": "ifitness.ng",
  "i fitness": "ifitness.ng",
  ifitness: "ifitness.ng",
  linear: "linear.app",
  netflix: "netflix.com",
  notion: "notion.so",
  proton: "proton.me",
  "proton unlimited": "proton.me",
  snap: "snapchat.com",
  "snap inc": "snapchat.com",
  snapchat: "snapchat.com",
  "snapchat+": "snapchat.com",
  spotify: "spotify.com",
  youtube: "youtube.com",
  "youtube premium": "youtube.com",
};

// Signal order: verified map → company website found by Firecrawl research →
// researched cancellation URL host, merchant-matched only (a Play-billed sub
// researches play.google.com — that must not become the icon). Anything else
// returns null (initial-letter disc). The icon always comes from the
// company's own site, never guessed, never the billing provider.
export function merchantFaviconUrl(sub: {
  merchant: string;
  websiteDomain?: string | null;
  billingProvider?: string | null;
  cancellationUrl?: string | null;
}): string | null {
  const mapped = MERCHANT_DOMAINS[sub.merchant.toLowerCase().trim()];
  if (mapped) return s2(mapped);
  if (sub.websiteDomain?.includes(".")) return s2(sub.websiteDomain);
  const researchHost = hostOf(sub.cancellationUrl);
  if (researchHost && merchantMatchesHost(sub.merchant, researchHost))
    return s2(registrable(researchHost));
  return null;
}

function s2(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function hostOf(rawUrl?: string | null): string | null {
  const raw = rawUrl?.trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

// Last two labels, with a small public-suffix allowance
// (help.ifitness.ng → ifitness.ng, support.example.co.uk → example.co.uk).
function registrable(host: string): string {
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const twoPart = new Set(["co", "com", "org", "net", "gov", "edu", "ac"]);
  if (parts.length >= 3 && twoPart.has(parts[parts.length - 2])) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

function merchantMatchesHost(merchant: string, host: string): boolean {
  const slug = merchant
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20);
  const tokens = merchant
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3)
    .slice(0, 3);
  const reg = registrable(host);
  return (
    (!!slug && reg.replace(/\./g, "").includes(slug)) ||
    tokens.some((tok) => reg.includes(tok))
  );
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
