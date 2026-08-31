import {
  DashboardSquare01Icon,
  Invoice02Icon,
  Alert02Icon,
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
    label: "Actions",
    href: "/dashboard/actions",
    icon: Alert02Icon as unknown as NavItem["icon"],
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
