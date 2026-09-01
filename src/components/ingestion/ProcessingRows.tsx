"use client";

import { useQuery } from "convex/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { api } from "../../../convex/_generated/api";

// Gate: occasional (few forwards/day) → standard animation
// Purpose: state indication + preventing jarring list jump + spatial consistency (top)
// Tool: Motion for exit + interruptible layout
// Props: transform + opacity only, never width/height
// Curve: --ease-out (0.23,1,0.32,1), duration 220ms (<300ms), stagger 45ms
export function ProcessingRows() {
  const reduce = useReducedMotion();
  const recent = useQuery(api.ingestionAttempts.listRecent, { limit: 5 });
  const processing = (recent ?? []).filter((a) => a.status === "processing");

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {processing.map((a, i) => (
          <motion.div
            key={a._id}
            layout={!reduce}
            initial={{
              opacity: 0,
              transform: reduce
                ? "translateY(0px) scale(1)"
                : "translateY(-6px) scale(0.98)",
            }}
            animate={{
              opacity: 1,
              transform: "translateY(0px) scale(1)",
            }}
            exit={{
              opacity: 0,
              transform: reduce
                ? "translateY(0px) scale(1)"
                : "translateY(-6px) scale(0.98)",
            }}
            transition={{
              duration: 0.22,
              ease: [0.23, 1, 0.32, 1],
              delay: reduce ? 0 : i * 0.045,
            }}
            className="flex items-center gap-3 rounded-lg border border-dashed bg-card px-4 py-3"
          >
            <span
              className="size-2 shrink-0 rounded-full bg-primary animate-pulse"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">
                Checking &ldquo;{a.subject?.slice(0, 32) ?? "receipt"}&rdquo;...
              </p>
              <p className="text-xs text-muted-foreground">
                Looking for subscription details. One moment
              </p>
            </div>
            <span
              className="ml-auto hidden h-2 w-16 shrink-0 rounded bg-border/60 sm:block"
              style={
                reduce
                  ? undefined
                  : { animation: "pulse 2s var(--ease-out) infinite" }
              }
              aria-hidden
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
