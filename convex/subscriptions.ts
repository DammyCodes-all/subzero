import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { dedupKey } from "./lib/dedup";
import { getDifficulty } from "./lib/difficulty";
import { healUserData } from "./lib/heal";
import { cleanProductName } from "./lib/product";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const all = await ctx.db.query("subscriptions").collect();
    return all.filter((s) => s.userId === userId || s.userId.includes(userId));
  },
});

export const needsAttention = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const now = Date.now();
    const horizon = now + (args.days ?? 7) * 24 * 60 * 60 * 1000;
    const all = await ctx.db.query("subscriptions").collect();
    return all
      .filter(
        (s) =>
          (s.userId === userId || s.userId.includes(userId)) &&
          s.nextRenewalAt !== undefined &&
          s.nextRenewalAt >= now &&
          s.nextRenewalAt <= horizon,
      )
      .sort((a, b) => (a.nextRenewalAt ?? 0) - (b.nextRenewalAt ?? 0))
      .slice(0, 20);
  },
});

export const get = query({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const sub = await ctx.db.get(args.id);
    if (!sub || (sub.userId !== userId && !sub.userId.includes(userId)))
      return null;
    return sub;
  },
});

export const upsert = mutation({
  args: {
    merchant: v.string(),
    product: v.optional(v.string()),
    price: v.number(),
    currency: v.string(),
    billingInterval: v.union(
      v.literal("monthly"),
      v.literal("yearly"),
      v.literal("weekly"),
      v.literal("unknown"),
    ),
    billingProvider: v.optional(v.string()),
    nextRenewalAt: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    cancellationUrl: v.optional(v.string()),
    cancellationMethod: v.optional(
      v.union(
        v.literal("open_web"),
        v.literal("open_provider"),
        v.literal("send_email"),
        v.literal("contact_support"),
        v.literal("manual"),
        v.literal("unknown"),
      ),
    ),
    steps: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const product = cleanProductName(args.product);
    const key = dedupKey({ ...args, product });
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_and_dedup", (q) =>
        q.eq("userId", userId).eq("dedupKey", key),
      )
      .unique();

    const difficulty = getDifficulty(
      args.cancellationMethod ?? "unknown",
      args.steps ?? 0,
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        product: product ?? existing.product,
        price: args.price,
        currency: args.currency,
        billingInterval: args.billingInterval,
        nextRenewalAt: args.nextRenewalAt ?? existing.nextRenewalAt,
        trialEndsAt: args.trialEndsAt ?? existing.trialEndsAt,
        cancellationUrl: args.cancellationUrl ?? existing.cancellationUrl,
        cancellationMethod:
          args.cancellationMethod ?? existing.cancellationMethod,
        cancellationDifficulty: difficulty,
        billingProvider: args.billingProvider ?? existing.billingProvider,
      });
      return existing._id;
    }

    return await ctx.db.insert("subscriptions", {
      userId,
      merchant: args.merchant,
      product,
      price: args.price,
      currency: args.currency,
      billingInterval: args.billingInterval,
      status: "active",
      nextRenewalAt: args.nextRenewalAt,
      trialEndsAt: args.trialEndsAt,
      cancellationUrl: args.cancellationUrl,
      cancellationMethod: args.cancellationMethod,
      cancellationDifficulty: difficulty,
      billingProvider: args.billingProvider,
      dedupKey: key,
    });
  },
});

export const upsertInternal = internalMutation({
  args: {
    userId: v.string(),
    merchant: v.string(),
    product: v.optional(v.string()),
    price: v.number(),
    currency: v.string(),
    billingInterval: v.union(
      v.literal("monthly"),
      v.literal("yearly"),
      v.literal("weekly"),
      v.literal("unknown"),
    ),
    billingProvider: v.optional(v.string()),
    nextRenewalAt: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    cancellationUrl: v.optional(v.string()),
    cancellationMethod: v.optional(
      v.union(
        v.literal("open_web"),
        v.literal("open_provider"),
        v.literal("send_email"),
        v.literal("contact_support"),
        v.literal("manual"),
        v.literal("unknown"),
      ),
    ),
    steps: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId;
    const product = cleanProductName(args.product);
    const key = dedupKey({ ...args, product });
    let existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_and_dedup", (q) =>
        q.eq("userId", userId).eq("dedupKey", key),
      )
      .unique();

    // Fallback for provider enrichment — avoid duplicate when first row had no provider
    if (!existing && args.billingProvider) {
      const fallbackKey = dedupKey({
        ...args,
        product,
        billingProvider: undefined,
      });
      existing = await ctx.db
        .query("subscriptions")
        .withIndex("by_user_and_dedup", (q) =>
          q.eq("userId", userId).eq("dedupKey", fallbackKey),
        )
        .unique();
    }

    const difficulty = getDifficulty(
      args.cancellationMethod ?? "unknown",
      args.steps ?? 0,
    );

    if (existing) {
      const addedProvider = !!(
        args.billingProvider && !existing.billingProvider
      );
      const patch: Record<string, unknown> = {
        product: product ?? existing.product,
        price: args.price,
        currency: args.currency,
        billingInterval: args.billingInterval,
        billingProvider: args.billingProvider ?? existing.billingProvider,
      };
      if (addedProvider) patch.dedupKey = key;
      if (
        args.nextRenewalAt &&
        (!existing.nextRenewalAt || args.nextRenewalAt > existing.nextRenewalAt)
      )
        patch.nextRenewalAt = args.nextRenewalAt;
      if (
        args.trialEndsAt &&
        (!existing.trialEndsAt || args.trialEndsAt > existing.trialEndsAt)
      )
        patch.trialEndsAt = args.trialEndsAt;
      if (args.cancellationUrl && !existing.cancellationUrl)
        patch.cancellationUrl = args.cancellationUrl;
      if (args.cancellationMethod && existing.cancellationMethod === "unknown")
        patch.cancellationMethod = args.cancellationMethod;
      if (!existing.cancellationDifficulty)
        patch.cancellationDifficulty = difficulty;
      if (addedProvider) patch.researchStatus = "pending";
      // Don't clobber researched route
      if (Object.keys(patch).length > 0)
        await ctx.db.patch(existing._id, patch as never);
      if (addedProvider && existing.researchStatus !== "pending") {
        await ctx.scheduler.runAfter(
          0,
          internal.research.researchCancellationRoute,
          {
            subscriptionId: existing._id,
          },
        );
      }
      return existing._id;
    }

    const subId = await ctx.db.insert("subscriptions", {
      userId,
      merchant: args.merchant,
      product,
      price: args.price,
      currency: args.currency,
      billingInterval: args.billingInterval,
      status: "active",
      nextRenewalAt: args.nextRenewalAt,
      trialEndsAt: args.trialEndsAt,
      cancellationUrl: args.cancellationUrl,
      cancellationMethod: args.cancellationMethod ?? "unknown",
      cancellationDifficulty: difficulty,
      billingProvider: args.billingProvider,
      dedupKey: key,
      researchStatus: "pending",
    });

    await ctx.scheduler.runAfter(
      0,
      internal.notifications.scheduleNudgesForSubscription,
      {
        subscriptionId: subId,
      },
    );
    await ctx.scheduler.runAfter(
      0,
      internal.research.researchCancellationRoute,
      {
        subscriptionId: subId,
      },
    );

    // Self-heal rows stored before write-path cleaning (bounded, indexed).
    await healUserData(ctx, userId);

    return subId;
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getUpcomingForSweep = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const nextWeek = now + 7 * 24 * 60 * 60 * 1000;
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_renewal", (q) =>
        q.gte("nextRenewalAt", now).lte("nextRenewalAt", nextWeek),
      )
      .collect();
  },
});

export const getFailedForRetry = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const failed = await ctx.db
      .query("subscriptions")
      .withIndex("by_researchStatus", (q) => q.eq("researchStatus", "failed"))
      .collect();
    const pending = await ctx.db
      .query("subscriptions")
      .withIndex("by_researchStatus", (q) => q.eq("researchStatus", "pending"))
      .collect();
    const stuck = pending.filter(
      (s) => (s.researchedAt ?? s._creationTime) < oneHourAgo,
    );
    return [...failed, ...stuck];
  },
});

export const markResearchPending = internalMutation({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      researchStatus: "pending",
      researchedAt: Date.now(),
    });
  },
});

export const saveResearchResult = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    cancellationMethod: v.string(),
    cancellationUrl: v.optional(v.string()),
    instructions: v.array(v.string()),
    difficulty: v.optional(v.string()),
    evidenceUrl: v.optional(v.string()),
    evidenceExcerpt: v.optional(v.string()),
    researchStatus: v.optional(
      v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
    ),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub) return;

    const validMethods = new Set([
      "open_web",
      "open_provider",
      "send_email",
      "contact_support",
      "manual",
      "unknown",
    ]);
    const methodRaw = String(args.cancellationMethod ?? "unknown")
      .toLowerCase()
      .replace("-", "_");
    const method = validMethods.has(methodRaw) ? methodRaw : "unknown";
    const instructions = (args.instructions ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 12);

    // Generic verbatim-aware verification: open_* and send_email require a URL/mailto
    let finalMethod = method as any;
    let finalInstructions = [...instructions];
    let finalUrl = args.cancellationUrl ?? undefined;

    // If LLM gave no URL for a method that needs one, downgrade to unknown (no hardcoding)
    if (
      (finalMethod === "open_web" ||
        finalMethod === "open_provider" ||
        finalMethod === "send_email") &&
      !finalUrl
    ) {
      finalMethod = "unknown";
      finalInstructions = [];
      finalUrl = undefined;
    }
    // Generic blocklist — same as research.ts, path-segment anchored
    if (finalUrl) {
      let isBlocked = false;
      try {
        const u = new URL(finalUrl);
        const h = u.hostname.toLowerCase();
        const p = u.pathname.toLowerCase();
        if (h === "one.google.com" && p.startsWith("/about")) isBlocked = true;
        if (p === "/about" || p.startsWith("/about/")) isBlocked = true;
        if (p === "/pricing" || p.startsWith("/pricing/")) isBlocked = true;
        if (p === "/terms" || p.startsWith("/terms/")) isBlocked = true;
        if (p === "/" || p === "") isBlocked = true;
      } catch {
        isBlocked = false;
      }
      if (isBlocked) {
        finalMethod = "unknown";
        finalInstructions = [];
        finalUrl = undefined;
      }
    }

    const difficulty = getDifficulty(finalMethod, finalInstructions.length);

    const hasVerifiedRoute =
      finalMethod !== "unknown" && finalInstructions.length > 0 && !!finalUrl;
    // For manual/contact_support, URL optional but instructions required
    const manualVerified =
      (finalMethod === "manual" || finalMethod === "contact_support") &&
      finalInstructions.length > 0;
    const isVerified = hasVerifiedRoute || manualVerified;

    const patch: Record<string, unknown> = {
      cancellationMethod: finalMethod,
      cancellationDifficulty: difficulty,
      researchStatus: args.researchStatus ?? "done",
      researchedAt: Date.now(),
      status: isVerified ? "action_ready" : "active",
    };
    // Explicit delete on unknown: Convex patch with undefined removes optional field
    if (finalMethod === "unknown") {
      patch.cancellationUrl = undefined;
    } else if (finalUrl) {
      patch.cancellationUrl = finalUrl;
    }
    await ctx.db.patch(args.subscriptionId, patch as never);

    // Dedup cancellationActions
    const existingAction = await ctx.db
      .query("cancellationActions")
      .withIndex("by_subscription", (q) =>
        q.eq("subscriptionId", args.subscriptionId),
      )
      .first();
    const finalHasVerified = isVerified;
    if (existingAction) {
      await ctx.db.patch(existingAction._id, {
        type: finalMethod,
        status: finalHasVerified ? ("ready" as const) : ("failed" as const),
        instructions: finalInstructions.length ? finalInstructions : undefined,
      });
    } else if (finalHasVerified) {
      await ctx.db.insert("cancellationActions", {
        subscriptionId: args.subscriptionId,
        type: finalMethod,
        status: "ready",
        instructions: finalInstructions,
      });
    }

    // Generic evidence — use args directly (no provider override)
    const finalExcerpt = args.evidenceExcerpt;
    const finalEvidenceUrl = args.evidenceUrl;
    const excerpt = (finalExcerpt ?? "").slice(0, 500).trim();
    const evidenceUrlToUse = finalEvidenceUrl ?? args.evidenceUrl;
    if (excerpt || evidenceUrlToUse) {
      const existingEvidence = await ctx.db
        .query("evidence")
        .withIndex("by_subscription", (q) =>
          q.eq("subscriptionId", args.subscriptionId),
        )
        .collect();
      const alreadyHas = existingEvidence.some(
        (e) =>
          e.sourceType === "firecrawl" &&
          e.url === evidenceUrlToUse &&
          e.excerpt === excerpt,
      );
      if (!alreadyHas) {
        const firecrawlOld = existingEvidence.filter(
          (e) => e.sourceType === "firecrawl",
        );
        for (const old of firecrawlOld) await ctx.db.delete(old._id);
        await ctx.db.insert("evidence", {
          subscriptionId: args.subscriptionId,
          source: sub.merchant
            ? `${sub.merchant} Help Center`
            : "Firecrawl Search",
          sourceType: "firecrawl",
          url: evidenceUrlToUse ?? undefined,
          excerpt: excerpt || `How to cancel ${sub.merchant}`,
          confidence: finalHasVerified ? 0.85 : 0.55,
          retrievedAt: Date.now(),
        });
      }
    }
  },
});
