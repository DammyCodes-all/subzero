import type { ReactNode } from "react";

export function LegalBody({ children }: { children: ReactNode }) {
  return <div className="space-y-12">{children}</div>;
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-32">
      <h2
        id={`${id}-heading`}
        className="text-xl font-bold tracking-tight text-balance"
      >
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_a]:text-foreground [&_a]:underline [&_a]:decoration-primary/60 [&_a]:underline-offset-4 hover:[&_a]:decoration-primary">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-primary">{children}</ul>
  );
}

export function LegalNote({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.05] p-5 text-[15px] leading-relaxed">
      <p className="font-semibold text-foreground">{title}</p>
      <div className="mt-2 space-y-2 text-muted-foreground">{children}</div>
    </div>
  );
}
