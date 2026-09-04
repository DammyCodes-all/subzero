"use client";

import { LayoutLeftIcon, LayoutRightIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Highlight, HighlightItem } from "@/components/animate-ui/highlight";
import {
  SubzeroMark,
  SubzeroWithWordmark,
} from "@/components/brand/SubzeroLogo";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./navigation";
import { SidebarTooltip } from "./SidebarTooltip";
import type { NavItem, SidebarProps } from "./types";

// Inset the hover glow to a centered box in rail mode so the resting look
// stays a clean icon column like the reference.
const RAIL_GLOW_INSET = { top: -4, left: 12, width: -24, height: 8 };

// Expanded mode: inset the glow from the panel edges so the hover/active
// pill floats with air instead of bleeding to the hairline and left edge.
const EXPANDED_GLOW_INSET = { left: 12, width: -24 };

function ActiveEdge() {
  return (
    <motion.span
      layoutId="sidebar-active-edge"
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="absolute top-1/2 right-0 h-6 w-[2px] -translate-y-1/2 rounded-full bg-primary"
      aria-hidden="true"
    />
  );
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    // w-full: keeps the row full-bleed in the centered rail so the accent
    // edge lands exactly on the neutral hairline at the rail edge.
    <HighlightItem activeClassName="rounded-lg bg-secondary" className="w-full">
      <SidebarTooltip label={item.label} disabled={!collapsed}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          aria-label={collapsed ? item.label : undefined}
          className={cn(
            "relative flex w-full items-center transition-colors",
            collapsed ? "justify-center py-2" : "h-11 gap-3 px-5",
            active
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <HugeiconsIcon
            icon={
              item.icon as unknown as Parameters<
                typeof HugeiconsIcon
              >[0]["icon"]
            }
            size={20}
            strokeWidth={active ? 2 : 1.6}
            color="currentColor"
            className="flex-shrink-0"
          />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="overflow-hidden text-sm font-medium whitespace-nowrap"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
          {active && <ActiveEdge />}
        </Link>
      </SidebarTooltip>
    </HighlightItem>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    if (pathname.startsWith(item.href)) return true;
    return item.aliases?.some((a) => pathname.startsWith(a)) ?? false;
  };

  return (
    <aside
      style={{ width: collapsed ? 68 : 232, flexShrink: 0 }}
      // Width animation from animate-ui radix-sidebar (not the component):
      // 400ms with a slight overshoot settle on collapse/expand.
      className={cn(
        "relative flex h-screen flex-col py-4 transition-[width] duration-400 ease-[cubic-bezier(0.7,-0.15,0.25,1.15)]",
      )}
    >
      {/* Floating rail, vertically centered with air top and bottom */}
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-r-2xl bg-transparent">
        {/* Neutral hairline the icon column lines up against — starts below
            the logo and fades out toward the top and bottom of the rail */}
        <div
          aria-hidden="true"
          className="absolute top-20 right-0 bottom-0 w-px bg-[linear-gradient(to_bottom,transparent_0%,var(--border)_15%,var(--border)_85%,transparent_100%)]"
        />

        {/* Logo — collapsed: hover swaps to the expand affordance.
            Expanded: wordmark links home, collapse button shows inline. */}
        <div
          className={cn(
            "flex items-center pt-5 pb-2",
            collapsed ? "justify-center px-0" : "justify-start px-5",
          )}
        >
          {collapsed ? (
            <SidebarTooltip label="Expand sidebar" disabled={false}>
              <button
                type="button"
                onClick={onToggle}
                aria-label="Expand sidebar"
                className="group relative flex h-10 items-center justify-center rounded-md transition-colors"
              >
                <span className="flex items-center transition-opacity duration-100 group-hover:opacity-0">
                  <SubzeroMark size={28} className="h-[28px] w-[28px]" />
                </span>
                <span className="absolute inset-0 flex items-center justify-center text-muted-foreground opacity-0 transition-opacity duration-100 group-hover:opacity-100">
                  <HugeiconsIcon
                    icon={LayoutRightIcon}
                    size={20}
                    strokeWidth={1.8}
                    color="currentColor"
                  />
                </span>
              </button>
            </SidebarTooltip>
          ) : (
            <div className="flex h-10 w-full items-center justify-between">
              <Link
                href="/dashboard"
                aria-label="SubZero dashboard"
                className="flex items-center"
              >
                <SubzeroWithWordmark
                  className="h-7 w-auto max-w-[144px]"
                  width={144}
                  height={32}
                />
              </Link>
              <button
                type="button"
                onClick={onToggle}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              >
                <HugeiconsIcon
                  icon={LayoutLeftIcon}
                  size={18}
                  strokeWidth={1.8}
                  color="currentColor"
                />
              </button>
            </div>
          )}
        </div>

        {/* Single vertically-centered icon group, like the reference */}
        <Highlight
          mode="parent"
          hover
          controlledItems
          forceUpdateBounds
          boundsOffset={collapsed ? RAIL_GLOW_INSET : EXPANDED_GLOW_INSET}
          containerClassName={cn(
            "flex flex-1 flex-col",
            collapsed
              ? "items-center justify-center gap-6 overflow-visible"
              : "gap-1.5 overflow-y-auto pt-6 pb-6",
          )}
        >
          <nav aria-label="Primary" className="contents">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                collapsed={collapsed}
                active={isActive(item)}
              />
            ))}
          </nav>
        </Highlight>
      </div>
    </aside>
  );
}
