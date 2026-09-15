"use client";

import { Cancel01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useAction, useMutation } from "convex/react";
import { useState } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { api } from "../../../convex/_generated/api";

type Preview = {
  merchant?: string;
  product?: string;
  price?: number;
  currency?: string;
  billingInterval: "monthly" | "yearly" | "weekly" | "unknown";
  nextRenewalAt?: number;
  trialEndsAt?: number;
  billingProvider?: string;
  isConfirmation: boolean;
  confidence: number;
  quote: string;
};

function toDateInput(ms?: number) {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromDateInput(v: string): number | undefined {
  if (!v) return undefined;
  const ms = Date.parse(`${v}T12:00:00`);
  return Number.isNaN(ms) ? undefined : ms;
}

export function ManualAddDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const previewPaste = useAction(api.manual.previewPaste);
  const upsert = useMutation(api.subscriptions.upsert);
  const addEvidence = useMutation(api.evidence.add);

  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [merchant, setMerchant] = useState("");
  const [product, setProduct] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [interval, setInterval] =
    useState<Preview["billingInterval"]>("monthly");
  const [renewal, setRenewal] = useState("");
  const [trial, setTrial] = useState("");
  const [busy, setBusy] = useState<null | "extract" | "save">(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const inputCls =
    "h-8 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  async function handleExtract() {
    setBusy("extract");
    setError(null);
    try {
      const r = (await previewPaste({
        text,
        subject: subject.trim() || undefined,
      })) as Preview;
      setPreview(r);
      setMerchant(r.merchant ?? "");
      setProduct(r.product ?? "");
      setPrice(r.price !== undefined ? String(r.price) : "");
      setCurrency(r.currency ?? "USD");
      setInterval(r.billingInterval);
      setRenewal(toDateInput(r.nextRenewalAt));
      setTrial(toDateInput(r.trialEndsAt));
      if (!r.merchant || r.price === undefined) {
        setError(
          "We could not find merchant + price. Fill them by hand below.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    setBusy("save");
    setError(null);
    try {
      const m = merchant.trim();
      const parsed = Number.parseFloat(price);
      if (!m) throw new Error("Merchant is required");
      if (!Number.isFinite(parsed) || parsed <= 0)
        throw new Error("Enter a valid price");
      const id = await upsert({
        merchant: m,
        product: product.trim() || undefined,
        price: parsed,
        currency: currency.trim().toUpperCase().slice(0, 3) || "USD",
        billingInterval: interval,
        nextRenewalAt: fromDateInput(renewal),
        trialEndsAt: fromDateInput(trial),
      });
      await addEvidence({
        subscriptionId: id,
        source: `${m} manual entry`,
        sourceType: "manual",
        excerpt: (preview?.quote || text).slice(0, 10000),
        confidence: preview?.confidence ?? 0.6,
      });
      sileo.success({
        title: "Added",
        description: `${m} is tracked. Research runs in the background.`,
      });
      setText("");
      setSubject("");
      setPreview(null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold">
            Add from receipt
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <HugeiconsIcon
              icon={
                Cancel01Icon as unknown as Parameters<
                  typeof HugeiconsIcon
                >[0]["icon"]
              }
              size={16}
              color="currentColor"
            />
          </button>
        </div>

        {!preview ? (
          <>
            <p className="text-xs text-muted-foreground">
              Paste the full receipt or trial email. Nothing saves until you
              confirm.
            </p>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (optional)"
              className={inputCls}
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste receipt text here..."
              rows={8}
              className="w-full rounded-lg border border-input bg-card p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={busy !== null || text.trim().length < 20}
                onClick={() => void handleExtract()}
              >
                {busy === "extract" ? (
                  <>
                    <HugeiconsIcon
                      icon={
                        Loading03Icon as unknown as Parameters<
                          typeof HugeiconsIcon
                        >[0]["icon"]
                      }
                      size={14}
                      color="currentColor"
                      className="animate-spin"
                    />
                    Reading...
                  </>
                ) : (
                  "Extract"
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Check the read below. Fix anything wrong, then save.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Merchant *
                </span>
                <input
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Plan
                </span>
                <input
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Price *
                </span>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="decimal"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Currency
                </span>
                <input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  maxLength={3}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Interval
                </span>
                <select
                  value={interval}
                  onChange={(e) =>
                    setInterval(e.target.value as Preview["billingInterval"])
                  }
                  className={inputCls}
                >
                  <option value="monthly">monthly</option>
                  <option value="yearly">yearly</option>
                  <option value="weekly">weekly</option>
                  <option value="unknown">unknown</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Renews
                </span>
                <input
                  type="date"
                  value={renewal}
                  onChange={(e) => setRenewal(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="col-span-2 block">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Trial ends
                </span>
                <input
                  type="date"
                  value={trial}
                  onChange={(e) => setTrial(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreview(null)}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void handleSave()}
                >
                  {busy === "save" ? "Saving..." : "Save subscription"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
