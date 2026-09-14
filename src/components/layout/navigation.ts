import {
  DashboardSquare01Icon,
  Invoice02Icon,
  MailAccount01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import type { NavItem } from "./types";

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: DashboardSquare01Icon as unknown as NavItem["icon"],
    exact: true,
  },
  {
    label: "Subscriptions",
    href: "/dashboard/subscriptions",
    icon: Invoice02Icon as unknown as NavItem["icon"],
    exact: false,
  },
  {
    label: "Connections",
    href: "/dashboard/connections",
    icon: MailAccount01Icon as unknown as NavItem["icon"],
    exact: false,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings01Icon as unknown as NavItem["icon"],
    exact: false,
  },
];

// next.config.ts sets trailingSlash: true, so usePathname() returns
// "/dashboard/" — normalize before comparing or exact items never match.
export function normalizePath(path: string | null | undefined): string {
  if (!path || path === "/") return path ?? "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function isNavActive(
  pathname: string | null | undefined,
  item: NavItem,
): boolean {
  const path = normalizePath(pathname);
  if (item.exact) return path === item.href;
  if (path === item.href || path.startsWith(`${item.href}/`)) return true;
  return (
    item.aliases?.some((a) => path === a || path.startsWith(`${a}/`)) ?? false
  );
}
