import {
  FileUploadIcon,
  Forward01Icon,
  MailSearch01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import { LandingEyebrow } from "./LandingEyebrow";

const CARDS = [
  {
    number: "01",
    icon: MailSearch01Icon,
    heading: "Connect Gmail",
    body: "SubZero scans receipts and trial emails to find your subscriptions.",
    primary: true,
  },
  {
    number: "02",
    icon: Forward01Icon,
    heading: "Forward an email",
    body: "Forward a receipt or subscription email to your SubZero address.",
    primary: false,
  },
  {
    number: "03",
    icon: FileUploadIcon,
    heading: "Add one manually",
    body: "Upload a receipt or enter the subscription details yourself.",
    primary: false,
  },
];

export function IntakeSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <LandingEyebrow>Get started</LandingEyebrow>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance md:text-[2.5rem] md:leading-[1.1]">
            Bring your subscriptions in.
          </h2>
          <p className="mt-5 leading-relaxed text-muted-foreground">
            SubZero can find them through your email, a forwarded receipt, or
            details you add yourself.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {CARDS.map((card) => (
            <div
              key={card.number}
              className={cn(
                "relative rounded-2xl border bg-card p-6",
                card.primary ? "border-primary/60" : "border-border",
              )}
            >
              {card.primary && (
                <span className="absolute top-5 right-5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold tracking-wide text-primary-foreground uppercase">
                  Primary
                </span>
              )}
              <p className="font-mono text-xs text-muted-foreground">
                {card.number}
              </p>
              <span className="mt-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
                <HugeiconsIcon
                  icon={card.icon as never}
                  size={20}
                  color="currentColor"
                />
              </span>
              <h3 className="mt-4 text-lg font-bold tracking-tight">
                {card.heading}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
