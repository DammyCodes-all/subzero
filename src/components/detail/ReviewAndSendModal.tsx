"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mail01Icon,
  SentIcon,
  Cancel01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function ReviewAndSendModal({
  subscriptionId,
  merchant,
  onClose,
}: {
  subscriptionId: Id<"subscriptions">;
  merchant: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftBody = `Hello ${merchant} Support,

I am writing to request the immediate cancellation of my subscription.
Please process this cancellation and confirm once my account will no longer be charged.

Thank you.`;

  const sendEmail = useAction(api.agentmail.sendCancellationEmail);

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    try {
      await sendEmail({
        subscriptionId,
        merchant,
        body: draftBody,
      });
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={Mail01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
              size={18}
              strokeWidth={1.8}
              color="currentColor"
              className="text-primary"
            />
            <h3 className="font-heading font-semibold text-base">
              Review cancellation email
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <HugeiconsIcon
              icon={Cancel01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
              size={16}
              color="currentColor"
            />
          </button>
        </div>

        {sent ? (
          <div className="space-y-3 py-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
              <HugeiconsIcon
                icon={SentIcon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                size={20}
                strokeWidth={1.8}
                color="currentColor"
                className="text-emerald-500"
              />
            </div>
            <p className="font-medium">Email sent to {merchant}</p>
            <p className="mx-auto max-w-[280px] text-sm text-muted-foreground">
              We&apos;ll watch your inbox for the confirmation and update the subscription automatically.
            </p>
            <div className="pt-4">
              <Button onClick={onClose} size="sm">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              This will be sent via SubZero AgentMail. The merchant&apos;s reply will route to your dashboard automatically.
            </p>

            <div className="rounded-md border border-input bg-background/50 p-4 font-mono text-xs whitespace-pre-wrap">
              {draftBody}
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSend()}
                disabled={loading}
                className="gap-1.5"
              >
                {loading ? (
                  <>
                    <HugeiconsIcon
                      icon={Loading03Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                      size={14}
                      color="currentColor"
                      className="animate-spin"
                    />
                    Sending...
                  </>
                ) : (
                  <>
                    <HugeiconsIcon
                      icon={SentIcon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                      size={14}
                      strokeWidth={1.8}
                      color="currentColor"
                    />
                    Send cancellation
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
