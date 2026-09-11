"use client";

import {
  Cancel01Icon,
  ChevronDownIcon,
  Forward01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ActionCard } from "@/components/ActionCard";
import { BlackHoleScan } from "@/components/BlackHoleScan";
import { ADOBE_SUB } from "./fixtures";
import { CLICK_MS, ClickTarget, StageCursor, StageSwap } from "./StageCursor";

/**
 * Mirrors the real dashboard forward sequence:
 * ForwardingCard (copy the address) → Gmail compose (send it) →
 * BlackHoleScan detection → the new ActionCard in the list.
 */
type Stage = "email" | "compose" | "scanning" | "result";

const ORDER: Stage[] = ["email", "compose", "scanning", "result"];

const HOLDS: Record<Stage, number> = {
  email: CLICK_MS + 200,
  compose: CLICK_MS + 200,
  scanning: 1500,
  result: 2500,
};

function sleep(ms: number, timers: number[]) {
  return new Promise<void>((resolve) => {
    const t = window.setTimeout(resolve, ms);
    timers.push(t);
  });
}

function EmailCard() {
  return (
    <div className="rounded-xl border border-border/70 bg-background/60 p-4 text-left">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-base font-bold">
          A
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Adobe</p>
          <p className="truncate text-sm text-muted-foreground">
            Your trial ends soon
          </p>
        </div>
      </div>
    </div>
  );
}

export function ForwardIntakeMock({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const inViewRef = useRef<HTMLDivElement>(null);
  const inView = useInView(inViewRef, { margin: "-64px" });
  const forwardRef = useRef<HTMLSpanElement>(null);
  const sendRef = useRef<HTMLSpanElement>(null);
  const [stage, setStage] = useState<Stage>("email");
  const [running, setRunning] = useState(false);

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

  const settled = reduceMotion || !active;
  const clicking =
    running && !settled && (stage === "email" || stage === "compose");
  const shown: Stage = settled ? "result" : stage;

  return (
    <div ref={inViewRef}>
      <div
        ref={containerRef}
        aria-hidden="true"
        inert
        className="relative mx-auto w-full max-w-xl"
      >
        <StageSwap stageKey={shown}>
          {shown === "email" && (
            <div>
              <EmailCard />
              <div className="mt-3 flex justify-end">
                <ClickTarget clicking={running && stage === "email"}>
                  <span
                    ref={forwardRef}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3.5 py-2 text-sm font-semibold text-foreground"
                  >
                    <HugeiconsIcon
                      icon={Forward01Icon as never}
                      size={15}
                      color="currentColor"
                      className="text-primary"
                    />
                    Forward
                  </span>
                </ClickTarget>
              </div>
            </div>
          )}

          {shown === "compose" && (
            /* Mocked Gmail compose popup: recipient chip, forwarded
             * metadata, quoted original, Send toolbar. */
            <div className="mx-auto max-w-sm rounded-xl border border-border/70 bg-background/60 p-4 text-left shadow-xl">
              <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                <HugeiconsIcon
                  icon={Forward01Icon as never}
                  size={14}
                  color="currentColor"
                  className="shrink-0 text-muted-foreground"
                />
                <HugeiconsIcon
                  icon={ChevronDownIcon as never}
                  size={13}
                  color="currentColor"
                  className="shrink-0 text-muted-foreground"
                />
                <span className="text-xs text-muted-foreground">To</span>
                <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-primary/10 py-0.5 pr-2 pl-0.5 font-mono text-[11px] text-primary">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    S
                  </span>
                  <span className="truncate">subzero-agent@agentmail.to</span>
                  <HugeiconsIcon
                    icon={Cancel01Icon as never}
                    size={12}
                    color="currentColor"
                    className="shrink-0 opacity-70"
                  />
                </span>
              </div>
              <div className="mt-3 space-y-0.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                <p>---------- Forwarded message ---------</p>
                <p>
                  <span className="font-semibold text-foreground">From:</span>{" "}
                  Adobe &lt;no-reply@adobe.com&gt;
                </p>
                <p>
                  <span className="font-semibold text-foreground">Date:</span>{" "}
                  Thu, Sep 10, 2026, 9:41 AM
                </p>
                <p>
                  <span className="font-semibold text-foreground">
                    Subject:
                  </span>{" "}
                  Your trial ends soon
                </p>
                <p>
                  <span className="font-semibold text-foreground">To:</span>{" "}
                  you@gmail.com
                </p>
              </div>
              <div className="mt-3">
                <EmailCard />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="h-5 w-5 rounded bg-muted-foreground/20"
                    />
                  ))}
                </div>
                <ClickTarget clicking={running && stage === "compose"}>
                  <span
                    ref={sendRef}
                    className="inline-flex items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
                  >
                    <span className="px-4 py-2">Send</span>
                    <span className="border-l border-primary-foreground/30 px-2 py-2">
                      <HugeiconsIcon
                        icon={ChevronDownIcon as never}
                        size={10}
                        color="currentColor"
                      />
                    </span>
                  </span>
                </ClickTarget>
              </div>
            </div>
          )}

          {shown === "scanning" && (
            /* Same detection visual as the Gmail flow — reused, not rebuilt. */
            <div className="flex justify-center py-2">
              <BlackHoleScan
                size={120}
                isScanning
                label="Detecting forwarded email…"
              />
            </div>
          )}

          {shown === "result" && <ActionCard sub={ADOBE_SUB} />}
        </StageSwap>

        {clicking && (
          <StageCursor
            containerRef={containerRef}
            targetRef={stage === "email" ? forwardRef : sendRef}
          />
        )}
      </div>
    </div>
  );
}
