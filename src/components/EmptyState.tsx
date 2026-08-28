"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ScanningState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <p className="text-sm text-muted-foreground">
        Scanning your subscription emails…
      </p>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-border">
        <div className="h-full w-1/2 animate-[shimmer_1.2s_ease-in-out_infinite] bg-primary/60 rounded-full" />
      </div>
      <div className="flex gap-1">
        <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:0ms]" />
        <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
        <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
      </div>
      <style>{`@keyframes shimmer { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } }`}</style>
    </div>
  );
}

export function ZeroAttentionState() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-6 text-center">
      <Check className="size-4 shrink-0 text-primary" />
      <p className="text-sm font-medium text-primary">
        Nothing needs you right now
      </p>
    </div>
  );
}

export function NoSubscriptionsState() {
  return (
    <div className="rounded-lg border border-dashed bg-card p-10 text-center">
      <h3 className="font-heading text-base font-semibold">
        No subscriptions yet
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Connect your Google account and SubZero will find recurring
        subscriptions and trials in your inbox.
      </p>
      <Link href="/auth" className="mt-4 inline-block">
        <Button className="font-medium">Connect Google</Button>
      </Link>
    </div>
  );
}
