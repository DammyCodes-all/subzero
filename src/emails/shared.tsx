import { Button, Column, Row, Text } from "react-email";
import { EmailLayout } from "./emailLayout";
import { emailTheme as t } from "./theme";

export type EmailData = {
  merchant: string;
  product?: string;
  priceStr: string;
  billingInterval: string;
  renewalStr: string;
  trialStr: string;
  label: string;
  urgent?: boolean;
  ctaUrl: string;
  cancelUrl?: string;
  manageUrl: string;
};

export function eyebrow(color: string): React.CSSProperties {
  return {
    color,
    fontFamily: t.fontSans,
    fontSize: "11px",
    fontWeight: "bold",
    letterSpacing: "1.5px",
    lineHeight: "16px",
    margin: "0 0 4px",
    textTransform: "uppercase",
  };
}

export const h: React.CSSProperties = {
  color: t.foreground,
  fontFamily: t.fontHeading,
  fontSize: "22px",
  lineHeight: "30px",
  margin: "0 0 8px",
};

export const p: React.CSSProperties = {
  color: t.muted,
  fontFamily: t.fontSans,
  fontSize: "14px",
  lineHeight: "21px",
  margin: "0 0 12px",
};

export const meta: React.CSSProperties = {
  backgroundColor: t.metaBg,
  border: `1px solid ${t.divider}`,
  borderRadius: t.radiusInner,
  color: t.foreground,
  fontFamily: t.fontSans,
  fontSize: "14px",
  lineHeight: "24px",
  margin: "16px 0",
  padding: "12px 16px",
};

export const metaLabel: React.CSSProperties = {
  color: t.faint,
  display: "inline-block",
  minWidth: "88px",
};

export function formatPrice(price: number, currency: string): string {
  const iso = currency?.toUpperCase() || "USD";
  try {
    // No trailing ".00" on whole amounts — "NGN 7,700", not "NGN 7,700.00".
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

export function shortInterval(billingInterval: string): string {
  const v = billingInterval.toLowerCase();
  if (v.startsWith("month")) return "mo";
  if (v.startsWith("year") || v.startsWith("annual")) return "yr";
  if (v.startsWith("week")) return "wk";
  if (v.startsWith("quarter")) return "qtr";
  if (v.startsWith("day") || v.startsWith("daily")) return "day";
  return billingInterval;
}

// Initial tile — visual anchor without external images (which need
// absolute URLs and get blocked by default in most inboxes).
export function MerchantMark({ name }: { name: string }) {
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  return (
    <span
      style={{
        backgroundColor: t.primary,
        borderRadius: "10px",
        color: t.onPrimary,
        display: "inline-block",
        fontFamily: t.fontHeading,
        fontSize: "18px",
        fontWeight: "bold",
        height: "40px",
        lineHeight: "40px",
        textAlign: "center",
        width: "40px",
      }}
    >
      {initial}
    </span>
  );
}
export function Cta({ href, children }: { href: string; children: string }) {
  return (
    <Button
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
        margin: "8px 0 4px",
        padding: "14px 20px",
        textAlign: "center",
        textDecoration: "none",
        width: "100%",
      }}
    >
      {children}
    </Button>
  );
}

export function DirectCancel({ d }: { d: EmailData }) {
  if (!d.cancelUrl)
    return <Text style={p}>Open SubZero to view cancellation steps.</Text>;
  return (
    <Text style={p}>
      Prefer to cancel directly?{" "}
      <a
        href={d.cancelUrl}
        style={{ color: t.foreground, textDecoration: "underline" }}
      >
        Cancel with {d.merchant}
      </a>
    </Text>
  );
}

export { EmailLayout };

// Merchant mark + eyebrow + name as one unit, so every template opens
// with a visual anchor instead of a bare text stack.
export function MailHeader({
  merchant,
  product,
  eyebrowText,
  accent,
}: {
  merchant: string;
  product?: string;
  eyebrowText: string;
  accent: string;
}) {
  return (
    <Row>
      <Column style={{ verticalAlign: "top", width: "52px" }}>
        <MerchantMark name={merchant} />
      </Column>
      <Column>
        <Text style={eyebrow(accent)}>{eyebrowText}</Text>
        <p
          style={{
            color: t.foreground,
            fontFamily: t.fontHeading,
            fontSize: "22px",
            fontWeight: "bold",
            lineHeight: "28px",
            margin: "0",
          }}
        >
          {merchant}
        </p>
        {product ? (
          <Text
            style={{
              color: t.faint,
              fontFamily: t.fontSans,
              fontSize: "13px",
              lineHeight: "18px",
              margin: "2px 0 0",
            }}
          >
            {product}
          </Text>
        ) : null}
      </Column>
    </Row>
  );
}
