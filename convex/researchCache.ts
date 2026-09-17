import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { RESEARCH_CACHE_TTL_MS } from "./lib/researchCache";

const routeFields = {
  cancellationMethod: v.string(),
  cancellationUrl: v.optional(v.string()),
  instructions: v.array(v.string()),
  evidenceUrl: v.optional(v.string()),
  evidenceExcerpt: v.optional(v.string()),
  websiteDomain: v.optional(v.string()),
};

export const getFresh = internalQuery({
  args: { cacheKey: v.string() },
  returns: v.union(v.object(routeFields), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("cancellationRouteCache")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
    if (!row || row.expiresAt <= Date.now()) return null;
    return {
      cancellationMethod: row.cancellationMethod,
      cancellationUrl: row.cancellationUrl,
      instructions: row.instructions,
      evidenceUrl: row.evidenceUrl,
      evidenceExcerpt: row.evidenceExcerpt,
      websiteDomain: row.websiteDomain,
    };
  },
});

export const put = internalMutation({
  args: {
    cacheKey: v.string(),
    ...routeFields,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("cancellationRouteCache")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
    const value = {
      cancellationMethod: args.cancellationMethod,
      cancellationUrl: args.cancellationUrl,
      instructions: args.instructions,
      evidenceUrl: args.evidenceUrl,
      evidenceExcerpt: args.evidenceExcerpt,
      websiteDomain: args.websiteDomain,
      updatedAt: Date.now(),
      expiresAt: Date.now() + RESEARCH_CACHE_TTL_MS,
    };
    if (existing) await ctx.db.patch(existing._id, value);
    else
      await ctx.db.insert("cancellationRouteCache", {
        cacheKey: args.cacheKey,
        ...value,
      });
    return null;
  },
});

export const cleanupExpired = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("cancellationRouteCache")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now()))
      .take(200);
    for (const row of rows) await ctx.db.delete(row._id);
    return rows.length;
  },
});
