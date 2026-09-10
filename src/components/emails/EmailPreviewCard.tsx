type Props = {
  badge: string;
  subject: string;
  html: string;
};

// Designed HTML preview — renders exactly what the inbox receives.
export function EmailPreviewCard({ badge, subject, html }: Props) {
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
      <div className="space-y-1 px-5 pt-4 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">From:</span> SubZero
          &lt;hello@subzero.app&gt;
        </p>
        <p>
          <span className="font-medium text-foreground">To:</span> you
        </p>
        <p>
          <span className="font-medium text-foreground">Subject:</span>{" "}
          <span className="text-foreground">{subject}</span>
        </p>
      </div>
      <div className="px-5 py-4">
        <iframe
          title={subject}
          srcDoc={html}
          loading="lazy"
          className="h-[560px] w-full rounded-lg border border-border/40 bg-white"
        />
      </div>
    </article>
  );
}
