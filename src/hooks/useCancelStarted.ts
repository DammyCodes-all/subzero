"use client";

import { useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Fire-and-forget flip to `user_started` for CTA clicks that send the user
 * off to cancel. Never blocks navigation; failures are silent because the
 * backend guard makes the flip idempotent and forward-only.
 */
export function useCancelStarted() {
  const markStarted = useMutation(api.actions.markStarted);
  return useCallback(
    (id: Id<"subscriptions"> | string) => {
      try {
        void markStarted({ id: id as Id<"subscriptions"> }).catch(() => {});
      } catch {}
    },
    [markStarted],
  );
}
