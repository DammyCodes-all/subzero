import {
  ArrowLeftRightIcon,
  CustomerSupportIcon,
  GlobeIcon,
  MailSend01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { LandingEyebrow } from "./LandingEyebrow";

const CARDS = [
  {
    icon: GlobeIcon,
    heading: "Cancel on the merchant site",
    body: "The subscription can be cancelled through the merchant.",
    cta: "Open cancellation",
  },
  {
    icon: ArrowLeftRightIcon,
    heading: "Billed through a provider",
    body: "The subscription is managed through Google Play.",
    cta: "Open Google Play",
  },
  {
    icon: MailSend01Icon,
    heading: "Cancellation by email",
    body: "The merchant accepts cancellation by email.",
    cta: "Review & send",
  },
  {
    icon: CustomerSupportIcon,
    heading: "Support required",
    body: "Cancellation requires contacting support.",
    cta: "Contact support",
  },
];

export function CancelPathsSection() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <LandingEyebrow>Cancellation actions</LandingEyebrow>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance md:text-[2.5rem] md:leading-[1.1]">
            The right path depends on the subscription.
          </h2>
          <p className="mt-5 leading-relaxed text-muted-foreground">
            SubZero identifies the cancellation route and gives you the
            appropriate action.
          </p>
        </div>

        <div
          aria-hidden="true"
          className="mx-auto mt-12 grid max-w-4xl gap-5 sm:grid-cols-2"
        >
          {CARDS.map((card) => (
            <div
              key={card.heading}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
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
              <span className="mt-5 block rounded-lg border border-primary/50 px-4 py-2.5 text-center text-sm font-bold text-primary">
                {card.cta}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
