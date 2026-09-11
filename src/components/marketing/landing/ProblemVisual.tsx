"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreVerticalIcon,
  RotateClockwiseIcon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MAIL = [
  {
    sender: "Design Weekly",
    subject: "5 layouts designers are using",
    preview: "This week's issue is out now",
    time: "9:12 PM",
    unread: false,
  },
  {
    sender: "Trial Reminder",
    subject: "Your trial ends soon",
    preview: "Your trial ends in 3 days",
    time: "9:04 PM",
    unread: true,
  },
  {
    sender: "Aisha Bello",
    subject: "Standup notes",
    preview: "Shipped the onboarding flow",
    time: "8:40 AM",
    unread: false,
  },
  {
    sender: "Renewal Alert",
    subject: "Your subscription renews tomorrow",
    preview: "A charge is scheduled for tomorrow",
    time: "8:15 AM",
    unread: true,
  },
  {
    sender: "Billing",
    subject: "Your receipt",
    preview: "Your payment went through",
    time: "Sep 8",
    unread: true,
  },
  {
    sender: "Green Airlines",
    subject: "Check-in is open",
    preview: "Your flight boards at 6:40 AM",
    time: "Sep 8",
    unread: false,
  },
  {
    sender: "Payment",
    subject: "Payment successful",
    preview: "Here is the confirmation of your payment",
    time: "Sep 5",
    unread: true,
  },
];

const TABS = [
  { label: "Primary", active: true, badge: null as string | null },
  { label: "Promotions", active: false, badge: "14 new" },
  { label: "Social", active: false, badge: "6 new" },
  { label: "Updates", active: false, badge: "9 new" },
];

const STAGGER_MS = 280;
const HOLD_MS = 6000;
const EXIT_MS = 450;
const RESTART_MS = 400;
const FLASH = "rgba(230,255,43,0.10)";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function RowContent({ row }: { row: (typeof MAIL)[number] }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="h-4 w-4 shrink-0 rounded-[4px] border border-muted-foreground/50"
      />
      <span className="hidden shrink-0 text-muted-foreground/70 sm:inline-flex">
        <HugeiconsIcon
          icon={StarIcon as never}
          size={16}
          color="currentColor"
        />
      </span>
      <span
        className={cn(
          "w-20 shrink-0 truncate text-sm sm:w-28",
          row.unread ? "font-bold" : "font-medium text-foreground/70",
        )}
      >
        {row.sender}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className={row.unread ? "font-bold" : "text-foreground/70"}>
          {row.subject}
        </span>
        <span className="text-muted-foreground">
          {" "}
          {"–"} {row.preview}
        </span>
      </span>
      {row.unread && (
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full bg-primary"
        />
      )}
      <span className="shrink-0 text-xs text-muted-foreground">{row.time}</span>
    </>
  );
}

function InboxRow({
  row,
  leaving,
}: {
  row: (typeof MAIL)[number];
  leaving: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={leaving ? { opacity: 0 } : { opacity: 1, y: 0 }}
      transition={{
        opacity: { duration: 0.38, ease: "easeOut" },
        y: { duration: 0.38, ease: "easeOut" },
      }}
      className={cn(
        "flex items-center gap-2 border-b border-border/60 px-3 py-3 transition-colors duration-700 last:border-b-0 sm:gap-3 sm:px-4",
        row.unread && !leaving && "bg-primary/[0.06]",
      )}
    >
      <RowContent row={row} />
    </motion.div>
  );
}

export function ProblemVisual() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-64px" });
  const [visible, setVisible] = useState(0);
  const [leaving, setLeaving] = useState(false);


  useEffect(() => {
    if (!inView || reduceMotion) return;
    let cancelled = false;
    async function loop() {
      await sleep(200);
      while (!cancelled) {
        for (let i = 1; i <= MAIL.length; i++) {
          if (cancelled) return;
          setVisible(i);
          await sleep(STAGGER_MS);
        }
        await sleep(HOLD_MS);
        if (cancelled) return;
        setLeaving(true);
        await sleep(EXIT_MS);
        if (cancelled) return;
        setLeaving(false);
        setVisible(0);
        await sleep(RESTART_MS);
      }
    }
    loop();
    return () => {
      cancelled = true;
    };
  }, [inView, reduceMotion]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/40"
    >
      <div className="flex items-center gap-1 border-b border-border/60 px-3 py-2 text-muted-foreground">
        <span className="h-4 w-4 shrink-0 rounded-[4px] border border-muted-foreground/50" />
        <span className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full">
          <HugeiconsIcon
            icon={RotateClockwiseIcon as never}
            size={16}
            color="currentColor"
          />
        </span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full">
          <HugeiconsIcon
            icon={MoreVerticalIcon as never}
            size={16}
            color="currentColor"
          />
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs">
          1–50 of 96
          <span className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full">
            <HugeiconsIcon
              icon={ChevronLeftIcon as never}
              size={16}
              color="currentColor"
            />
          </span>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full">
            <HugeiconsIcon
              icon={ChevronRightIcon as never}
              size={16}
              color="currentColor"
            />
          </span>
        </span>
      </div>

      <div className="flex items-center gap-5 overflow-x-auto border-b border-border/60 px-4 text-sm">
        {TABS.map((tab) => (
          <span
            key={tab.label}
            className={cn(
              "flex shrink-0 items-center gap-2 py-3",
              tab.active
                ? "border-b-2 border-foreground font-semibold text-foreground"
                : "text-muted-foreground",
            )}
          >
            {tab.label}
            {tab.badge && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">
                {tab.badge}
              </span>
            )}
          </span>
        ))}
      </div>

      <div className="min-h-[314px]">
        {reduceMotion
          ? MAIL.map((row) => (
              <div
                key={row.sender}
                className="flex items-center gap-2 border-b border-border/60 px-3 py-3 last:border-b-0 sm:gap-3 sm:px-4"
              >
                <RowContent row={row} />
              </div>
            ))
          : MAIL.slice(0, visible).map((row) => (
              <InboxRow key={row.sender} row={row} leaving={leaving} />
            ))}
      </div>
    </div>
  );
}
