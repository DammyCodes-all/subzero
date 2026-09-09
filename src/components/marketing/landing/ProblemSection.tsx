import {
  AlarmClockIcon,
  BellRingIcon,
  CheckmarkCircle02Icon,
  MailCheckIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import { LandingEyebrow } from "./LandingEyebrow";

const CARDS = [
  {
    icon: AlarmClockIcon,
    title: "Your trial ends soon",
    className: "lg:rotate-[-5deg] lg:translate-x-2",
  },
  {
    icon: BellRingIcon,
    title: "Your subscription renews tomorrow",
    className: "lg:rotate-[3deg] lg:-translate-x-3",
  },
  {
    icon: MailCheckIcon,
    title: "Your receipt",
    className: "lg:rotate-[4deg] lg:translate-x-6",
  },
  {
    icon: CheckmarkCircle02Icon,
    title: "Payment successful",
    className: "lg:rotate-[-3deg] lg:translate-x-0",
  },
];

export function ProblemSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <LandingEyebrow>The Problem</LandingEyebrow>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance md:text-[2.5rem] md:leading-[1.1]">
            Subscriptions are easy to miss.
          </h2>
          <p className="mt-5 leading-relaxed text-muted-foreground">
            Trials turn into charges, renewal dates sneak up, and cancelling can
            mean digging through settings, help pages, or the wrong billing
            provider.
          </p>
          <p className="mt-5 border-l-2 border-primary/60 pl-4 text-sm leading-relaxed text-muted-foreground">
            The hard part isn&apos;t knowing you have subscriptions. It&apos;s
            knowing which ones need attention.
          </p>
        </div>

        <div aria-hidden="true" className="relative">
          <div className="grid gap-4 sm:grid-cols-2 lg:gap-5">
            {CARDS.map((card) => (
              <div
                key={card.title}
                className={cn(
                  "rounded-xl border border-border bg-card p-5 shadow-lg shadow-black/30",
                  card.className,
                )}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
                  <HugeiconsIcon
                    icon={card.icon as never}
                    size={18}
                    color="currentColor"
                  />
                </span>
                <p className="mt-3 text-sm font-semibold">{card.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
