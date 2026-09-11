"use client";

import { BellRingIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { LandingEyebrow } from "./LandingEyebrow";

const TIMELINE = [
  { when: "7 days", detail: "Renewal coming up", done: true },
  { when: "3 days", detail: "Renews in 3 days", done: true },
  { when: "24 hours", detail: "Renews tomorrow", done: true },
  { when: "After", detail: "Cancelled", done: false },
];

export function RenewalSection() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <LandingEyebrow>Renewal alerts</LandingEyebrow>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance md:text-[2.5rem] md:leading-[1.1]">
              A renewal shouldn&apos;t catch you off guard.
            </h2>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              SubZero watches upcoming renewal dates and sends a reminder when
              one needs your attention.
            </p>
          </motion.div>

          <div aria-hidden="true">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              className="rounded-2xl border border-border bg-card p-5 shadow-xl shadow-black/30 md:p-6"
            >
              <div className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-lg font-bold">
                  A
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">
                    Adobe Creative Cloud
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    <span className="font-numeric">$54.99/mo</span>
                    {" · Renews Sep 3"}
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <HugeiconsIcon
                    icon={BellRingIcon as never}
                    size={18}
                    color="currentColor"
                  />
                </span>
              </div>
            </motion.div>

            <ol className="mt-6 space-y-0">
              {TIMELINE.map((step, i) => {
                // Staggered entrance: card lands first, then each step slides
                // up in order. The connector draws down at the same time as
                // the next step so they meet mid-animation.
                const stepDelay = 0.3 + i * 0.28;
                const connectorDelay = 0.3 + (i + 1) * 0.28 - 0.18;
                return (
                  <motion.li
                    key={step.when}
                    initial={{ opacity: 0, y: 32 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{
                      duration: 0.5,
                      delay: stepDelay,
                      ease: "easeOut",
                    }}
                    className="relative flex gap-4 pb-6 last:pb-0"
                  >
                    {i < TIMELINE.length - 1 && (
                      <motion.span
                        aria-hidden="true"
                        initial={{ scaleY: 0 }}
                        whileInView={{ scaleY: 1 }}
                        viewport={{ once: true, margin: "-40px" }}
                        transition={{
                          duration: 0.45,
                          delay: connectorDelay,
                          ease: "easeInOut",
                        }}
                        style={{ transformOrigin: "top" }}
                        className="absolute top-9 left-[17px] h-[calc(100%-2rem)] w-px bg-border"
                      />
                    )}
                  <span
                    className={cn(
                      "z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                      step.done
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="pt-1">
                    <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                      {step.when}
                    </p>
                    <p className="mt-1 text-[15px] font-semibold">
                      {step.detail}
                    </p>
                  </div>
                  </motion.li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
