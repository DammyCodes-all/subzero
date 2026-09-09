import { LandingEyebrow } from "./LandingEyebrow";
import { ProblemVisual } from "./ProblemVisual";

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

        <ProblemVisual />
      </div>
    </section>
  );
}
