export type CancellationMethod =
  | "open_web"
  | "open_provider"
  | "send_email"
  | "contact_support"
  | "manual"
  | "unknown";

export type CancellationCTA = {
  label: string;
  href?: string;
  variant: "default" | "outline";
  disabled?: boolean;
  helper?: string;
};

type SubLike = {
  merchant: string;
  cancellationMethod?: string | null;
  cancellationUrl?: string | null;
  billingProvider?: string | null;
  researchStatus?: string | null;
};

export function getProviderFallbackUrl(provider?: string | null): string | undefined {
  if (!provider) return undefined;
  const p = provider.toLowerCase();
  if (p.includes("google")) return "https://play.google.com/store/account/subscriptions";
  if (p.includes("apple")) return "https://apps.apple.com/account/subscriptions";
  if (p.includes("amazon")) return "https://www.amazon.com/gp/help/customer/display.html?nodeId=G57AV2WTEF34REEB";
  return undefined;
}

export function openExternalUrl(url: string, provider?: string | null) {
  if (typeof window === "undefined") return;
  const p = provider?.toLowerCase() ?? "";
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  // Google Play on Android: use intent to force Play Store app, fallback to https
  if (p.includes("google") && isAndroid) {
    window.location.href = "intent://play.google.com/store/account/subscriptions#Intent;package=com.android.vending;scheme=https;end";
    setTimeout(() => {
      try { window.open(url, "_blank", "noopener,noreferrer"); } catch {}
    }, 600);
    return;
  }
  if (p.includes("apple") && isIOS) {
    // iOS will handle https -> App Store / Settings
    window.location.href = url;
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function getCancellationCTA(sub: SubLike): CancellationCTA {
  const m = (sub.cancellationMethod ?? "unknown") as CancellationMethod;
  const url = sub.cancellationUrl ?? undefined;
  const provider = sub.billingProvider ?? undefined;
  const pending = sub.researchStatus === "pending";

  if (pending) {
    return {
      label: "Researching…",
      variant: "outline",
      disabled: true,
      helper: "Finding verified route",
    };
  }

  if (m === "open_provider" && provider) {
    return {
      label: `Open ${provider}`,
      href: url ?? getProviderFallbackUrl(provider) ?? url,
      variant: "default",
      helper: `Billed through ${provider} — cancel there`,
    };
  }
  // Fallback: provider present but method still open_web → treat as provider
  if (m === "open_web" && provider && (provider.toLowerCase().includes("google") || provider.toLowerCase().includes("apple"))) {
    return {
      label: `Open ${provider}`,
      href: url ?? (provider.toLowerCase().includes("google") ? "https://play.google.com/store/account/subscriptions" : "https://apps.apple.com/account/subscriptions"),
      variant: "default",
      helper: `Billed through ${provider}`,
    };
  }
  if (m === "open_web") {
    if (url) return { label: "Open cancellation", href: url, variant: "default", helper: `Cancel on ${sub.merchant}` };
    return { label: "Open cancellation", variant: "default", helper: "" };
  }
  if (m === "open_provider") {
    return { label: `Open ${provider ?? "provider"}`, href: url, variant: "default", helper: "Cancel where you were billed" };
  }
  if (m === "send_email") {
    return { label: "Review & send", variant: "default", helper: "Sent via SubZero" };
  }
  if (m === "contact_support") {
    return { label: "Contact support", href: url, variant: "default", helper: "Requires support request" };
  }
  if (m === "manual") {
    return { label: "View steps", variant: "outline", helper: "Manual steps below" };
  }
  return {
    label: "No verified route",
    variant: "outline",
    disabled: true,
    helper: "We'll update when verified",
  };
}
