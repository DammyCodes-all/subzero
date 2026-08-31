import type { FC, SVGProps } from "react";

export type IconComponent = FC<SVGProps<SVGSVGElement>>;

export interface NavItem {
  label: string;
  href: string;
  icon: IconComponent;
  exact: boolean;
}

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export interface SidebarTooltipProps {
  label: string;
  disabled: boolean;
  children: React.ReactNode;
}
