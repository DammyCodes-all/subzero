"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared click choreography for the intake showcase.
 *
 * StageCursor waits for the target to visually settle (two consecutive
 * animation frames with an unchanged rect), measures its live center,
 * glides to it, then pulses (1 → 0.7 → 1). Settling is detected directly
 * rather than assumed from a timeout, so it stays correct even if
 * StageSwap's transition durations change later or a frame drops.
 */
export const CURSOR_DELAY_S = 0.05;
export const MOVE_S = 0.5;
const PULSE_S = 0.35;
const CLICK_AT = CURSOR_DELAY_S + MOVE_S;
export const CLICK_MS = Math.round((CLICK_AT + PULSE_S) * 1000) + 150;
const OFFSET = { x: 72, y: -52 };
const MAX_SETTLE_FRAMES = 30; // ~0.5s safety cap at 60fps

type Point = { x: number; y: number };

function waitForSettle(el: HTMLElement, onSettled: () => void): () => void {
  let timerId: number;
  const rafId = requestAnimationFrame(() => {
    timerId = window.setTimeout(onSettled, 60);
  });
  return () => {
    cancelAnimationFrame(rafId);
    clearTimeout(timerId);
  };
}

export function StageCursor({
  containerRef,
  targetRef,
}: {
  containerRef: { current: HTMLElement | null };
  targetRef: { current: HTMLElement | null };
}) {
  const [geom, setGeom] = useState<{ start: Point; dest: Point } | null>(null);

  // Re-run on every mount/replay — never cache across replays, since
  // layout can legitimately shift between loops (responsive, content, etc.)
  useEffect(() => {
    setGeom(null);
    const target = targetRef.current;
    const container = containerRef.current;
    if (!target || !container) return;

    const cancel = waitForSettle(target, () => {
      const c = container.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      const dest: Point = {
        x: r.left - c.left + r.width / 2,
        y: r.top - c.top + r.height / 2,
      };
      setGeom({
        start: { x: dest.x + OFFSET.x, y: dest.y + OFFSET.y },
        dest,
      });
    });

    return cancel;
  }, [containerRef, targetRef]);

  if (!geom) return null;

  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-20"
      initial={{ x: geom.start.x, y: geom.start.y, opacity: 0, scale: 0.5 }}
      animate={{ x: geom.dest.x, y: geom.dest.y, opacity: 1, scale: 1 }}
      transition={{
        x: { duration: MOVE_S, delay: CURSOR_DELAY_S, ease: "easeInOut" },
        y: { duration: MOVE_S, delay: CURSOR_DELAY_S, ease: "easeInOut" },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
      }}
    >
      <motion.span
        className="-mt-2 -ml-2 block h-4 w-4 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.45)] ring-2 ring-black/80"
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1, 0.7, 1] }}
        transition={{ duration: PULSE_S, delay: CLICK_AT, ease: "easeInOut" }}
      />
    </motion.span>
  );
}

/**
 * Wraps a mock button so it compresses (1 → 0.96 → 1) with a brief
 * highlight ripple exactly when the cursor pulse lands. Always mounted —
 * only animates while `clicking` — so the target never remounts mid-stage.
 */
export function ClickTarget({
  clicking,
  children,
  className,
}: {
  clicking: boolean;
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const live = clicking && !reduceMotion;
  return (
    <motion.span
      className={cn("relative inline-block", className)}
      initial={false}
      animate={live ? { scale: [1, 1, 0.96, 1] } : { scale: 1 }}
      transition={{ duration: PULSE_S, delay: live ? CLICK_AT : 0 }}
    >
      {children}
      {live ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-primary/25"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.7, 0] }}
          transition={{ duration: 0.4, delay: CLICK_AT }}
        />
      ) : null}
    </motion.span>
  );
}

/**
 * Consistent stage handoff: popLayout takes the exiting stage out of flow
 * (effectively absolute while it exits) so it can't push the incoming
 * stage around; `layout` smooths container resizing between stages of
 * different heights instead of snapping.
 */
export function StageSwap({
  stageKey,
  children,
}: {
  stageKey: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        key={stageKey}
        layout
        variants={{
          initial: { opacity: 0, y: 8 },
          enter: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.3, delay: 0.1, ease: "easeOut" },
          },
          exit: {
            opacity: 0,
            y: -8,
            transition: { duration: 0.25, ease: "easeIn" },
          },
        }}
        initial="initial"
        animate="enter"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
