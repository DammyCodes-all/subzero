"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SidebarTooltipProps } from "./types";

export function SidebarTooltip({
  label,
  disabled,
  children,
}: SidebarTooltipProps) {
  const [show, setShow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShow(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [show]);

  if (disabled) return <>{children}</>;

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            transition={{ duration: 0.12 }}
            className={cn(
              "pointer-events-none absolute left-full top-1/2 z-50 ml-2.5 -translate-y-1/2",
              "whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1",
              "font-sans text-xs font-medium text-foreground shadow-lg",
            )}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
