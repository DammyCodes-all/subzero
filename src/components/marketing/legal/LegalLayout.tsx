"use client";

import { LegalDesktopNav } from "./LegalDesktopNav";
import { LegalMobileNav } from "./LegalMobileNav";
import type { LegalLayoutProps } from "./legal-types";
import { useLegalScrollSpy } from "./use-legal-scrollspy";

export function LegalLayout({
  eyebrow,
  title,
  intro,
  updated,
  sections,
  children,
}: LegalLayoutProps) {
  const activeId = useLegalScrollSpy(sections);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance md:text-4xl">
          {title}
        </h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">{intro}</p>
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          Last updated: {updated}
        </p>
      </div>

      <LegalMobileNav sections={sections} activeId={activeId} />

      <div className="mt-10 grid gap-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
        <LegalDesktopNav sections={sections} activeId={activeId} />

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
