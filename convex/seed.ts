import { mutation } from "./_generated/server";
import { dedupKey } from "./lib/dedup";
import { getDifficulty } from "./lib/difficulty";

const day = 24 * 60 * 60 * 1000;

const mocks = [
  {
    merchant: "Adobe",
    product: "Creative Cloud",
    price: 54.99,
    currency: "USD",
    billingInterval: "monthly" as const,
    renewInDays: 2,
    billingProvider: undefined,
    cancellationMethod: "open_web" as const,
    cancellationUrl: "https://account.adobe.com/plans",
    steps: 7,
    evidence: [
      {
        source: "Adobe email",
        sourceType: "email" as const,
        excerpt:
          "Your trial ends September 3, 2026 and your plan will renew at $54.99/month",
        confidence: 0.95,
      },
      {
        source: "Adobe help — cancel",
        sourceType: "firecrawl" as const,
        excerpt: "Cancel: Account → Manage plan → Cancel plan → Confirm",
        url: "https://helpx.adobe.com/manage-account/using/cancel-subscription.html",
        confidence: 0.85,
      },
    ],
  },
  {
    merchant: "Canva",
    product: "Pro",
    price: 15,
    currency: "USD",
    billingInterval: "monthly" as const,
    renewInDays: 6,
    cancellationMethod: "open_web" as const,
    steps: 4,
  },
  {
    merchant: "Spotify",
    product: "Premium",
    price: 11.99,
    currency: "USD",
    billingInterval: "monthly" as const,
    renewInDays: 12,
    cancellationMethod: "open_web" as const,
    steps: 3,
  },
  {
    merchant: "Notion",
    product: "Plus",
    price: 10,
    currency: "USD",
    billingInterval: "monthly" as const,
    renewInDays: 20,
    cancellationMethod: "open_web" as const,
    steps: 3,
  },
  {
    merchant: "Netflix",
    product: "Standard",
    price: 15.49,
    currency: "USD",
    billingInterval: "monthly" as const,
    renewInDays: 25,
    cancellationMethod: "open_web" as const,
    steps: 3,
  },
  {
    merchant: "ChatGPT",
    product: "Plus",
    price: 20,
    currency: "USD",
    billingInterval: "monthly" as const,
    renewInDays: 6,
    billingProvider: "Google Play",
    cancellationMethod: "open_provider" as const,
    steps: 0,
  },
  {
    merchant: "Figma",
    product: "Professional",
    price: 15,
    currency: "USD",
    billingInterval: "monthly" as const,
    renewInDays: 18,
    cancellationMethod: "open_web" as const,
    steps: 4,
  },
  {
    merchant: "Linear",
    product: "Standard",
    price: 8,
    currency: "USD",
    billingInterval: "monthly" as const,
    renewInDays: 30,
    cancellationMethod: "open_web" as const,
    steps: 3,
  },
];

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated — sign in first");
    const userId = identity.tokenIdentifier;
    const now = Date.now();

    let inserted = 0;
    for (const m of mocks) {
      const key = dedupKey({
        merchant: m.merchant,
        product: m.product,
        billingProvider: m.billingProvider,
        price: m.price,
        currency: m.currency,
      });
      const existing = await ctx.db
        .query("subscriptions")
        .withIndex("by_user_and_dedup", (q) =>
          q.eq("userId", userId).eq("dedupKey", key),
        )
        .unique();
      if (existing) continue;

      const difficulty = getDifficulty(
        m.cancellationMethod,
        m.steps ?? 0,
        !!m.billingProvider,
      );

      const id = await ctx.db.insert("subscriptions", {
        userId,
        merchant: m.merchant,
        product: m.product,
        price: m.price,
        currency: m.currency,
        billingInterval: m.billingInterval,
        status: "active",
        nextRenewalAt: now + m.renewInDays * day,
        cancellationMethod: m.cancellationMethod,
        cancellationDifficulty: difficulty,
        cancellationUrl: m.cancellationUrl,
        billingProvider: m.billingProvider,
        dedupKey: key,
      });

      for (const ev of m.evidence ?? []) {
        await ctx.db.insert("evidence", {
          subscriptionId: id,
          source: ev.source,
          sourceType: ev.sourceType,
          excerpt: ev.excerpt,
          url: ev.url,
          confidence: ev.confidence,
          retrievedAt: Date.now(),
        });
      }
      inserted++;
    }
    return { inserted };
  },
});
