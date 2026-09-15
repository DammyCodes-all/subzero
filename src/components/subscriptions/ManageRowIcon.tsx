"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import type { ComponentProps } from "react";

type Icon = ComponentProps<typeof HugeiconsIcon>["icon"];

export function ManageRowIcon({ icon }: { icon: Icon }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <HugeiconsIcon
        icon={icon}
        size={18}
        strokeWidth={1.8}
        color="currentColor"
      />
    </div>
  );
}
