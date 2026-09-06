import Link from "next/link";
import { SubzeroWithWordmark } from "@/components/brand/SubzeroLogo";
import { FooterYear } from "@/components/marketing/FooterYear";

const PRODUCT_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
];

const COMPANY_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/contact" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="space-y-3">
            <Link href="/" aria-label="SubZero home">
              <SubzeroWithWordmark width={120} height={40} />
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              AI-powered subscription protection.
            </p>
          </div>

          <nav aria-label="Product" className="space-y-3">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Product
            </p>
            <ul className="space-y-2">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Company" className="space-y-3">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Company
            </p>
            <ul className="space-y-2">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © <FooterYear /> SubZero. All rights reserved.
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            Your subscriptions shouldn&apos;t surprise you.
          </p>
        </div>
      </div>
    </footer>
  );
}
