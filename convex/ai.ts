import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  type ActionCtx,
  action,
  env,
  internalAction,
} from "./_generated/server";

const SYSTEM_PROMPT = `You are a precise subscription extraction engine for SubZero. Return valid JSON ONLY.

TASK: Analyze DOCUMENT and extract subscription data. Follow SCHEMA exactly.

SCHEMA — return ONLY valid JSON matching this exact shape. Do not add keys. Do not remove keys. No markdown, no code fences, no explanation. Use null/false where noted for missing (never omit a key).

{
  "isSubscription": "<boolean>",
  "merchant": "<canonical brand string | null — null if not subscription>",
  "product": "<string | null>",
  "price": "<number — 0 if not subscription>",
  "currency": "<USD|EUR|GBP|NGN|INR|JPY|CAD|AUD>",
  "billingInterval": "<monthly|yearly|weekly|unknown>",
  "nextRenewalAtISO": "<ISO 8601 date string | null>",
  "trialEndsAtISO": "<ISO 8601 date string | null>",
  "billingProvider": "<string | null>",
  "cancellationUrl": "<string | null>",
  "cancellationMethod": "<open_web|open_provider|send_email|contact_support|manual|unknown>",
  "evidenceList": [{"source":"<string>","excerpt":"<exact quote max 300 chars>","confidence":"<0-1>"}]
}

RULES:
- isSubscription false → merchant null, price 0, product null, evidenceList [] or single low-confidence note. Do NOT hallucinate.
- Missing field → null (or 0/unknown/false per schema). Do NOT infer, do NOT omit key.
- price: number type, strip commas ₦7,700.00→7700, JPY integer. currency from symbol/suffix: $→USD, C$→CAD, A$→AUD, €→EUR, £→GBP, ₦→NGN, ₹→INR, ¥→JPY. If no subscription, currency "USD".
- billingInterval enum only. unknown if not stated.
- dates ISO 8601 YYYY-MM-DD or null. Use explicit date only.
- excerpt: exact quote backing price/date. confidence: 0.95-0.99 explicit, 0.85-0.95 minor interpretation, 0.6-0.85 ambiguous.
- excerpt formatting: plain text by default. You may use minimal markdown (**bold**, *italic*, \`code\`, [text](https://…)) wherever it makes the quote clearer. Never headings, lists, tables, or images.
- CANONICAL MERCHANT (brand only, never product/billingProvider):
  - Any text containing "google" → "Google One" (e.g., "Google AI Plus (400 GB) (Google One)" → merchant "Google One", product "Google AI Plus (400 GB)")
  - Snap → "Snap Inc", OpenAI → "ChatGPT", others: Adobe, Spotify, Notion, Netflix, Figma, Linear, Canva, YouTube
  - Never repeat merchant in product; never put "Google Play"/"Apple" in merchant.
  - product: plan/feature name only (e.g. "Snapchat+"). Never app-store titles — strip any "(Name: tagline)" suffix: "Snapchat+ (Snapchat: Chat with Friends)" → product "Snapchat+".

FEW-SHOT:

Document: "Your Google Play Order Receipt Google AI Plus (400 GB) (Google One) trial ends 20 Aug 2027 charged ₦7,700/month via Google Play"
=> {"isSubscription":true,"merchant":"Google One","product":"Google AI Plus (400 GB)","price":7700,"currency":"NGN","billingInterval":"monthly","nextRenewalAtISO":"2027-08-20","trialEndsAtISO":"2027-08-20","billingProvider":"Google Play","cancellationUrl":null,"cancellationMethod":"unknown","evidenceList":[{"source":"Google One","excerpt":"You will be automatically charged ₦7,700.00/month","confidence":0.98}]}

Document: "NATIONAL EXAMINATIONS COUNCIL Invoice ₦5,100 single payment, no renewal"
=> {"isSubscription":false,"merchant":null,"product":null,"price":0,"currency":"USD","billingInterval":"unknown","nextRenewalAtISO":null,"trialEndsAtISO":null,"billingProvider":null,"cancellationUrl":null,"cancellationMethod":"unknown","evidenceList":[]}

Document: "Spotify Premium $9.99/month renews 2026-09-15"
=> {"isSubscription":true,"merchant":"Spotify","product":"Spotify Premium","price":9.99,"currency":"USD","billingInterval":"monthly","nextRenewalAtISO":"2026-09-15","trialEndsAtISO":null,"billingProvider":null,"cancellationUrl":null,"cancellationMethod":"unknown","evidenceList":[{"source":"Spotify","excerpt":"$9.99/month renews 2026-09-15","confidence":0.96}]}

VALIDATION: Raw JSON only. All keys present. No trailing commas. No single quotes. No extra text.`;

async function callAI(text: string) {
  const groqKey =
    (env as unknown as { GROQ_API_KEY?: string }).GROQ_API_KEY ??
    process.env.GROQ_API_KEY;
  const openaiKey =
    (env as unknown as { OPENAI_API_KEY?: string }).OPENAI_API_KEY ??
    process.env.OPENAI_API_KEY;
  const provider = groqKey ? "groq" : openaiKey ? "openai" : null;
  const apiKey = groqKey ?? openaiKey;
  if (!apiKey || !provider) {
    // Mock fallback — same shape as LLM, keeps demo working without keys
    const lower = text.toLowerCase();
    const isSub =
      /receipt|trial|renewal|subscription|invoice|charged|billed/i.test(lower);
    const priceMatch =
      lower.match(/\$\s*(\d+(?:\.\d{1,2})?)/) ?? lower.match(/(\d+\.\d{2})/);
    const price = priceMatch ? Number.parseFloat(priceMatch[1]) : 0;
    const merchants = [
      "adobe",
      "canva",
      "spotify",
      "notion",
      "netflix",
      "chatgpt",
      "figma",
      "linear",
    ];
    let merchant = "Unknown";
    for (const m of merchants)
      if (lower.includes(m)) {
        merchant = m.charAt(0).toUpperCase() + m.slice(1);
        if (m === "chatgpt") merchant = "ChatGPT";
        break;
      }
    return {
      isSubscription: isSub && !!price,
      merchant,
      product: null as string | null,
      price: price || 0,
      currency: "USD",
      billingInterval: "monthly" as const,
      nextRenewalAtISO: null as string | null,
      trialEndsAtISO: null as string | null,
      billingProvider: null as string | null,
      cancellationUrl: null as string | null,
      cancellationMethod: "unknown" as const,
      evidenceList: [
        { source: "Mock", excerpt: text.slice(0, 300), confidence: 0.6 },
      ],
    };
  }

  const endpoint =
    provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
  const model = provider === "groq" ? "openai/gpt-oss-120b" : "gpt-4o-mini";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze the following email/text:\n\n${text}`,
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`${provider} API error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI API");

  return JSON.parse(content) as {
    isSubscription: boolean;
    merchant: string;
    product?: string | null;
    price: number;
    currency: string;
    billingInterval: "monthly" | "yearly" | "weekly" | "unknown";
    nextRenewalAtISO?: string | null;
    trialEndsAtISO?: string | null;
    billingProvider?: string | null;
    cancellationUrl?: string | null;
    cancellationMethod?:
      | "open_web"
      | "open_provider"
      | "send_email"
      | "contact_support"
      | "manual"
      | "unknown";
    evidenceList?: Array<{
      source: string;
      excerpt: string;
      confidence: number;
    }>;
  };
}

export const extractFromText = action({
  args: {
    rawText: v.string(),
    sourceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;

    return await processExtraction(
      ctx,
      userId,
      args.rawText,
      args.sourceName ?? "Manual paste",
    );
  },
});

export const extractFromTextInternal = internalAction({
  args: {
    userId: v.string(),
    rawText: v.string(),
    sourceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await processExtraction(
      ctx,
      args.userId,
      args.rawText,
      args.sourceName ?? "Email Ingestion",
    );
  },
});

async function processExtraction(
  ctx: ActionCtx,
  userId: string,
  rawText: string,
  sourceName: string,
): Promise<{
  success: boolean;
  subscriptionId?: Id<"subscriptions">;
  merchant?: string;
  reason?: string;
}> {
  const extracted = await callAI(rawText);
  if (!extracted.isSubscription || !extracted.merchant) {
    return { success: false, reason: "No subscription detected in text" };
  }

  const nextRenewalAt = extracted.nextRenewalAtISO
    ? Date.parse(extracted.nextRenewalAtISO)
    : undefined;
  const trialEndsAt = extracted.trialEndsAtISO
    ? Date.parse(extracted.trialEndsAtISO)
    : undefined;

  const validNextRenewalAt = isNaN(nextRenewalAt as number)
    ? undefined
    : nextRenewalAt;
  const validTrialEndsAt = isNaN(trialEndsAt as number)
    ? undefined
    : trialEndsAt;

  const subscriptionId: Id<"subscriptions"> = await ctx.runMutation(
    internal.subscriptions.upsertInternal,
    {
      userId,
      merchant: extracted.merchant,
      product: extracted.product ?? undefined,
      price: extracted.price || 0,
      currency: extracted.currency || "USD",
      billingInterval: extracted.billingInterval || "monthly",
      billingProvider: extracted.billingProvider ?? undefined,
      nextRenewalAt: validNextRenewalAt,
      trialEndsAt: validTrialEndsAt,
      cancellationUrl: extracted.cancellationUrl ?? undefined,
      cancellationMethod: extracted.cancellationMethod ?? "unknown",
    },
  );

  if (extracted.evidenceList && extracted.evidenceList.length > 0) {
    for (const ev of extracted.evidenceList) {
      await ctx.runMutation(internal.evidence.addInternal, {
        subscriptionId,
        source: ev.source || sourceName,
        sourceType: "email",
        excerpt: ev.excerpt,
        confidence: ev.confidence ?? 0.9,
      });
    }
  }

  // Trigger Firecrawl cancellation research if we don't have a direct cancellation link
  if (!extracted.cancellationUrl) {
    await ctx.scheduler.runAfter(
      0,
      internal.research.researchCancellationRoute,
      {
        subscriptionId,
      },
    );
  }

  return { success: true, subscriptionId, merchant: extracted.merchant };
}
