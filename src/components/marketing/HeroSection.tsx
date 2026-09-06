import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center md:px-8 md:pt-24">
      <p className="mx-auto inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
        AI-powered subscription protection
      </p>
      <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-bold tracking-tight text-balance md:text-6xl">
        Your subscriptions shouldn&apos;t surprise you.
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
        SubZero finds your subscriptions, warns you before renewals, and
        researches the exact way to cancel — before you&apos;re charged.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href="/auth?mode=signup">
          <Button size="lg" className="w-full sm:w-auto">
            Find my subscriptions
          </Button>
        </Link>
        <Link href="/#how-it-works">
          <Button variant="outline" size="lg" className="w-full sm:w-auto">
            See how it works
          </Button>
        </Link>
      </div>
      <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <Image
          src="/mail-mockup.png"
          alt="SubZero dashboard showing subscriptions that need attention"
          width={1200}
          height={750}
          priority
          className="h-auto w-full"
        />
      </div>
    </section>
  );
}
