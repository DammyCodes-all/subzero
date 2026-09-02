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
    /cancellation confirmed|subscription.*has been cancell?ed|has been cancell?ed|successfully cancell?ed|your subscription.*cancell?ed/i.test(
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

  // Merchant from subject or common names — snap before google so "Snap Inc on Google Play" doesn't become Google
  const merchants = [
    "snap",
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
      if (m === "snap") merchant = "Snap Inc";
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
    const openrouterKey =
      (env as unknown as { OPENROUTER_API_KEY?: string }).OPENROUTER_API_KEY ??
      process.env.OPENROUTER_API_KEY;
    const openaiKey =
      (env as unknown as { OPENAI_API_KEY?: string }).OPENAI_API_KEY ??
      process.env.OPENAI_API_KEY;
    // Prefer Groq -> OpenRouter -> OpenAI -> mock
    const hasAnyKey = !!(groqKey || openrouterKey || openaiKey);
    const primaryProvider = groqKey ? "groq" : openrouterKey ? "openrouter" : openaiKey ? "openai" : null;
    console.log(`[extract] Provider: ${primaryProvider ?? "MOCK (no API key)"}, subject="${args.subject.slice(0, 60)}", textLen=${args.text.length}`);
    if (!hasAnyKey || !primaryProvider) {
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

    const system = `You are a precise subscription extraction engine. Extract from forwarded email text into valid JSON ONLY.

TASK: Extract subscription fields from DOCUMENT below. Follow SCHEMA exactly.

SCHEMA — return ONLY valid JSON matching this exact schema. Do not add keys. Do not remove keys. No markdown, no code fences, no explanation. Use null for missing fields (never omit a key).

{
  "merchant": "<canonical brand string | null>",
  "product": "<plan/feature string | null>",
  "price": "<number | null>",
  "currency": "<USD|EUR|GBP|NGN|INR|JPY|CAD|AUD | null>",
  "billingInterval": "<monthly|yearly|weekly|unknown>",
  "nextRenewalAt": "<ISO 8601 date string | null>",
  "trialEndsAt": "<ISO 8601 date string | null>",
  "billingProvider": "<string | null>",
  "isConfirmation": "<boolean>",
  "confidence": "<number 0-1>",
  "quote": "<exact substring from email max 300 chars>"
}

RULES:
- Missing field → null. Do NOT guess, do NOT infer. If not explicitly stated, null.
- Only recurring subscriptions (monthly/yearly/weekly or auto-renew trial). One-time purchase/exam fee without renewal (e.g., NATIONAL EXAMINATIONS COUNCIL ₦5,100) → merchant null, price null.
- price: strip commas ₦7,700.00→7700; JPY no decimals ¥7,700→7700; number type, not string.
- currency: infer from symbol/suffix: $→USD, C$→CAD, A$→AUD, €→EUR, £→GBP, ₦→NGN, ₹→INR, ¥→JPY, or suffix "12.99 CAD". If unsure, null (not USD).
- billingInterval enum only monthly|yearly|weekly|unknown. unknown if not stated.
- dates ISO 8601 YYYY-MM-DD or null. Do not compute; use explicit date in text.
- isConfirmation true only if email explicitly confirms cancellation (cancelled/canceled confirmed).
- quote: exact substring backing price or renewal date, max 300 chars.
- CONFIDENCE: 0.95-0.99 explicit price+renewal labeled, 0.85-0.95 needs minor interpretation, 0.6-0.85 ambiguous.

CANONICAL MERCHANT MAP (brand only, never product/billingProvider):
- Any merchant containing "google" → "Google One"
- Snap → "Snap Inc", OpenAI → "ChatGPT", others: Adobe, Spotify, Notion, Netflix, Figma, Linear, Canva, YouTube
- Examples:
  1) Input text "Google AI Plus (400 GB) (Google One)" → merchant "Google One", product "Google AI Plus (400 GB)"
  2) Input "Google One 2TB via Google Play ₦7,700 monthly" → merchant "Google One", product "Google One 2TB"
  3) Input "Snap Inc (Snapchat+) billed via Google Play" → merchant "Snap Inc", product "Snapchat+", billingProvider "Google Play"
- Never repeat merchant in product; never put "Google Play"/"Apple" in merchant.

FEW-SHOT — exact outputs:

Document: Subject: Your Google Play Order Receipt from 20 Aug 2026 Body: Google AI Plus (400 GB) (Google One) Your trial will end on 20 Aug 2027. You will be automatically charged ₦7,700.00/month via Google Play
=> {"merchant":"Google One","product":"Google AI Plus (400 GB)","price":7700,"currency":"NGN","billingInterval":"monthly","nextRenewalAt":"2027-08-20","trialEndsAt":"2027-08-20","billingProvider":"Google Play","isConfirmation":false,"confidence":0.98,"quote":"Your trial will end on 20 Aug 2027. You will be automatically charged ₦7,700.00/month"}

Document: Subject: NATIONAL EXAMINATIONS COUNCIL Invoice Body: ₦5,100 single payment for 2024 exam, no renewal
=> {"merchant":null,"product":null,"price":null,"currency":null,"billingInterval":"unknown","nextRenewalAt":null,"trialEndsAt":null,"billingProvider":null,"isConfirmation":false,"confidence":0.99,"quote":"₦5,100 single payment"}

Document: Subject: Your trial ends soon Body: Spotify Premium $9.99/month renews 2026-09-15
=> {"merchant":"Spotify","product":"Spotify Premium","price":9.99,"currency":"USD","billingInterval":"monthly","nextRenewalAt":"2026-09-15","trialEndsAt":null,"billingProvider":null,"isConfirmation":false,"confidence":0.96,"quote":"$9.99/month renews 2026-09-15"}

VALIDATION: Respond with raw JSON only. No markdown, no code fences, no extra text. All keys present, no trailing commas, no single quotes.`;

    const userContent = `Subject: ${args.subject}\n\nBody:\n${args.text.slice(0, 15000)}`;
    type ProviderCfg = { id: string; key: string; endpoint: string; model: string };
    const providers: ProviderCfg[] = [];
    if (groqKey) providers.push({ id: "groq", key: groqKey, endpoint: "https://api.groq.com/openai/v1/chat/completions", model: GROQ_EXTRACTION_MODEL });
    if (openrouterKey) providers.push({ id: "openrouter", key: openrouterKey, endpoint: "https://openrouter.ai/api/v1/chat/completions", model: (env as unknown as { OPENROUTER_MODEL?: string }).OPENROUTER_MODEL ?? process.env.OPENROUTER_MODEL ?? "openrouter/free" });
    if (openaiKey) providers.push({ id: "openai", key: openaiKey, endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" });

    try {
      // Try providers in order Groq -> OpenRouter -> OpenAI, with 429 backoff and fallback
      let res: Response | null = null;
      let lastErrText = "";
      let usedProvider: string = primaryProvider ?? "unknown";
    providerLoop: for (const prov of providers) {
      usedProvider = prov.id;
      console.log(`[extract] Trying provider ${prov.id} model ${prov.model}`);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const headers: Record<string, string> = {
            Authorization: `Bearer ${prov.key}`,
            "Content-Type": "application/json",
          };
          if (prov.id === "openrouter") {
            headers["HTTP-Referer"] = process.env.SITE_URL ?? "http://localhost:3000";
            headers["X-Title"] = "SubZero";
          }
          const r = await fetch(prov.endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: prov.model,
              temperature: 0,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: system },
                { role: "user", content: userContent },
              ],
            }),
          });
          if (r.ok) {
            res = r;
            break providerLoop;
          }
          lastErrText = await r.text();
          console.error(`[extract] LLM API error ${prov.id}: ${r.status} ${lastErrText.slice(0, 200)} attempt ${attempt + 1}/3`);
          if (r.status === 429 && attempt < 2) {
            const backoff = 1200 * (attempt + 1) + Math.random() * 400;
            await new Promise((rr) => setTimeout(rr, backoff));
            continue;
          }
          if (r.status === 429 && attempt === 2) {
            console.log(`[extract] Provider ${prov.id} exhausted 429, trying next provider`);
            break; // break inner, outer will try next provider
          }
          break; // non-429 failure -> try next provider as well
        } catch (e) {
          lastErrText = String(e).slice(0, 200);
          console.error(`[extract] LLM fetch failed ${prov.id} attempt ${attempt + 1}/3: ${lastErrText}`);
          if (attempt < 2) await new Promise((rr) => setTimeout(rr, 800 * (attempt + 1)));
          else break;
        }
      }
      // if we exhausted attempts for this provider without success, continue to next provider if last error was rate limit or fetch error
      if (!res && (lastErrText.includes("429") || lastErrText.includes("Rate limit") || lastErrText.includes("fetch failed"))) {
        console.log(`[extract] Falling back from ${prov.id} to next provider`);
        continue;
      }
      if (!res) break;
    }
    if (!res || !res.ok) {
      console.error(`[extract] LLM failed after retries: ${lastErrText.slice(0, 200)}`);
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
