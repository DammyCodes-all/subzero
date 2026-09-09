import Link from "next/link";
import { Button } from "@/components/ui/button";

export function FinalCtaSection() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center md:py-20">
          <div
            aria-hidden="true"
            className="absolute -top-24 left-1/2 h-48 w-2/3 -translate-x-1/2 rounded-full bg-primary/[0.08] blur-3xl"
          />
          <h2 className="relative text-3xl font-bold tracking-tight text-balance md:text-[2.5rem] md:leading-[1.1]">
            Know what&apos;s renewing. Know what to do.
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl leading-relaxed text-muted-foreground">
            SubZero finds your subscriptions, warns you before they renew, and
            shows you the verified way to cancel before you&apos;re charged.
          </p>
          <Link
            href="/auth?mode=signup"
            className="relative mt-9 inline-block w-full sm:w-auto"
          >
            <Button
              size="lg"
              className="h-13 w-full px-8 text-[15px] font-bold sm:w-auto"
            >
              Find my subscriptions
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
