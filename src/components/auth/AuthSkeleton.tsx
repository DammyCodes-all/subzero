import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";

function FieldSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-3.5 w-16 animate-pulse rounded bg-foreground/10 motion-reduce:animate-none" />
      <div className="h-11 w-full animate-pulse rounded-lg bg-foreground/[0.07] motion-reduce:animate-none" />
    </div>
  );
}

/** Mirrors the auth form layout so loading resolves without a snap. */
export function AuthSkeleton({ fields }: { fields: number }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <span role="status" className="sr-only">
        Loading…
      </span>
      <div aria-hidden className="absolute inset-0">
        <DarkGradientBg className="absolute inset-0" />
      </div>
      <div aria-hidden className="relative z-10 w-full max-w-sm p-6 sm:p-10">
        <div className="h-9 w-[120px] animate-pulse rounded-md bg-foreground/10 motion-reduce:animate-none" />
        <div className="mt-6 h-8 w-4/5 animate-pulse rounded-md bg-foreground/10 motion-reduce:animate-none" />
        <div className="mt-2 h-4 w-3/5 animate-pulse rounded-md bg-foreground/10 motion-reduce:animate-none" />
        <div className="mt-6 h-12 w-full animate-pulse rounded-lg bg-foreground/10 motion-reduce:animate-none" />
        <div className="my-5 h-px bg-border/60" />
        <div className="space-y-4">
          <FieldSkeleton />
          <FieldSkeleton />
          {fields > 2 && <FieldSkeleton />}
          <div className="h-11 w-full animate-pulse rounded-lg bg-primary/20 motion-reduce:animate-none" />
        </div>
      </div>
    </main>
  );
}
