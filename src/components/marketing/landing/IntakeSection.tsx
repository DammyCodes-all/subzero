"use client";

import { Forward01Icon, MailSearch01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ForwardIntakeMock } from "./intake/ForwardIntakeMock";
import { GmailIntakeMock } from "./intake/GmailIntakeMock";
import { LandingEyebrow } from "./LandingEyebrow";

const TABS = [
  {
    id: "gmail",
    icon: MailSearch01Icon,
    heading: "Connect Gmail",
    body: "SubZero scans receipts and trial emails to find your subscriptions.",
  },
  {
    id: "forward",
    icon: Forward01Icon,
    heading: "Forward an email",
    body: "Forward a receipt or subscription email to your SubZero address.",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function IntakeSection() {
  const [active, setActive] = useState<TabId>("gmail");
  const current = TABS.find((t) => t.id === active) ?? TABS[0];

  return (
    <section id="how-it-works" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <LandingEyebrow>Get started</LandingEyebrow>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance md:text-[2.5rem] md:leading-[1.1]">
            Bring your subscriptions in.
          </h2>
          <p className="mt-5 leading-relaxed text-muted-foreground">
            SubZero finds them by scanning your email, or from a receipt you
            forward.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Ways to add subscriptions"
          className="mt-10 flex flex-wrap items-center justify-center gap-2"
        >
          {TABS.map((tab) => {
            const selected = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-transparent text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                )}
              >
                <HugeiconsIcon
                  icon={tab.icon as never}
                  size={15}
                  color="currentColor"
                />
                {tab.heading}
              </button>
            );
          })}
        </div>

        <div className="mx-auto mt-5 max-w-3xl">
          <p
            key={current.id}
            className="min-h-6 text-center text-sm leading-relaxed text-muted-foreground"
          >
            {current.body}
          </p>

          <div
            role="tabpanel"
            className="mt-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-black/40 md:p-7"
          >
            <div className="min-h-[480px] sm:min-h-[460px]">
              {active === "gmail" && <GmailIntakeMock active />}
              {active === "forward" && <ForwardIntakeMock active />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
