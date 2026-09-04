"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Logout01Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import {
  Popover,
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
} from "@/components/animate-ui/primitives/base/popover";
import { api } from "../../convex/_generated/api";

function initialOf(name?: string | null, email?: string | null) {
  return (name?.charAt(0) ?? email?.charAt(0) ?? "?").toUpperCase();
}

export function UserMenu() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.users.getViewer);
  const connections = useQuery(api.connections.getMyConnections);
  const [imgFailed, setImgFailed] = useState(false);

  if (isLoading) {
    return (
      <span
        aria-hidden="true"
        className="size-8 animate-pulse rounded-full bg-border/60"
      />
    );
  }
  if (!isAuthenticated) return null;

  const image = viewer?.image ?? null;
  const showImage = !!image && !imgFailed;
  const name = viewer?.name ?? null;
  const email = viewer?.email ?? null;
  const initial = initialOf(name, email);

  const gmail = connections?.find(
    (c) => c.provider === "google" && c.status === "connected",
  );
  const gmailEmail = gmail?.accountEmail ?? null;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={name ?? email ?? "Account"}
        className="flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-xs font-semibold text-foreground transition-colors outline-none hover:border-foreground/30 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 data-[popup-open]:border-foreground/30"
      >
        {showImage ? (
          <img
            src={image as string}
            alt=""
            width={32}
            height={32}
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden="true">{initial}</span>
        )}
      </PopoverTrigger>

      <PopoverPortal>
        <PopoverPositioner align="end" sideOffset={8} className="z-50">
          <PopoverPopup className="z-50 w-64 origin-top-right rounded-xl border border-border bg-card p-1.5 shadow-xl outline-none">
            <div className="flex items-center gap-2.5 px-2 py-2">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold text-foreground"
              >
                {showImage ? (
                  <img
                    src={image as string}
                    alt=""
                    width={36}
                    height={36}
                    onError={() => setImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initial
                )}
              </span>
              <span className="min-w-0">
                {name && (
                  <span className="block truncate text-sm font-medium text-foreground">
                    {name}
                  </span>
                )}
                {email && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {email}
                  </span>
                )}
              </span>
            </div>

            <div aria-hidden="true" className="my-1 h-px bg-border/60" />

            <div className="flex items-center gap-2 px-2 py-1.5">
              <span
                aria-hidden="true"
                className={
                  gmail
                    ? "size-1.5 rounded-full bg-emerald-500"
                    : "size-1.5 rounded-full bg-muted-foreground/50"
                }
              />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {gmailEmail ?? "Gmail not connected"}
              </span>
              <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                {gmail ? "Connected" : "Off"}
              </span>
            </div>

            <div aria-hidden="true" className="my-1 h-px bg-border/60" />

            <Link
              href="/dashboard/settings"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary"
            >
              <HugeiconsIcon
                icon={
                  Settings01Icon as unknown as Parameters<
                    typeof HugeiconsIcon
                  >[0]["icon"]
                }
                size={16}
                strokeWidth={1.8}
                color="currentColor"
                className="text-muted-foreground"
              />
              Settings
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
            >
              <HugeiconsIcon
                icon={
                  Logout01Icon as unknown as Parameters<
                    typeof HugeiconsIcon
                  >[0]["icon"]
                }
                size={16}
                strokeWidth={1.8}
                color="currentColor"
                className="text-muted-foreground"
              />
              Sign out
            </button>
          </PopoverPopup>
        </PopoverPositioner>
      </PopoverPortal>
    </Popover>
  );
}
