"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiMagicIcon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  Cancel01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { api } from "../../convex/_generated/api";

interface ScanEmailDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ScanEmailDialog({ open, onOpenChange }: ScanEmailDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = (val: boolean) => {
    if (onOpenChange) {
      onOpenChange(val);
    } else {
      setInternalOpen(val);
    }
  };

  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    merchant?: string;
    reason?: string;
  } | null>(null);

  const extract = useAction(api.ai.extractFromText);

  const handleScan = async () => {
    if (!rawText.trim() || loading) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await extract({
        rawText,
        sourceName: "Manual paste scan",
      });
      setResult(res);
      if (res.success) {
        setRawText("");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ success: false, reason: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open === undefined && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="gap-1.5 border-border/80 font-medium hover:border-foreground/30"
        >
          <HugeiconsIcon
            icon={AiMagicIcon}
            size={14}
            color="currentColor"
            className="text-primary"
          />
          Scan email / paste receipt
        </Button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HugeiconsIcon
                  icon={AiMagicIcon}
                  size={18}
                  color="currentColor"
                  className="text-primary"
                />
                <h3 className="font-heading font-semibold text-base">
                  Scan receipt or subscription email
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setResult(null);
                }}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={16}
                  color="currentColor"
                />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Paste an email receipt, trial notification, or billing email below. SubZero&apos;s AI will extract structured fields and retain exact evidence.
            </p>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="e.g. Your trial for Adobe Creative Cloud ends September 3, 2026 and your plan will renew at $54.99/month..."
              rows={6}
              className="w-full rounded-md border border-input bg-background/50 p-3 font-mono text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />

            {result && (
              <div
                className={`flex items-start gap-2 rounded-md p-3 text-xs ${
                  result.success
                    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border border-destructive/20 bg-destructive/10 text-destructive"
                }`}
              >
                {result.success ? (
                  <>
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      size={16}
                      color="currentColor"
                      className="mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="font-medium">
                        Extracted subscription for {result.merchant}!
                      </p>
                      <p className="text-[11px] opacity-80">
                        Saved to your dashboard with verifiable evidence.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <HugeiconsIcon
                      icon={AlertCircleIcon}
                      size={16}
                      color="currentColor"
                      className="mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="font-medium">Extraction failed</p>
                      <p className="text-[11px] opacity-80">
                        {result.reason ?? "Could not detect a subscription in text."}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsOpen(false);
                  setResult(null);
                }}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={handleScan}
                disabled={loading || !rawText.trim()}
                className="gap-1.5"
              >
                {loading ? (
                  <>
                    <HugeiconsIcon
                      icon={Loading03Icon}
                      size={14}
                      color="currentColor"
                      className="animate-spin"
                    />
                    Extracting...
                  </>
                ) : (
                  "Extract subscription"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

