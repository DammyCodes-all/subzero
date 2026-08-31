"use node";

import { v } from "convex/values";
import { env, internalAction } from "../_generated/server";
import { GROQ_EXTRACTION_MODEL } from "../lib/aiModels";
import { ISO_SET, normalizeCurrency, SYMBOL_TO_ISO, ZERO_DECIMAL } from "../lib/currencies";

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
  const combinedRaw = `${subject} ${text}`; // keep original case for symbol detection
  const isConfirmation =
    /cancelled|canceled|subscription.*cancel|cancellation confirmed/i.test(
      combined,
    );

  // Top 8 currency extraction — symbol directly before number wins (not any symbol in body)
  // Handles US 7,700.00 only (strip commas), not EU 1.234,56 (documented out-of-scope)
  let price: number | undefined;
  let currency = "USD";
  let rawPriceStr: string | undefined;
  let detectedCurrency: string | undefined;

  // 1) Explicit suffix code: "12.99 USD", "1,499.00 INR", "7,700 CAD" — most reliable
  const suffixMatch = combinedRaw.match(/([\d,]+(?:\.\d{1,2})?)\s*(USD|EUR|GBP|NGN|INR|JPY|CAD|AUD)\b/i);
  if (suffixMatch) {
    rawPriceStr = suffixMatch[1];
    detectedCurrency = suffixMatch[2].toUpperCase();
  } else {
    // 2) Symbol before number — check longest symbols first (C$, A$ before $)
    // Order: C$, A$, ₦, ₹, ¥, €, £, $
    const symbolPatterns: Array<{ sym: string; iso: string; regex: RegExp }> = [
      { sym: "C$", iso: "CAD", regex: /C\$\s*([\d,]+(?:\.\d{1,2})?)/ },
      { sym: "A$", iso: "AUD", regex: /A\$\s*([\d,]+(?:\.\d{1,2})?)/ },
      { sym: "₦", iso: "NGN", regex: /₦\s*([\d,]+(?:\.\d{1,2})?)/ },
      { sym: "₹", iso: "INR", regex: /₹\s*([\d,]+(?:\.\d{1,2})?)/ },
      { sym: "¥", iso: "JPY", regex: /¥\s*([\d,]+(?:\.\d{1,2})?)/ },
      { sym: "€", iso: "EUR", regex: /€\s*([\d,]+(?:\.\d{1,2})?)/ },
      { sym: "£", iso: "GBP", regex: /£\s*([\d,]+(?:\.\d{1,2})?)/ },
      { sym: "$", iso: "USD", regex: /\$\s*([\d,]+(?:\.\d{1,2})?)/ },
    ];
    for (const p of symbolPatterns) {
      const m = combinedRaw.match(p.regex);
      if (m) {
        rawPriceStr = m[1];
        detectedCurrency = p.iso;
        // Disambiguate $: if text contains CAD/AUD near the price, use that instead
        if (p.sym === "$") {
          const lower = combined;
          const dollarIdx = combinedRaw.indexOf(m[0]);
          const window = combined.slice(Math.max(0, dollarIdx - 20), dollarIdx + m[0].length + 20);
          if (window.includes("cad") || lower.includes("canadian")) detectedCurrency = "CAD";
          else if (window.includes("aud") || lower.includes("australian")) detectedCurrency = "AUD";
        }
        break;
      }
    }
    // 3) Fallback: bare number with 2 decimals and no symbol (e.g. "7,700.00" alone) → keep USD only if no other hint
    if (!rawPriceStr) {
      const bare = combined.match(/([\d,]+\.\d{2})/);
      if (bare) {
        // Avoid capturing years like 2026.00 — require price < 1M and not a year prefix
        rawPriceStr = bare[1];
        detectedCurrency = "USD";
      }
    }
  }

  if (detectedCurrency) {
    const norm = normalizeCurrency(detectedCurrency);
    if (norm) currency = norm;
    else if (ISO_SET.has(detectedCurrency)) currency = detectedCurrency;
  }
  if (rawPriceStr) {
    const cleaned = rawPriceStr.replace(/,/g, "");
    const n = Number.parseFloat(cleaned);
    // Allow integers for JPY (¥7,700), otherwise require >0
    const isZeroDec = detectedCurrency ? ZERO_DECIMAL.has(detectedCurrency) : false;
    if (!Number.isNaN(n) && n > 0 && n < 1000000) {
      // For zero-decimal like JPY, price should be integer — but still accept float and floor?
      price = isZeroDec ? Math.round(n) : n;
    }
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
    const groqKey =
      (env as unknown as { GROQ_API_KEY?: string }).GROQ_API_KEY ??
      process.env.GROQ_API_KEY;
    const openaiKey =
      (env as unknown as { OPENAI_API_KEY?: string }).OPENAI_API_KEY ??
      process.env.OPENAI_API_KEY;
    // Prefer Groq (free tier) if set, else OpenAI, else mock
    const provider = groqKey ? "groq" : openaiKey ? "openai" : null;
    const apiKey = groqKey ?? openaiKey;
    console.log(`[extract] Provider: ${provider ?? "MOCK (no API key)"}, subject="${args.subject.slice(0, 60)}", textLen=${args.text.length}`);
    if (!apiKey || !provider) {
      console.log("[extract] No API key — using mock extraction");
      const m = mockExtract(args.text, args.subject);
      console.log(`[extract] Mock result: merchant="${m.merchant ?? "null"}", price=${m.price ?? "null"}, currency="${m.currency}"`);
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
      "You extract subscription info from forwarded emails. Return JSON with keys: merchant (string or null), product (string or null), price (number or null), currency (ISO 4217 code: USD, EUR, GBP, NGN, INR, JPY, CAD, AUD — infer from symbol: $→USD, C$→CAD, A$→AUD, €→EUR, £→GBP, ₦→NGN, ₹→INR, ¥→JPY, or suffix like 12.99 CAD — or null), billingInterval (monthly|yearly|weekly|unknown), nextRenewalAt (ISO date string or null), trialEndsAt (ISO date string or null), billingProvider (string or null, e.g. Google Play, Apple, Amazon), isConfirmation (boolean: true if this email confirms a cancellation), confidence (0-1), quote (exact substring from email supporting price or renewal date, max 300 chars). Rules: (1) Only extract recurring subscriptions — monthly/yearly/weekly or a trial that will auto-renew. If it's a one-time payment, exam fee, or purchase without renewal (e.g., NATIONAL EXAMINATIONS COUNCIL ₦5,100, single invoice), return merchant null and price null. (2) Merchant is the service (Snap Inc, Spotify, Notion) not the processor — Google Play/Apple is billingProvider. Never invent a price or date. If unsure, null. For price, strip commas: ₦7,700.00→7700. For JPY, no decimals: ¥7,700→7700.";

    const userContent = `Subject: ${args.subject}\n\nBody:\n${args.text.slice(0, 15000)}`;
    const endpoint =
      provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";
    const model = provider === "groq" ? GROQ_EXTRACTION_MODEL : "gpt-4o-mini";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          ...(provider === "openai"
            ? { response_format: { type: "json_object" } }
            : { response_format: { type: "json_object" } }),
          messages: [
            { role: "system", content: system },
            { role: "user", content: userContent },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[extract] LLM API error: ${res.status} ${errText.slice(0, 200)}`);
        const m = mockExtract(args.text, args.subject);
        console.log(`[extract] Falling back to mock: merchant="${m.merchant ?? "null"}", price=${m.price ?? "null"}`);
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
      console.log(`[extract] LLM raw response: ${content.slice(0, 300)}`);
      const parsed = JSON.parse(content) as Record<string, unknown>;

      let merchant =
        typeof parsed.merchant === "string" && parsed.merchant.trim()
          ? parsed.merchant.trim()
          : undefined;
      let product =
        typeof parsed.product === "string" && parsed.product.trim()
          ? parsed.product.trim()
          : undefined;
      let price =
        typeof parsed.price === "number" && !Number.isNaN(parsed.price)
          ? parsed.price
          : typeof parsed.price === "string"
            ? Number.parseFloat((parsed.price as string).replace(/,/g, ""))
            : undefined;
      if (typeof price === "number" && Number.isNaN(price)) price = undefined;
      let currency = normalizeCurrency(
        typeof parsed.currency === "string" ? parsed.currency : undefined,
      );
      if (!currency && price !== undefined) currency = "USD";
      // Use mock as fallback when Groq omits or hallucinates (e.g. "US Dollar" → USD via normalize, but invalid ISO)
      const mockFallback = mockExtract(args.text, args.subject);
      const mockIso = normalizeCurrency(mockFallback.currency) ?? mockFallback.currency;
      if (price === undefined && mockFallback.price !== undefined) {
        price = mockFallback.price;
        if (mockIso) currency = mockIso;
      }
      if (!merchant && mockFallback.merchant) {
        merchant = mockFallback.merchant;
      }
      // Correct currency if Groq and mock disagree but price matches — use symbol directly before number (not any symbol in body)
      // Avoids misfire on "$45 approx ₦68k" where body contains ₦ but price is $45
      if (mockIso && currency && mockIso !== currency && mockFallback.price === price) {
        const priceStr = String(price);
        const mockSym = Object.keys(SYMBOL_TO_ISO).find(k => SYMBOL_TO_ISO[k]===mockIso) ?? "";
        const groqSym = Object.keys(SYMBOL_TO_ISO).find(k => SYMBOL_TO_ISO[k]===currency) ?? "";
        const text = args.text;
        const hasMockSym = mockSym ? (text.includes(`${mockSym}${priceStr}`) || text.includes(`${mockSym} ${priceStr}`) || text.includes(`${priceStr} ${mockIso}`) || mockFallback.quote.includes(mockSym)) : false;
        const hasGroqSym = groqSym ? (text.includes(`${groqSym}${priceStr}`) || text.includes(`${groqSym} ${priceStr}`) || (parsed.quote as string | "")?.includes(groqSym)) : false;
        if (hasMockSym && !hasGroqSym) currency = mockIso;
        else if (!hasMockSym && hasGroqSym) {
          // keep Groq
        } else if (hasMockSym && hasGroqSym) {
          // Both present — keep Groq (LLM more context)
        } else {
          // Neither symbol clearly — if Groq is generic USD and mock is specific (NGN/INR/JPY), prefer mock only when Groq quote doesn't contain $
          if (currency === "USD" && mockIso !== "USD" && !(parsed.quote as string | "")?.includes("$")) currency = mockIso;
        }
      }
      // Final validation: if currency not in Top 8 but looks like ISO (e.g. ZAR), allow it (Intl will try), else default USD
      if (currency && !ISO_SET.has(currency) && !/^[A-Z]{3}$/.test(currency)) {
        currency = mockIso ?? "USD";
      }
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

      console.log(`[extract] Final LLM result: merchant="${merchant ?? "null"}", price=${price ?? "null"}, currency="${currency}", isConfirmation=${isConfirmation}, confidence=${confidence}`);

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
