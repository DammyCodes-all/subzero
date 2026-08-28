"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
