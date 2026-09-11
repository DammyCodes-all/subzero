"use client";

import { Add01Icon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion, useInView, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FirstScanSummary } from "@/components/ingestion/FirstScanSummary";
import { FirstScanView } from "@/components/ingestion/FirstScanView";
import { ADOBE_SUB, SPOTIFY_SUB } from "./fixtures";
import { CLICK_MS, ClickTarget, StageCursor, StageSwap } from "./StageCursor";

/**
 * Mirrors the real dashboard first-scan sequence:
 * AuthenticatedEmptyState (not connected) → FirstScanView → FirstScanSummary.
 * The OAuth consent itself happens on Google's site, so there is no
 * in-app consent stage to mirror — the click cuts straight to the scan.
 */
type Stage = "connect" | "connecting" | "scanning" | "summary";

const ORDER: Stage[] = ["connect", "connecting", "scanning", "summary"];

/* Click stage derives from CLICK_MS; the summary holds long enough to
 * read before the loop restarts. Total loop lands around ~10s. */
const HOLDS: Record<Stage, number> = {
  connect: CLICK_MS + 250,
  connecting: 2300,
  scanning: 3200,
  summary: 4000,
};

const COUNT_TICKS = [
  { at: 500, found: 3 },
  { at: 1100, found: 6 },
  { at: 1700, found: 8 },
];

function sleep(ms: number, timers: number[]) {
  return new Promise<void>((resolve) => {
    const t = window.setTimeout(resolve, ms);
    timers.push(t);
  });
}

export function GmailIntakeMock({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const inViewRef = useRef<HTMLDivElement>(null);
  const inView = useInView(inViewRef, { margin: "-64px" });
  const connectRef = useRef<HTMLSpanElement>(null);
  const [stage, setStage] = useState<Stage>("connect");
  const [running, setRunning] = useState(false);
  const [found, setFound] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!active || !inView || reduceMotion) return;
    let cancelled = false;
    const timers: number[] = [];
    setRunning(true);
    async function loop() {
      await sleep(350, timers);
      while (!cancelled) {
        for (const next of ORDER) {
          if (cancelled) return;
          setStage(next);
          await sleep(HOLDS[next], timers);
        }
      }
    }
    loop();
    return () => {
      cancelled = true;
      timers.forEach((t) => {
        clearTimeout(t);
      });
      setRunning(false);
    };
  }, [active, inView, reduceMotion]);

  // Flip to the connected confirmation right as the ring completes.
  useEffect(() => {
    if (stage !== "connecting" || reduceMotion) return;
    setConnected(false);
    const t = window.setTimeout(() => setConnected(true), 1350);
    return () => clearTimeout(t);
  }, [stage, reduceMotion]);

  // Live receipt counter while scanning — mirrors the streaming count
  // the real scan screen shows as receipts are found.
  useEffect(() => {
    if (stage !== "scanning" || reduceMotion) return;
    setFound(0);
    const timers = COUNT_TICKS.map((tick) =>
      window.setTimeout(() => setFound(tick.found), tick.at),
    );
    return () => {
      timers.forEach((t) => {
        clearTimeout(t);
      });
    };
  }, [stage, reduceMotion]);

  const settled = reduceMotion || !active;
  const clicking = running && !settled && stage === "connect";
  const shown: Stage = settled ? "summary" : stage;

  return (
    <div ref={inViewRef}>
      <div
        ref={containerRef}
        aria-hidden="true"
        inert
        className="relative mx-auto w-full max-w-xl"
      >
        <StageSwap stageKey={shown}>
          {shown === "connect" && (
            /* Mirrors AuthenticatedEmptyState (dashboard, Gmail not
             * connected): mailbox art, heading, copy, full-width CTA. */
            <div className="mx-auto max-w-sm px-2 py-4 text-center">
              <Image
                src="/mail-mockup.png"
                alt=""
                width={768}
                height={512}
                className="mx-auto h-auto w-full max-w-[260px]"
              />
              <p className="mt-4 font-heading text-xl font-semibold tracking-tight">
                No subscriptions yet
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Connect Gmail and SubZero tracks every renewal for you.
              </p>
              <div className="mx-auto mt-4 max-w-xs">
                <ClickTarget clicking={clicking}>
                  <span
                    ref={connectRef}
                    className="inline-flex h-7 w-full items-center justify-center gap-1 rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground"
                  >
                    <HugeiconsIcon
                      icon={Add01Icon as never}
                      size={14}
                      strokeWidth={2}
                      color="currentColor"
                    />
                    Connect Gmail
                  </span>
                </ClickTarget>
              </div>
            </div>
          )}

          {shown === "connecting" && (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="relative inline-flex h-16 w-16 items-center justify-center">
                <svg
                  viewBox="0 0 64 64"
                  className="absolute inset-0 h-full w-full"
                  aria-hidden="true"
                >
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="transparent"
                    stroke="var(--border)"
                    strokeWidth="4"
                  />
                  <motion.circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="transparent"
                    stroke="var(--primary)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    style={{ rotate: -90, transformOrigin: "center" }}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.3, ease: "easeInOut" }}
                  />
                </svg>
                {connected && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="text-primary"
                  >
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon as never}
                      size={26}
                      strokeWidth={2}
                      color="currentColor"
                    />
                  </motion.span>
                )}
              </span>
              <p className="mt-4 font-mono text-xs text-muted-foreground">
                {connected ? (
                  <span className="font-medium text-primary">Connected</span>
                ) : (
                  <span className="animate-pulse">Connecting…</span>
                )}
              </p>
            </div>
          )}

          {shown === "scanning" && (
            /* The real scan screen, driven with a ticking receipt count. */
            <FirstScanView
              email="you@gmail.com"
              foundCount={settled ? 8 : found}
              scanning
            />
          )}

          {shown === "summary" && (
            /* The real handoff screen a productive first scan lands on. */
            <FirstScanSummary
              total={8}
              needCount={2}
              topSubs={[ADOBE_SUB, SPOTIFY_SUB]}
              moreCount={6}
              onShowMe={() => {}}
            />
          )}
        </StageSwap>

        {clicking && (
          <StageCursor containerRef={containerRef} targetRef={connectRef} />
        )}
      </div>
    </div>
  );
}
