"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { cn } from "@/lib/utils";

// Vendored from animate-ui `components-base-tooltip` (spring popup) and its
// `primitives-base-tooltip`, adapted to the installed Base UI v1 `render` API.
// Upstream: https://github.com/imskyleen/animate-ui (MIT)

function TooltipProvider({
  delay = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  );
}

type TooltipProps = React.ComponentProps<typeof TooltipPrimitive.Root> & {
  delay?: number;
};

function Tooltip({ delay = 0, ...props }: TooltipProps) {
  const [isOpen, setIsOpen] = React.useState(props.defaultOpen ?? false);

  return (
    <TooltipOpenContext.Provider value={isOpen}>
      <TooltipProvider delay={delay}>
        <TooltipPrimitive.Root
          data-slot="tooltip"
          {...props}
          onOpenChange={(open, eventDetails) => {
            setIsOpen(open);
            props.onOpenChange?.(open, eventDetails);
          }}
        />
      </TooltipProvider>
    </TooltipOpenContext.Provider>
  );
}

const TooltipOpenContext = React.createContext(false);

function TooltipTrigger(
  props: React.ComponentProps<typeof TooltipPrimitive.Trigger>,
) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

type TooltipPanelProps = {
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  alignOffset?: number;
  children?: React.ReactNode;
};

function TooltipPanel({
  className,
  side = "right",
  align = "center",
  sideOffset = 8,
  alignOffset = 0,
  children,
}: TooltipPanelProps) {
  const isOpen = React.useContext(TooltipOpenContext);

  return (
    <TooltipPrimitive.Portal keepMounted data-slot="tooltip-portal">
      <AnimatePresence>
        {isOpen && (
          <TooltipPrimitive.Positioner
            key="tooltip-panel"
            data-slot="tooltip-positioner"
            className="z-50"
            side={side}
            align={align}
            sideOffset={sideOffset}
            alignOffset={alignOffset}
          >
            <TooltipPrimitive.Popup
              render={
                <motion.div
                  data-slot="tooltip-popup"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className={cn(
                    "w-fit origin-(--transform-origin) rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-balance text-primary-foreground",
                    className,
                  )}
                />
              }
            >
              {children}
              <TooltipPrimitive.Arrow className="z-50 size-2.5 rotate-45 rounded-[2px] bg-primary fill-primary data-[side='bottom']:-top-[4px] data-[side='left']:-right-[4px] data-[side='right']:-left-[4px] data-[side='top']:-bottom-[4px]" />
            </TooltipPrimitive.Popup>
          </TooltipPrimitive.Positioner>
        )}
      </AnimatePresence>
    </TooltipPrimitive.Portal>
  );
}

export {
  Tooltip,
  TooltipPanel,
  type TooltipPanelProps,
  type TooltipProps,
  TooltipTrigger,
};
