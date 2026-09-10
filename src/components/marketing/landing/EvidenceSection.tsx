import { ShieldCheckIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { LandingEyebrow } from "./LandingEyebrow";

export function EvidenceSection() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <LandingEyebrow>Evidence</LandingEyebrow>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance md:text-[2.5rem] md:leading-[1.1]">
            See why SubZero says what it says.
          </h2>
          <p className="mt-5 leading-relaxed text-muted-foreground">
            Important subscription details are backed by the email or source
            they came from.
          </p>
        </div>

        <div
          aria-hidden="true"
          className="mx-auto mt-12 max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-black/40 md:p-7"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-xl font-bold">
              A
            </span>
            <p className="text-lg font-bold tracking-tight">
              Adobe Creative Cloud
            </p>
          </div>

          <dl className="mt-6 space-y-4">
            <div className="rounded-xl border-l-2 border-primary bg-background/60 px-4 py-3">
              <dt className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                Renewal
              </dt>
              <dd className="mt-1 text-[15px] font-semibold">
                Renews Sep 3, 2026
              </dd>
            </div>

            <div className="rounded-xl border-l-2 border-primary bg-background/60 px-4 py-3">
              <dt className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                Source
              </dt>
              <dd className="mt-1 text-[15px] font-semibold">Adobe email</dd>
              <dd className="mt-2 border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground italic">
                Your trial ends September 3, 2026 and your plan will renew...
              </dd>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.05] px-4 py-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                <HugeiconsIcon
                  icon={ShieldCheckIcon as never}
                  size={18}
                  color="currentColor"
                />
              </span>
              <div>
                <dt className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                  Cancellation source
                </dt>
                <dd className="mt-0.5 text-[15px] font-semibold">
                  Adobe cancellation help page
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
