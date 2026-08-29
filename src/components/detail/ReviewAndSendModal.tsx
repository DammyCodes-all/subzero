"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { Loader2, Mail, Send, X } from "lucide-react";
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
            <Mail className="size-4 text-primary" />
            <h3 className="font-heading font-semibold text-base">
              Review cancellation email
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {sent ? (
          <div className="py-6 text-center space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
              <Send className="size-5 text-emerald-500" />
            </div>
            <p className="font-medium">Email sent to {merchant}</p>
            <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
              We'll watch your inbox for the confirmation and update the subscription automatically.
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
              This will be sent via SubZero AgentMail. The merchant's reply will route to your dashboard automatically.
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
                    <Loader2 className="size-3.5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" />
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
