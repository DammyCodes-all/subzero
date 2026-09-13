"use client";

import {
  ArrowLeftRightIcon,
  CustomerSupportIcon,
  GlobeIcon,
  MailSend01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { LandingEyebrow } from "./LandingEyebrow";

const ROUTES = [
  {
    icon: GlobeIcon,
    chip: "Merchant site",
    heading: "Cancel on the merchant site",
    body: "The subscription can be cancelled through the merchant.",
    evidence: "\u201CClick Cancel plan to end your subscription\u201D — adobe.com",
  },
  {
    icon: ArrowLeftRightIcon,
    chip: "Provider",
    heading: "Billed through a provider",
    body: "The subscription is managed through Google Play.",
    evidence: "\u201CManaged in Google Play subscriptions\u201D — play.google.com",
  },
  {
    icon: MailSend01Icon,
    chip: "Email",
    heading: "Cancellation by email",
    body: "The merchant accepts cancellation by email.",
    evidence: "\u201CEmail cancel@merchant.com to cancel\u201D — merchant reply",
  },
  {
    icon: CustomerSupportIcon,
    chip: "Support",
    heading: "Support required",
    body: "Cancellation requires contacting support.",
    evidence: "\u201CContact support to cancel\u201D — help center",
  },
];

export function CancelPathsSection() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <LandingEyebrow>Cancellation actions</LandingEyebrow>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance md:text-[2.5rem] md:leading-[1.1]">
            The right path depends on the subscription.
          </h2>
          <p className="mt-5 leading-relaxed text-muted-foreground">
            SubZero identifies the cancellation route and gives you the
            appropriate action.
          </p>
        </div>

        <ol aria-hidden="true" className="mx-auto mt-12 max-w-3xl">
          {ROUTES.map((route, i) => {
            const stepDelay = i * 0.12;
            const connectorDelay = stepDelay + 0.1;
            return (
              <motion.li
                key={route.heading}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.5,
                  delay: stepDelay,
                  ease: "easeOut",
                }}
                className="relative flex gap-4 pb-5 last:pb-0"
              >
                {i < ROUTES.length - 1 && (
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
                    className="absolute top-12 left-[19px] h-[calc(100%-2.5rem)] w-px bg-border"
                  />
                )}
                <span className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary">
                  <HugeiconsIcon
                    icon={route.icon as never}
                    size={18}
                    color="currentColor"
                  />
                </span>
                <div className="flex-1 rounded-2xl border border-border bg-card p-5 md:p-6">
                  <p className="font-mono text-[11px] tracking-widest text-primary uppercase">
                    {route.chip}
                  </p>
                  <h3 className="mt-2 text-lg font-bold tracking-tight">
                    {route.heading}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {route.body}
                  </p>
                  <p className="mt-3 border-l-2 border-border pl-3 font-mono text-xs leading-relaxed text-muted-foreground">
                    {route.evidence}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
