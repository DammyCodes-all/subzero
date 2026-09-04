import type { FC, SVGProps } from "react";

export type IconComponent = FC<SVGProps<SVGSVGElement>>;

export interface NavItem {
  label: string;
  href: string;
  icon: IconComponent;
  exact: boolean;
  // Extra path prefixes that count as active (e.g. detail routes living
  // outside the nav href's own tree).
  aliases?: string[];
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
