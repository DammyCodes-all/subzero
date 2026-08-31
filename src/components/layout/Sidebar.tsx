"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Logout01Icon,
  LayoutRightIcon,
  LayoutLeftIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./navigation";
import { SidebarTooltip } from "./SidebarTooltip";
import type { SidebarProps } from "./types";

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "relative flex h-screen flex-col border-r border-border bg-card",
        collapsed ? "overflow-visible" : "overflow-hidden"
      )}
      style={{ flexShrink: 0 }}
    >
      {/* Logo / Brand */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-border transition-all",
          collapsed ? "justify-center px-0" : "justify-between px-4"
        )}
      >
        {!collapsed && (
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
              <span className="font-heading text-xs font-bold text-primary-foreground leading-none">
                SZ
              </span>
            </div>
            <span className="whitespace-nowrap overflow-hidden font-heading text-sm font-bold tracking-tight text-foreground">
              SubZero
            </span>
          </Link>
        )}

        {/* Collapse toggle */}
        <SidebarTooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} disabled={!collapsed}>
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <HugeiconsIcon
              icon={collapsed ? LayoutRightIcon : LayoutLeftIcon}
              size={18}
              strokeWidth={1.8}
              color="currentColor"
            />
          </button>
        </SidebarTooltip>
      </div>

      {/* Nav items */}
      <nav
        className={cn(
          "flex flex-1 flex-col gap-1.5 p-3 pt-5",
          collapsed ? "overflow-visible" : "overflow-y-auto"
        )}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <SidebarTooltip key={item.href} label={item.label} disabled={!collapsed}>
              <Link
                href={item.href}
                className={cn(
                  "group flex h-[42px] items-center gap-3 rounded-lg px-3.5 text-sm font-medium transition-colors",
                  "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  active && "bg-primary/10 text-primary hover:bg-primary/15",
                  collapsed && "w-full justify-center px-0",
                )}
              >
                <HugeiconsIcon
                  icon={item.icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                  size={18}
                  strokeWidth={active ? 2 : 1.6}
                  color="currentColor"
                  className="flex-shrink-0"
                />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </SidebarTooltip>
          );
        })}
      </nav>

      {/* Bottom — Sign Out */}
      <div className="border-t border-border p-3">
        {isAuthenticated && (
          <SidebarTooltip label="Sign out" disabled={!collapsed}>
            <button
              type="button"
              onClick={() => void signOut()}
              className={cn(
                "flex h-[42px] w-full items-center gap-3 rounded-lg px-3.5 text-sm font-medium",
                "text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
                collapsed && "justify-center px-0",
              )}
            >
              <HugeiconsIcon
                icon={Logout01Icon}
                size={18}
                strokeWidth={1.6}
                color="currentColor"
                className="flex-shrink-0"
              />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="whitespace-nowrap"
                  >
                    Sign out
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </SidebarTooltip>
        )}
      </div>
    </motion.aside>
  );
}
