"use client";

import { useRef } from "react";

type Props = {
  badge: string;
  subject: string;
  html: string;
};

// Borderless iframe that shrinks to the email — the preview shows the
// mail itself, not a box around it.
export function EmailPreviewCard({ badge, subject, html }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const fit = () => {
    const doc = ref.current?.contentDocument;
    if (doc && ref.current) {
      ref.current.style.height = `${doc.documentElement.scrollHeight}px`;
    }
  };

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {badge}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          text/html
        </span>
      </div>
      <p className="space-y-1 px-5 pt-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Subject: </span>
        <span className="text-foreground">{subject}</span>
      </p>
      <div className="px-2 py-2">
        <iframe
          ref={ref}
          title={subject}
          srcDoc={html}
          loading="lazy"
          onLoad={fit}
          className="w-full border-0"
        />
      </div>
    </article>
  );
}
