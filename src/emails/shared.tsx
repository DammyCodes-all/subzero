import type { ReactNode } from "react";
import { EmailLayout } from "./emailLayout";
import { emailTheme as t } from "./theme";

export type EmailData = {
  merchant: string;
  product?: string;
  priceStr: string;
  billingInterval: string;
  renewalStr: string;
  trialStr: string;
  ctaUrl: string;
  cancelUrl?: string;
  manageUrl: string;
  /** Absolute in production (email clients need full URLs); the preview
   *  iframe resolves a relative path against the app automatically. */
  logoUrl: string;
};

export const title: React.CSSProperties = {
  color: t.foreground,
  fontFamily: t.fontHeading,
  fontSize: "22px",
  fontWeight: "bold",
  lineHeight: "30px",
  margin: "0",
};

export const p: React.CSSProperties = {
  color: t.muted,
  fontFamily: t.fontSans,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 12px",
};

export const signoff: React.CSSProperties = {
  color: t.faint,
  fontFamily: t.fontSans,
  fontSize: "14px",
  lineHeight: "21px",
  margin: "16px 0 0",
};

export function formatPrice(price: number, currency: string): string {
  const iso = currency?.toUpperCase() || "USD";
  try {
    // No trailing ".00" on whole amounts: "NGN 7,700", not "NGN 7,700.00".
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: iso,
      minimumFractionDigits: 0,
      maximumFractionDigits: iso === "JPY" ? 0 : 2,
    }).format(price);
  } catch {
    return `${iso} ${price}`;
  }
}

// "monthly" to "month". Lets bodies read like speech: "another month of".
export function intervalNoun(billingInterval: string): string {
  const v = billingInterval.trim().toLowerCase();
  if (v.startsWith("month")) return "month";
  if (v.startsWith("year") || v.startsWith("annual")) return "year";
  if (v.startsWith("week")) return "week";
  if (v.startsWith("quarter")) return "quarter";
  if (v.startsWith("day") || v.startsWith("daily")) return "day";
  return billingInterval.trim() || "period";
}

export function shortInterval(billingInterval: string): string {
  const v = billingInterval.toLowerCase();
  if (v.startsWith("month")) return "mo";
  if (v.startsWith("year") || v.startsWith("annual")) return "yr";
  if (v.startsWith("week")) return "wk";
  if (v.startsWith("quarter")) return "qtr";
  if (v.startsWith("day") || v.startsWith("daily")) return "day";
  return billingInterval;
}

// Names read better with the plan in brackets once, then bare after.
export function namedPlan(d: EmailData): string {
  return d.product && d.product !== d.merchant
    ? `${d.merchant} (${d.product})`
    : d.merchant;
}

function linkBase(color: string): React.CSSProperties {
  return {
    color,
    fontWeight: "bold",
    textDecoration: "underline",
  };
}

// Inline links for quiet paths. Loud moments get MainButton instead.
export function ActionLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} style={linkBase(t.primary)}>
      {children}
    </a>
  );
}

export function QuietLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} style={linkBase(t.muted)}>
      {children}
    </a>
  );
}

// One primary tap per urgent mail. Receipts and calm mails stay link only.
export function MainButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      style={{
        backgroundColor: t.primary,
        borderRadius: t.radiusInner,
        boxSizing: "border-box",
        color: t.onPrimary,
        display: "block",
        fontFamily: t.fontSans,
        fontSize: "15px",
        fontWeight: "bold",
        margin: "16px 0 4px",
        padding: "13px 20px",
        textAlign: "center",
        textDecoration: "none",
        width: "100%",
      }}
    >
      {children}
    </a>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return (
    <strong style={{ color: t.foreground, fontWeight: "bold" }}>
      {children}
    </strong>
  );
}

// One-line title without react-email's Text wrapper (avoids nested p).
export function NarrativeTitle({ children }: { children: ReactNode }) {
  return <p style={{ ...title, margin: "0 0 12px" }}>{children}</p>;
}

export { EmailLayout };
