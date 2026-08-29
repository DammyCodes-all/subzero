import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { ActionCtx, action, internalAction } from "./_generated/server";

const SYSTEM_PROMPT = `You are SubZero's subscription extraction AI engine.
Your job is to analyze incoming text (email receipt, subscription notification, or trial confirmation) and extract structured subscription information.

You MUST respond with a JSON object matching this exact schema:
{
  "isSubscription": boolean,
  "merchant": string,
  "product": string | null,
  "price": number,
  "currency": string,
  "billingInterval": "monthly" | "yearly" | "weekly" | "unknown",
  "nextRenewalAtISO": string | null,
  "trialEndsAtISO": string | null,
  "billingProvider": string | null,
  "cancellationUrl": string | null,
  "cancellationMethod": "open_web" | "open_provider" | "send_email" | "contact_support" | "manual" | "unknown",
  "evidenceList": [
    {
      "source": string,
      "excerpt": string,
      "confidence": number
    }
  ]
}

Rules:
- If the text is NOT a subscription, receipt, or trial email, set "isSubscription" to false.
- Keep "excerpt" as exact quotes from the source text backing the price, date, or subscription claim.
- Provide a confidence score between 0.0 and 1.0.
- Standardize price as a positive float number. Default currency to "USD" if unspecified.`;

async function callOpenAI(text: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Analyze the following email/text:\n\n${text}` },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
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

    return await processExtraction(ctx, userId, args.rawText, args.sourceName ?? "Manual paste");
  },
});

export const extractFromTextInternal = internalAction({
  args: {
    userId: v.string(),
    rawText: v.string(),
    sourceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await processExtraction(ctx, args.userId, args.rawText, args.sourceName ?? "Email Ingestion");
  },
});

async function processExtraction(
  ctx: ActionCtx,
  userId: string,
  rawText: string,
  sourceName: string
): Promise<{ success: boolean; subscriptionId?: Id<"subscriptions">; merchant?: string; reason?: string }> {
  const extracted = await callOpenAI(rawText);
  if (!extracted.isSubscription || !extracted.merchant) {
    return { success: false, reason: "No subscription detected in text" };
  }

  const nextRenewalAt = extracted.nextRenewalAtISO
    ? Date.parse(extracted.nextRenewalAtISO)
    : undefined;
  const trialEndsAt = extracted.trialEndsAtISO
    ? Date.parse(extracted.trialEndsAtISO)
    : undefined;

  const validNextRenewalAt = isNaN(nextRenewalAt as number) ? undefined : nextRenewalAt;
  const validTrialEndsAt = isNaN(trialEndsAt as number) ? undefined : trialEndsAt;

  const subscriptionId: Id<"subscriptions"> = await ctx.runMutation(internal.subscriptions.upsertInternal, {
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
  });

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

  return { success: true, subscriptionId, merchant: extracted.merchant };
}
