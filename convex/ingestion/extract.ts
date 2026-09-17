"use node";

import { v } from "convex/values";
import { env, internalAction } from "../_generated/server";
import { GROQ_EXTRACTION_MODEL, groqApiKeysFrom } from "../lib/aiModels";
import { type ProviderUsage, recordAiUsage } from "../lib/aiUsage";
import { ISO_SET, normalizeCurrency } from "../lib/currencies";

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
  lastChargeAt: v.optional(v.number()),
});

function parseDateToMs(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return undefined;
  return ms;
}

export const extractSubscription = internalAction({
  args: {
    text: v.string(),
    subject: v.string(),
    from: v.optional(v.string()),
  },
  returns: extractedReturns,
  handler: async (ctx, args) => {
    const deploymentEnv = env as unknown as Record<string, string | undefined>;
    const localEnv = process.env as unknown as Record<
      string,
      string | undefined
    >;
    // Deployment env wins locally (Convex dev loads .env.local into env).
    const mergedEnv = { ...localEnv, ...deploymentEnv };
    const groqKeys = groqApiKeysFrom(mergedEnv);
    const openrouterKey =
      deploymentEnv.OPENROUTER_API_KEY ?? localEnv.OPENROUTER_API_KEY;
    const openaiKey = deploymentEnv.OPENAI_API_KEY ?? localEnv.OPENAI_API_KEY;
    // Prefer Groq layers -> OpenRouter -> OpenAI. No mock fallback: without
    // keys extraction cannot run — the caller queues the mail for retry.
    const hasAnyKey = groqKeys.length > 0 || !!openrouterKey || !!openaiKey;
    const primaryProvider =
      groqKeys.length > 0
        ? "groq"
        : openrouterKey
          ? "openrouter"
          : openaiKey
            ? "openai"
            : null;
    console.log(
      `[extract] Provider: ${primaryProvider ?? "NONE"}, subject="${args.subject.slice(0, 60)}", textLen=${args.text.length}`,
    );
    if (!hasAnyKey || !primaryProvider) {
      throw new Error("extraction_unavailable_no_api_key");
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
  "quote": "<exact substring from email max 300 chars>",
  "lastChargeAt": "<ISO 8601 date string | null>"
}

RULES:
- Missing field → null. Do NOT guess, do NOT infer. If not explicitly stated, null.
- Only recurring subscriptions (monthly/yearly/weekly or auto-renew trial). One-time purchase/exam fee without renewal (e.g., NATIONAL EXAMINATIONS COUNCIL ₦5,100) → merchant null, price null.
- Promotional offers are NOT subscriptions, even with a price: upgrade prompts, discount offers, win-back deals ("Offer ends…", "Get deal", "% off", "Save now") describing what you COULD buy. Only extract when the mail confirms an EXISTING subscription, trial, order, receipt, or renewal for the recipient. Promo → merchant null, price null, confidence 0.9+.
- price: strip commas ₦7,700.00→7700; JPY no decimals ¥7,700→7700; number type, not string.
- currency: infer from symbol/suffix: $→USD, C$→CAD, A$→AUD, €→EUR, £→GBP, ₦→NGN, ₹→INR, ¥→JPY, or suffix "12.99 CAD". If unsure, null (not USD).
- billingInterval enum only monthly|yearly|weekly|unknown. unknown if not stated.
- dates ISO 8601 YYYY-MM-DD or null. Do not compute; use explicit date in text.
- lastChargeAt: the explicit order/charge/start date stated in the mail (e.g. "Order date: September 12, 2026" → "2026-09-12"). Null if none stated. Never compute it — code derives the renewal from it.
- isConfirmation true only if email explicitly confirms cancellation (cancelled/canceled confirmed).
- quote: exact substring backing price or renewal date, max 300 chars. Minimal markdown (**bold**, *italic*, \`code\`, [text](https://…)) wherever it aids clarity; never headings, lists, tables, or images.
- CONFIDENCE: 0.95-0.99 explicit price+renewal labeled, 0.85-0.95 needs minor interpretation, 0.6-0.85 ambiguous.

CANONICAL MERCHANT MAP (brand only, never product/billingProvider):
- Any merchant containing "google" → "Google One"
- Snap → "Snap Inc", OpenAI → "ChatGPT", others: Adobe, Spotify, Notion, Netflix, Figma, Linear, Canva, YouTube
- Unknown brands (gyms, local businesses): use the sender/brand name from the From header or the "Welcome to X" subject — e.g. From "i-Fitness" + Subject "Welcome to i-Fitness!" → merchant "i-Fitness". Never use greeting words ("Welcome", "Hello") or pronouns ("Your") as the merchant; if no brand is identifiable, return null.
- Examples:
  1) Input text "Google AI Plus (400 GB) (Google One)" → merchant "Google One", product "Google AI Plus (400 GB)"
  2) Input "Google One 2TB via Google Play ₦7,700 monthly" → merchant "Google One", product "Google One 2TB"
  3) Input "Snap Inc (Snapchat+) billed via Google Play" → merchant "Snap Inc", product "Snapchat+", billingProvider "Google Play"
- Never repeat merchant in product; never put "Google Play"/"Apple" in merchant.
- product is the plan/feature only. Never copy app-store titles — strip any "(Name: tagline)" suffix, e.g. "Snapchat+ (Snapchat: Chat with Friends)" → product "Snapchat+".

FEW-SHOT — exact outputs:

Document: Subject: Your Google Play Order Receipt from 20 Aug 2026 Body: Google AI Plus (400 GB) (Google One) Your trial will end on 20 Aug 2027. You will be automatically charged ₦7,700.00/month via Google Play
=> {"merchant":"Google One","product":"Google AI Plus (400 GB)","price":7700,"currency":"NGN","billingInterval":"monthly","nextRenewalAt":"2027-08-20","trialEndsAt":"2027-08-20","billingProvider":"Google Play","isConfirmation":false,"confidence":0.98,"quote":"Your trial will end on 20 Aug 2027. You will be automatically charged ₦7,700.00/month","lastChargeAt":null}

Document: Subject: NATIONAL EXAMINATIONS COUNCIL Invoice Body: ₦5,100 single payment for 2024 exam, no renewal
=> {"merchant":null,"product":null,"price":null,"currency":null,"billingInterval":"unknown","nextRenewalAt":null,"trialEndsAt":null,"billingProvider":null,"isConfirmation":false,"confidence":0.99,"quote":"₦5,100 single payment","lastChargeAt":null}

Document: Subject: Your trial ends soon Body: Spotify Premium $9.99/month renews 2026-09-15
=> {"merchant":"Spotify","product":"Spotify Premium","price":9.99,"currency":"USD","billingInterval":"monthly","nextRenewalAt":"2026-09-15","trialEndsAt":null,"billingProvider":null,"isConfirmation":false,"confidence":0.96,"quote":"$9.99/month renews 2026-09-15","lastChargeAt":null}

Document: From: The Proton Team Subject: Go Unlimited for US$1 Body: Upgrade to Proton Unlimited for US$1 in your first month. Get deal. 92% off. Billed at US$1 for the first month. Renews at US$12.99. Offer ends September 11, 2026.
=> {"merchant":null,"product":null,"price":null,"currency":null,"billingInterval":"unknown","nextRenewalAt":null,"trialEndsAt":null,"billingProvider":null,"isConfirmation":false,"confidence":0.95,"quote":"Offer ends September 11, 2026","lastChargeAt":null}

VALIDATION: Respond with raw JSON only. No markdown, no code fences, no extra text. All keys present, no trailing commas, no single quotes.`;

    // Head-cut loses forwards (original sits behind headers/quotes) and long
    // threads (receipt below quoted noise). Keep the head plus a window
    // around the first price signal so the LLM sees headers AND evidence.
    const selectWindow = (text: string): string => {
      const HEAD = 3000;
      const WINDOW = 1500;
      const CAP = 4500;
      if (text.length <= CAP) return text;
      const head = text.slice(0, HEAD);
      const m =
        /(\$|€|£|₦|₹|¥)\s*[\d,]+|[\d,]+\s*(USD|EUR|GBP|NGN|INR|JPY|CAD|AUD)/i.exec(
          text,
        );
      if (!m?.index || m.index < HEAD) return text.slice(0, CAP);
      const start = Math.max(0, m.index - 500);
      return `${head}\n…\n${text.slice(start, start + WINDOW)}`.slice(0, CAP);
    };
    const userContent = `From: ${args.from ?? "(unknown)"}\nSubject: ${args.subject}\n\nBody:\n${selectWindow(args.text)}`;
    type ProviderCfg = {
      id: string;
      key: string;
      endpoint: string;
      model: string;
    };
    const providers: ProviderCfg[] = [];
    groqKeys.forEach((key, i) => {
      providers.push({
        id: i === 0 ? "groq" : `groq-${i + 1}`,
        key,
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        model: GROQ_EXTRACTION_MODEL,
      });
    });
    if (openrouterKey)
      providers.push({
        id: "openrouter",
        key: openrouterKey,
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        model:
          (env as unknown as { OPENROUTER_MODEL?: string }).OPENROUTER_MODEL ??
          process.env.OPENROUTER_MODEL ??
          "openrouter/free",
      });
    if (openaiKey)
      providers.push({
        id: "openai",
        key: openaiKey,
        endpoint: "https://api.openai.com/v1/chat/completions",
        model: "gpt-4o-mini",
      });

    let usedProvider = primaryProvider ?? "unknown";
    let usedModel = providers[0]?.model ?? "unknown";
    let successfulLatencyMs = 0;
    try {
      // Try providers in order Groq -> OpenRouter -> OpenAI, fail fast on
      // 429: Groq gets 1 attempt then immediate fallback (3x retries cost
      // ~4s per throttled mail and the fallback is what succeeds anyway).
      let res: Response | null = null;
      let lastErrText = "";
      providerLoop: for (const prov of providers) {
        usedProvider = prov.id;
        usedModel = prov.model;
        console.log(`[extract] Trying provider ${prov.id} model ${prov.model}`);
        const maxAttempts = prov.id.startsWith("groq") ? 1 : 2;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const headers: Record<string, string> = {
              Authorization: `Bearer ${prov.key}`,
              "Content-Type": "application/json",
            };
            if (prov.id === "openrouter") {
              headers["HTTP-Referer"] =
                process.env.SITE_URL ?? "http://localhost:3000";
              headers["X-Title"] = "SubZero";
            }
            const startedAt = Date.now();
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
                max_tokens: 500,
              }),
            });
            if (r.ok) {
              successfulLatencyMs = Date.now() - startedAt;
              res = r;
              break providerLoop;
            }
            lastErrText = await r.text();
            await recordAiUsage(ctx, {
              operation: "extraction",
              provider: prov.id,
              model: prov.model,
              latencyMs: Date.now() - startedAt,
              success: false,
            });
            console.error(
              `[extract] LLM API error ${prov.id}: ${r.status} ${lastErrText.slice(0, 200)} attempt ${attempt + 1}/${maxAttempts}`,
            );
            if (r.status === 429 && attempt < maxAttempts - 1) {
              const backoff = 1200 * (attempt + 1) + Math.random() * 400;
              await new Promise((rr) => setTimeout(rr, backoff));
              continue;
            }
            if (r.status === 429 && attempt === maxAttempts - 1) {
              console.log(
                `[extract] Provider ${prov.id} exhausted 429, trying next provider`,
              );
              break; // break inner, outer will try next provider
            }
            break; // non-429 failure -> try next provider as well
          } catch (e) {
            lastErrText = String(e).slice(0, 200);
            console.error(
              `[extract] LLM fetch failed ${prov.id} attempt ${attempt + 1}/${maxAttempts}: ${lastErrText}`,
            );
            if (attempt < maxAttempts - 1)
              await new Promise((rr) => setTimeout(rr, 800 * (attempt + 1)));
            else break;
          }
        }
        // if we exhausted attempts for this provider without success, continue to next provider if last error was rate limit or fetch error
        if (
          !res &&
          (lastErrText.includes("429") ||
            lastErrText.includes("Rate limit") ||
            lastErrText.includes("fetch failed"))
        ) {
          console.log(
            `[extract] Falling back from ${prov.id} to next provider`,
          );
          continue;
        }
        if (!res) break;
      }
      if (!res || !res.ok) {
        // No mock fallback: a failed LLM means no data, not invented data.
        // The caller catches this and queues the mail for retry.
        throw new Error(
          `[extract] LLM failed after retries: ${lastErrText.slice(0, 200)}`,
        );
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: ProviderUsage;
      };
      await recordAiUsage(ctx, {
        operation: "extraction",
        provider: usedProvider,
        model: usedModel,
        usage: json.usage,
        latencyMs: successfulLatencyMs,
        success: true,
      });
      const content = json.choices?.[0]?.message?.content ?? "{}";
      console.log(`[extract] LLM raw response: ${content.slice(0, 300)}`);
      const parsed = JSON.parse(content) as Record<string, unknown>;

      let merchant =
        typeof parsed.merchant === "string" && parsed.merchant.trim()
          ? parsed.merchant.trim()
          : undefined;
      const product =
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
      // Never invent: if the LLM omitted merchant/price, they stay missing
      // and the caller routes the mail to skipped/unparsed — no guessing.
      if (merchant && /^(welcome|hello|hi|your|dear)\b/i.test(merchant)) {
        merchant = undefined;
      }
      // Final validation: if currency not in Top 8 but looks like ISO (e.g. ZAR), allow it (Intl will try), else default USD
      if (currency && !ISO_SET.has(currency) && !/^[A-Z]{3}$/.test(currency)) {
        currency = "USD";
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
      const lastChargeAt = parseDateToMs(parsed.lastChargeAt as string | null);

      console.log(
        `[extract] Final LLM result: merchant="${merchant ?? "null"}", price=${price ?? "null"}, currency="${currency}", isConfirmation=${isConfirmation}, confidence=${confidence}`,
      );

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
        lastChargeAt,
      };
    } catch (e) {
      // No mock fallback: bad JSON / unexpected failure means no data.
      // The caller catches this and queues the mail for retry.
      throw e;
    }
  },
});
