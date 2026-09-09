import { ArrowDown01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { LandingEyebrow } from "./LandingEyebrow";

const STEPS = [
  "Active",
  "Action ready",
  "User started",
  "Pending",
  "Cancelled",
];

export function StatusSection() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <LandingEyebrow>Cancellation status</LandingEyebrow>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance md:text-[2.5rem] md:leading-[1.1]">
            Know when it&apos;s actually cancelled.
          </h2>
          <p className="mt-5 leading-relaxed text-muted-foreground">
            When a cancellation confirmation arrives, SubZero picks it up and
            updates the subscription.
          </p>
        </div>

        <div aria-hidden="true" className="mx-auto mt-12 max-w-4xl">
          <ol className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
            {STEPS.map((step, i) => {
              const isLast = i === STEPS.length - 1;
              return (
                <Fragment key={step}>
                  <li
                    className={cn(
                      "flex-1 rounded-xl border px-4 py-3 text-center text-sm font-bold",
                      isLast
                        ? "border-primary bg-primary text-primary-foreground shadow-[0_0_50px_-16px_var(--primary)]"
                        : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {isLast && (
                      <span className="mb-1 block font-mono text-[10px] font-medium tracking-widest uppercase opacity-80">
                        Confirmation received
                      </span>
                    )}
                    {step}
                  </li>
                  {!isLast && (
                    <span className="flex justify-center text-muted-foreground">
                      <span className="md:hidden">
                        <HugeiconsIcon
                          icon={ArrowDown01Icon as never}
                          size={18}
                          color="currentColor"
                        />
                      </span>
                      <span className="hidden md:inline">
                        <HugeiconsIcon
                          icon={ArrowRight01Icon as never}
                          size={18}
                          color="currentColor"
                        />
                      </span>
                    </span>
                  )}
                </Fragment>
              );
            })}
          </ol>
          <div className="mt-4 flex md:justify-center">
            <p className="rounded-lg border border-dashed border-border px-4 py-2 font-mono text-xs tracking-widest text-muted-foreground uppercase">
              Failed
            </p>
          </div>
          <p className="mt-2 text-center font-mono text-[11px] text-muted-foreground/70">
            branches from Pending
          </p>
        </div>
      </div>
    </section>
  );
}
