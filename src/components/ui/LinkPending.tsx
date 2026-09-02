"use client";

import { useLinkStatus } from "next/link";
import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon } from "@hugeicons/core-free-icons";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

function useDelayedPending(delay = 120) {
  const { pending } = useLinkStatus();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (pending) {
      const t = setTimeout(() => setShow(true), delay);
      return () => clearTimeout(t);
    }
    setShow(false);
  }, [pending, delay]);
  return show;
}

export function LinkPendingDot({ className }: { className?: string }) {
  const show = useDelayedPending(120);
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
          aria-hidden
          className={cn("inline-flex shrink-0 items-center", className)}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-primary">
            <HugeiconsIcon
              icon={Loading03Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
              size={10}
              strokeWidth={2.4}
              color="currentColor"
              className="animate-spin"
            />
          </span>
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export function PendingWrap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const show = useDelayedPending(80);
  return (
    <span
      className={cn(
        "transition-opacity duration-200 ease-out",
        show ? "opacity-45" : "opacity-100",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LinkPendingOverlay({
  variant = "card",
}: {
  variant?: "card" | "row";
}) {
  const show = useDelayedPending(100);
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] border bg-card/40 backdrop-blur-[1px]",
            variant === "card"
              ? "border-primary/15 shadow-[0_0_0_1px_var(--primary)/0.08]"
              : "border-primary/10",
          )}
        >
          {/* top hairline shimmer */}
          <span className="absolute left-2 right-2 top-0 h-px overflow-hidden rounded-full">
            <motion.span
              aria-hidden
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ repeat: Infinity, duration: 1.05, ease: "linear" }}
              className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-transparent via-primary/55 to-transparent"
            />
          </span>

          {/* trailing / centered spinner */}
          <span
            className={cn(
              "absolute flex items-center justify-center",
              variant === "card"
                ? "right-3 top-3 h-6 w-6 rounded-full bg-card border border-border shadow-sm"
                : "right-3 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-card border border-border shadow-sm",
            )}
          >
            <HugeiconsIcon
              icon={Loading03Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
              size={variant === "card" ? 12 : 10}
              strokeWidth={2.4}
              color="currentColor"
              className="animate-spin text-primary"
            />
          </span>
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export function SidebarPending({ collapsed }: { collapsed: boolean }) {
  const show = useDelayedPending(110);
  if (!show) return null;
  if (collapsed) {
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.6 }}
        aria-hidden
        className="pointer-events-none absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-card border border-border shadow"
      >
        <HugeiconsIcon
          icon={Loading03Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
          size={10}
          strokeWidth={2.4}
          color="currentColor"
          className="animate-spin text-primary"
        />
      </motion.span>
    );
  }
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.15 }}
      aria-hidden
      className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary"
    >
      <HugeiconsIcon
        icon={Loading03Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
        size={12}
        strokeWidth={2.2}
        color="currentColor"
        className="animate-spin"
      />
    </motion.span>
  );
}
