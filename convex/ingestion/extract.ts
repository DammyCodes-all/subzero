"use node";

import { v } from "convex/values";
import { env, internalAction } from "../_generated/server";

const extractedReturns = v.object({
  merchant: v.optional(v.string()),
  product: v.optional(v.string()),
  price: v.optional(v.number()),
  currency: v.optional(v.string()),
  billingInterval: v.union(
    v.literal("monthly"),
    v.literal("yearly"),
    v.literal("weekly"),
    v.literal("unknown"),
  ),
  nextRenewalAt: v.optional(v.number()),
  trialEndsAt: v.optional(v.number()),
  billingProvider: v.optional(v.string()),
  isConfirmation: v.boolean(),
  confidence: v.number(),
  quote: v.string(),
});

function parseDateToMs(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return undefined;
  return ms;
}

function mockExtract(
  text: string,
  subject: string,
): {
  merchant: string | undefined;
  product: string | undefined;
  price: number | undefined;
  currency: string;
  billingInterval: "monthly" | "yearly" | "weekly" | "unknown";
  nextRenewalAt: number | undefined;
  trialEndsAt: number | undefined;
  billingProvider: string | undefined;
  isConfirmation: boolean;
  confidence: number;
  quote: string;
} {
  const combined = `${subject} ${text}`.toLowerCase();
  const isConfirmation =
    /cancelled|canceled|subscription.*cancel|cancellation confirmed/i.test(
      combined,
    );

  // Prefer $ price with decimals (e.g. $54.99), fallback to decimal pattern.
  // No loose fallback — avoid capturing year 2026 from dates as price.
  let price: number | undefined;
  let currency = "USD";
  const dollarMatch = combined.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  const genericMatch = combined.match(/(\d+\.\d{2})\s*(usd|eur|gbp)?/i);
  const rawMatch = dollarMatch ?? genericMatch;
  if (rawMatch) {
    const n = Number.parseFloat(rawMatch[1]);
    if (!Number.isNaN(n) && n > 0 && n < 10000) price = n;
    const cur = (rawMatch[2] ?? "").toLowerCase();
    if (cur === "eur") currency = "EUR";
    else if (cur === "gbp") currency = "GBP";
  }

  // Merchant from subject or common names
  const merchants = [
    "adobe",
    "canva",
    "spotify",
    "notion",
    "netflix",
    "chatgpt",
    "figma",
    "linear",
    "google",
    "apple",
  ];
  let merchant: string | undefined;
  for (const m of merchants) {
    if (combined.includes(m)) {
      merchant = m.charAt(0).toUpperCase() + m.slice(1);
      if (m === "chatgpt") merchant = "ChatGPT";
      break;
    }
  }
  if (!merchant) {
    // Fallback: first capitalized word in subject
    const subjMatch = subject.match(/([A-Z][a-z]+)/);
    if (subjMatch) merchant = subjMatch[1];
  }

  const interval = (
    combined.includes("yearly") || combined.includes("annual")
      ? "yearly"
      : combined.includes("weekly")
        ? "weekly"
        : /month/i.test(combined)
          ? "monthly"
          : "unknown"
  ) as "monthly" | "yearly" | "weekly" | "unknown";

  let billingProvider: string | undefined;
  if (combined.includes("google play") || combined.includes("google"))
    billingProvider = "Google Play";
  else if (combined.includes("apple") || combined.includes("app store"))
    billingProvider = "Apple";
  else if (combined.includes("amazon")) billingProvider = "Amazon";

  const quote = text.slice(0, 300).trim() || subject.slice(0, 300);

  return {
    merchant,
    product: undefined,
    price,
    currency,
    billingInterval: interval,
    nextRenewalAt: undefined,
    trialEndsAt: undefined,
    billingProvider,
    isConfirmation,
    confidence:
      merchant && price ? 0.7 : isConfirmation && merchant ? 0.8 : 0.3,
    quote,
  };
}

export const extractSubscription = internalAction({
  args: {
    text: v.string(),
    subject: v.string(),
  },
  returns: extractedReturns,
  handler: async (_ctx, args) => {
    const apiKey =
      (env as unknown as { OPENAI_API_KEY?: string }).OPENAI_API_KEY ??
      process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const m = mockExtract(args.text, args.subject);
      return {
        merchant: m.merchant,
        product: m.product,
        price: m.price,
        currency: m.currency,
        billingInterval: m.billingInterval as
          | "monthly"
          | "yearly"
          | "weekly"
          | "unknown",
        nextRenewalAt: m.nextRenewalAt,
        trialEndsAt: m.trialEndsAt,
        billingProvider: m.billingProvider,
        isConfirmation: m.isConfirmation,
        confidence: m.confidence,
        quote: m.quote,
      };
    }

    const system =
      "You extract subscription info from forwarded emails. Return JSON with keys: merchant (string or null), product (string or null), price (number or null), currency (USD/EUR/GBP or null), billingInterval (monthly|yearly|weekly|unknown), nextRenewalAt (ISO date string or null), trialEndsAt (ISO date string or null), billingProvider (string or null, e.g. Google Play, Apple, Amazon), isConfirmation (boolean: true if this email confirms a cancellation), confidence (0-1), quote (exact substring from email supporting price or renewal date, max 300 chars). Never invent a price or date. If unsure, null.";

    const userContent = `Subject: ${args.subject}\n\nBody:\n${args.text.slice(0, 15000)}`;

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: userContent },
          ],
        }),
      });

      if (!res.ok) {
        const m = mockExtract(args.text, args.subject);
        return {
          merchant: m.merchant,
          product: m.product,
          price: m.price,
          currency: m.currency,
          billingInterval: m.billingInterval as
            | "monthly"
            | "yearly"
            | "weekly"
            | "unknown",
          nextRenewalAt: m.nextRenewalAt,
          trialEndsAt: m.trialEndsAt,
          billingProvider: m.billingProvider,
          isConfirmation: m.isConfirmation,
          confidence: m.confidence,
          quote: m.quote,
        };
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content) as Record<string, unknown>;

      const merchant =
        typeof parsed.merchant === "string" && parsed.merchant.trim()
          ? parsed.merchant.trim()
          : undefined;
      const product =
        typeof parsed.product === "string" && parsed.product.trim()
          ? parsed.product.trim()
          : undefined;
      const price =
        typeof parsed.price === "number" && !Number.isNaN(parsed.price)
          ? parsed.price
          : undefined;
      const currency =
        typeof parsed.currency === "string" && parsed.currency.trim()
          ? parsed.currency.trim().toUpperCase().slice(0, 3)
          : price
            ? "USD"
            : undefined;
      const intervalRaw =
        typeof parsed.billingInterval === "string"
          ? parsed.billingInterval.toLowerCase()
          : "unknown";
      const billingInterval = (
        intervalRaw === "monthly" ||
        intervalRaw === "yearly" ||
        intervalRaw === "weekly"
          ? intervalRaw
          : "unknown"
      ) as "monthly" | "yearly" | "weekly" | "unknown";
      const billingProvider =
        typeof parsed.billingProvider === "string" &&
        parsed.billingProvider.trim()
          ? parsed.billingProvider.trim()
          : undefined;
      const isConfirmation = parsed.isConfirmation === true;
      const confidence =
        typeof parsed.confidence === "number" &&
        !Number.isNaN(parsed.confidence)
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5;
      const quote =
        typeof parsed.quote === "string" && parsed.quote.trim()
          ? parsed.quote.trim().slice(0, 500)
          : args.text.slice(0, 300);
      const nextRenewalAt = parseDateToMs(
        parsed.nextRenewalAt as string | null,
      );
      const trialEndsAt = parseDateToMs(parsed.trialEndsAt as string | null);

      return {
        merchant,
        product,
        price,
        currency,
        billingInterval,
        nextRenewalAt,
        trialEndsAt,
        billingProvider,
        isConfirmation,
        confidence,
        quote,
      };
    } catch {
      const m = mockExtract(args.text, args.subject);
      return {
        merchant: m.merchant,
        product: m.product,
        price: m.price,
        currency: m.currency,
        billingInterval: m.billingInterval as
          | "monthly"
          | "yearly"
          | "weekly"
          | "unknown",
        nextRenewalAt: m.nextRenewalAt,
        trialEndsAt: m.trialEndsAt,
        billingProvider: m.billingProvider,
        isConfirmation: m.isConfirmation,
        confidence: m.confidence,
        quote: m.quote,
      };
    }
  },
});
