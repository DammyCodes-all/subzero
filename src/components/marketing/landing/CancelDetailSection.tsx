import { LegalDocument01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { LandingEyebrow } from "./LandingEyebrow";

const STEPS = [
  "Open Adobe account",
  "Go to Plans",
  "Select Manage plan",
  "Continue cancellation",
];

export function CancelDetailSection() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <LandingEyebrow>Cancellation</LandingEyebrow>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance md:text-[2.5rem] md:leading-[1.1]">
              Know exactly how to cancel.
            </h2>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              SubZero researches the merchant&apos;s current cancellation path
              and gives you the next step.
            </p>
          </div>

          <div
            aria-hidden="true"
            className="rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-black/40 md:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-xl font-bold">
                  A
                </span>
                <div>
                  <p className="text-[15px] font-semibold">
                    Adobe Creative Cloud
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    <span className="font-numeric">$54.99/mo</span>
                    {" · Renews in 2 days"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <span className="rounded-md bg-destructive/15 px-2.5 py-1 text-xs font-bold tracking-wide text-destructive">
                High
              </span>
              <span className="rounded-md bg-secondary px-2.5 py-1 font-mono text-xs text-muted-foreground">
                7 steps
              </span>
            </div>

            <ol className="mt-5 space-y-2.5">
              {STEPS.map((step, i) => (
                <li
                  key={step}
                  className="flex items-center gap-3 rounded-lg border border-border/70 px-3.5 py-2.5 text-sm"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs text-primary">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
              <li className="px-3.5 py-1 font-mono text-sm text-muted-foreground">
                ...
              </li>
            </ol>

            <span className="mt-5 block rounded-lg bg-primary px-4 py-3 text-center text-sm font-bold text-primary-foreground">
              Open cancellation
            </span>

            <div className="mt-5 flex items-center gap-3 rounded-lg border border-primary/25 bg-primary/[0.05] px-3.5 py-3">
              <HugeiconsIcon
                icon={LegalDocument01Icon as never}
                size={18}
                color="currentColor"
              />
              <div>
                <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                  Source
                </p>
                <p className="mt-0.5 text-sm font-semibold">
                  Adobe cancellation help page
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
