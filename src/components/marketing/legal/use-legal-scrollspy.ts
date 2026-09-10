"use client";

import { useEffect, useState } from "react";
import { LEGAL_SCROLLSPY_ROOT_MARGIN } from "./legal-constants";
import type { LegalTocItem } from "./legal-types";

export function useLegalScrollSpy(sections: LegalTocItem[]): string {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: LEGAL_SCROLLSPY_ROOT_MARGIN, threshold: 0 },
    );

    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  return activeId;
}
