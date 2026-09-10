import type { ReactNode } from "react";

export type LegalTocItem = {
  id: string;
  label: string;
};

export type LegalLayoutProps = {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: LegalTocItem[];
  children: ReactNode;
};

export type LegalNavProps = {
  sections: LegalTocItem[];
  activeId: string;
};
