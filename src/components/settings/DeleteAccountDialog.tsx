"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";

type DeleteAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  confirming: boolean;
  error: string | null;
};

export function DeleteAccountDialog({
  open,
  onOpenChange,
  onConfirm,
  confirming,
  error,
}: DeleteAccountDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <AlertDialog.Portal keepMounted>
            <AlertDialog.Backdrop
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              render={
                <motion.div
                  key="delete-account-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              }
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <AlertDialog.Popup
                className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl outline-none"
                render={
                  <motion.div
                    key="delete-account-panel"
                    initial={{ opacity: 0, scale: 0.92, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 8 }}
                    transition={{ type: "spring", stiffness: 320, damping: 26 }}
                  />
                }
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                    <HugeiconsIcon
                      icon={
                        Delete02Icon as unknown as Parameters<
                          typeof HugeiconsIcon
                        >[0]["icon"]
                      }
                      size={20}
                      strokeWidth={1.8}
                      color="currentColor"
                    />
                  </div>
                  <div>
                    <AlertDialog.Title className="font-heading text-base font-semibold text-foreground">
                      Delete your account?
                    </AlertDialog.Title>
                    <AlertDialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      This removes all of your data plus your login. You will be
                      signed out and need to sign up again to come back. This
                      cannot be undone.
                    </AlertDialog.Description>
                  </div>
                </div>
                {error && (
                  <p className="mt-4 text-xs text-destructive">{error}</p>
                )}
                <div className="mt-6 flex items-center justify-end gap-3">
                  <AlertDialog.Close
                    className="h-9 rounded-lg border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary/60 disabled:opacity-50"
                    disabled={confirming}
                  >
                    Keep my account
                  </AlertDialog.Close>
                  <Button
                    variant="destructive"
                    onClick={onConfirm}
                    disabled={confirming}
                    className="h-9 px-4 text-sm font-semibold"
                  >
                    {confirming ? "Deleting..." : "Yes, delete my account"}
                  </Button>
                </div>
              </AlertDialog.Popup>
            </div>
          </AlertDialog.Portal>
        )}
      </AnimatePresence>
    </AlertDialog.Root>
  );
}
