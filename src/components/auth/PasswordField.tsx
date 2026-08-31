"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import * as React from "react";
import { Input } from "@/components/ui/input";

export function PasswordField({
  value,
  onChange,
  placeholder = "••••••••",
  id,
  autoComplete,
  onKeyDown,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
  autoComplete?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        tabIndex={-1}
      >
        <HugeiconsIcon
          icon={(show ? ViewOffIcon : ViewIcon) as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
          size={16}
          strokeWidth={1.8}
          color="currentColor"
        />
      </button>
    </div>
  );
}
