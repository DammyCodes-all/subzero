"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { AlertCircle, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "../../convex/_generated/api";

export function ScanEmailDialog() {
  const [isOpen, setIsOpen] = useState(false);
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
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-1.5 font-medium border-border/80 hover:border-foreground/30"
      >
        <Sparkles className="size-3.5 text-primary" />
        Scan email / paste receipt
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h3 className="font-heading font-semibold text-base">
                  Scan receipt or subscription email
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setResult(null);
                }}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
              >
                <X className="size-4" />
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
              className="w-full rounded-md border border-input bg-background/50 p-3 text-xs font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />

            {result && (
              <div
                className={`p-3 rounded-md text-xs flex items-start gap-2 ${
                  result.success
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}
              >
                {result.success ? (
                  <>
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">
                        Extracted subscription for {result.merchant}!
                      </p>
                      <p className="opacity-80 text-[11px]">
                        Saved to your dashboard with verifiable evidence.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Extraction failed</p>
                      <p className="opacity-80 text-[11px]">
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
                    <Loader2 className="size-3.5 animate-spin" />
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
