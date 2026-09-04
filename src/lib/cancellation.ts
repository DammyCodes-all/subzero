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

export function openExternalUrl(url: string, provider?: string | null) {
  if (typeof window === "undefined") return;
  const p = provider?.toLowerCase() ?? "";
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  // Google Play on Android: use intent to force Play Store app when url is a Play URL
  if (p.includes("google") && isAndroid) {
    try {
      const u = new URL(url);
      if (u.hostname === "play.google.com") {
        const intentUrl = `intent://${u.host}${u.pathname}${u.search}#Intent;package=com.android.vending;scheme=https;end`;
        window.location.href = intentUrl;
        setTimeout(() => {
          try {
            window.open(url, "_blank", "noopener,noreferrer");
          } catch {}
        }, 600);
        return;
      }
    } catch {}
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
    if (!url) {
      return {
        label: "No verified route",
        variant: "outline",
        disabled: true,
        helper: `Billed through ${provider}. No verified link yet`,
      };
    }
    return {
      label: `Open ${provider}`,
      href: url,
      variant: "default",
    };
  }
  // Web method with provider billing but discovered route is open_web — show but note provider
  // (no hardcoding; research must have returned URL if store-billed)
  if (m === "open_web" && provider) {
    if (!url) {
      return {
        label: "No verified route",
        variant: "outline",
        disabled: true,
        helper: `Billed through ${provider}`,
      };
    }
    return {
      label: `Open ${provider}`,
      href: url,
      variant: "default",
      helper: `Billed through ${provider}`,
    };
  }
  if (m === "open_web") {
    if (url)
      return {
        label: "Open cancellation",
        href: url,
        variant: "default",
        helper: `Cancel on ${sub.merchant}`,
      };
    return {
      label: "No verified route",
      variant: "outline",
      disabled: true,
      helper: `No verified link for ${sub.merchant}`,
    };
  }
  if (m === "open_provider") {
    if (!url) {
      return {
        label: "No verified route",
        variant: "outline",
        disabled: true,
        helper: "No verified provider link",
      };
    }
    return {
      label: `Open ${provider ?? "provider"}`,
      href: url,
      variant: "default",
      helper: "Cancel where you were billed",
    };
  }
  if (m === "send_email") {
    return {
      label: "Review & send",
      variant: "default",
      helper: "Sent via SubZero",
    };
  }
  if (m === "contact_support") {
    return {
      label: "Contact support",
      href: url,
      variant: "default",
      helper: "Requires support request",
    };
  }
  if (m === "manual") {
    return {
      label: "View steps",
      variant: "outline",
      helper: "Manual steps below",
    };
  }
  return {
    label: "No verified route",
    variant: "outline",
    disabled: true,
    helper: "We'll update when verified",
  };
}
