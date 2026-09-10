import { LandingEyebrow } from "./LandingEyebrow";

function AttentionRow({
  initial,
  name,
  price,
  renews,
  urgent,
}: {
  initial: string;
  name: string;
  price: string;
  renews: string;
  urgent?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-background/60 p-4">
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-lg font-bold"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          <span className="font-numeric">{price}</span>
          {" · "}
          <span className={urgent ? "text-destructive" : undefined}>
            {renews}
          </span>
        </p>
      </div>
    </div>
  );
}

export function AttentionSection() {
  return (
    <section id="features" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <LandingEyebrow>Subzero</LandingEyebrow>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance md:text-[2.5rem] md:leading-[1.1]">
            Know what needs your attention.
          </h2>
          <p className="mt-5 leading-relaxed text-muted-foreground">
            SubZero brings your subscriptions together, watches renewal dates,
            and shows you what to do before a charge hits.
          </p>
        </div>

        <div
          aria-hidden="true"
          className="mx-auto mt-12 max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-black/40 md:p-7"
        >
          <p className="text-xs font-semibold tracking-[0.22em] text-muted-foreground">
            Needs attention
          </p>
          <div className="mt-4 space-y-3">
            <AttentionRow
              initial="A"
              name="Adobe Creative Cloud"
              price="$54.99/mo"
              renews="Renews in 2 days"
              urgent
            />
            <AttentionRow
              initial="C"
              name="Canva"
              price="$15/mo"
              renews="Renews in 6 days"
            />
          </div>

          <p className="mt-7 text-xs font-semibold tracking-[0.22em] text-muted-foreground">
            All subscriptions
          </p>
          <div className="mt-4 space-y-3 opacity-60">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl border border-border/70 p-4"
              >
                <span className="h-11 w-11 shrink-0 rounded-lg bg-secondary" />
                <div className="flex-1 space-y-2">
                  <span className="block h-3 w-2/5 rounded-full bg-secondary" />
                  <span className="block h-3 w-1/4 rounded-full bg-secondary" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
