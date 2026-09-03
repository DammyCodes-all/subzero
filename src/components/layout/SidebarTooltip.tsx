"use client";

import type * as React from "react";
import {
  Tooltip,
  TooltipPanel,
  TooltipTrigger,
} from "@/components/animate-ui/base-tooltip";
import type { SidebarTooltipProps } from "./types";

export function SidebarTooltip({
  label,
  disabled,
  children,
}: SidebarTooltipProps) {
  if (disabled) return <>{children}</>;

  return (
    <Tooltip delay={0}>
      <TooltipTrigger render={children as React.ReactElement} />
      <TooltipPanel side="right" align="center" sideOffset={10}>
        {label}
      </TooltipPanel>
    </Tooltip>
  );
}
